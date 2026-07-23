import { ConsumeMessage } from 'amqplib';
import os from 'os';
import { getChannel, QUEUE_RUN_TEST } from '../lib/rabbitmq.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { K6Runner } from './k6Runner.js';
import { ResultIngester } from './resultIngester.js';
import { broadcastMetric, broadcastStatus, broadcastSysStats } from '../routes/ws.js';
import { extractCsvFiles } from '../routes/utils.js';

const runner = new K6Runner();
const ingester = new ResultIngester();

async function advanceSuite(runId: string): Promise<void> {
  const completed = await prisma.testRun.findUnique({ where: { id: runId } });
  if (!completed?.suiteRunId) return;

  const nextRun = await prisma.testRun.findFirst({
    where: { suiteRunId: completed.suiteRunId, status: 'pending' },
    include: { script: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!nextRun) return;

  const channel = getChannel();
  const csvFiles = await extractCsvFiles(nextRun.script.content);
  channel.sendToQueue(QUEUE_RUN_TEST, Buffer.from(JSON.stringify({
    runId: nextRun.id,
    projectId: nextRun.projectId,
    scriptContent: nextRun.script.content,
    options: {},
    csvFiles,
  })), { persistent: true });

  await prisma.testRun.update({
    where: { id: nextRun.id },
    data: { status: 'running', startedAt: new Date() },
  });

  logger.info({ runId: nextRun.id, suiteRunId: completed.suiteRunId }, 'Suite advanced to next run');
}

// Listen for metric points from k6 output
runner.on('metric', async (runId: string, point: any) => {
  if (point.type === 'Point') {
    try {
      await ingester.ingestPoint(runId, point);
    } catch (err) {
      logger.error({ err, runId }, 'Failed to ingest metric point');
    }
    broadcastMetric(runId, point);
  }
});

// Listen for test completion
runner.on('done', async (runId: string, result: { exitCode: number | null; stderr: string; cloudRunUrl?: string | null; cloudRunId?: string | null; requestLogs?: any[] }) => {
  logger.info({ runId, exitCode: result.exitCode, stderr: result.stderr }, 'k6 test finished');
  try {
    await ingester.aggregateAndFinalize(runId, result.exitCode, result.stderr);
  } catch (err) {
    logger.error({ err, runId }, 'Failed to aggregate and finalize run');
  }

  // Persist request logs
  if (result.requestLogs && result.requestLogs.length > 0) {
    try {
      await prisma.testRequestLog.createMany({
        data: result.requestLogs.map((log: any) => ({
          testRunId: runId,
          method: log.method || 'UNKNOWN',
          url: log.url || '',
          status: typeof log.status === 'number' ? log.status : 0,
          body: log.body || null,
          headers: log.headers || null,
          timing: typeof log.timing === 'number' ? log.timing : null,
        })),
      });
    } catch (err) {
      logger.error({ err, runId }, 'Failed to persist request logs');
    }
  }

  // Store cloud run URL/ID if found in k6 output
  if (result.cloudRunUrl || result.cloudRunId) {
    await prisma.testRun.update({
      where: { id: runId },
      data: { cloudRunId: result.cloudRunId ?? undefined, cloudRunUrl: result.cloudRunUrl ?? undefined },
    });

    // Auto-fetch cloud results if we have a cloud run ID and a project token
    if (result.cloudRunId) {
      const run = await prisma.testRun.findUnique({
        where: { id: runId },
        include: { project: { select: { k6CloudToken: true } } },
      });
      if (run?.project.k6CloudToken) {
        try {
          const cloudResp = await fetch(
            `https://api.k6.io/v3/test-runs/${result.cloudRunId}/metrics`,
            { headers: { Authorization: `Token ${run.project.k6CloudToken}` } },
          );
          if (cloudResp.ok) {
            const cloudData = await cloudResp.json();
            await prisma.testRun.update({
              where: { id: runId },
              data: { cloudResults: JSON.stringify(cloudData) },
            });
            logger.info({ runId, cloudRunId: result.cloudRunId }, 'Auto-fetched k6 Cloud results');
          }
        } catch (err) {
          logger.error({ err, runId, cloudRunId: result.cloudRunId }, 'Auto-fetch of k6 Cloud results failed');
        }
      }
    }
  }

  try {
    await advanceSuite(runId);
  } catch (err) {
    logger.error({ err, runId }, 'Failed to advance suite');
  }
  broadcastStatus(runId, result.exitCode === 0 ? 'completed' : 'failed');
});

// Listen for errors
runner.on('error', (runId: string, err: Error) => {
  logger.error({ err, runId }, 'k6 runner error');
  broadcastStatus(runId, 'failed');
});

export { ingester as resultIngester };
export { advanceSuite };
export { runner };

export async function startWorker(): Promise<void> {
  const channel = getChannel();

  channel.consume(QUEUE_RUN_TEST, async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    try {
      const payload = JSON.parse(msg.content.toString());

      // Handle abort messages
      if (payload.type === 'abort') {
        runner.abort(payload.runId);
        channel.ack(msg);
        return;
      }

      // Run test
      broadcastStatus(payload.runId, 'running');
      await prisma.testRun.update({
        where: { id: payload.runId },
        data: { status: 'running', startedAt: new Date() },
      }).catch(err => logger.error({ err, runId: payload.runId }, 'Failed to update run status to running'));

      await runner.start({
        runId: payload.runId,
        projectId: payload.projectId,
        scriptContent: payload.scriptContent,
        options: payload.options,
        prometheusPushUrl: payload.prometheusPushUrl,
        csvFiles: payload.csvFiles,
      });

      channel.ack(msg);
    } catch (err) {
      logger.error({ err }, 'Failed to process test job');
      channel.nack(msg, false, true);
    }
  });

  logger.info('Worker listening for test jobs');

  // Broadcast system stats (CPU, memory) to all live monitor clients every 4s
  let prevCpu = process.cpuUsage();
  setInterval(() => {
    const cpu = process.cpuUsage(prevCpu);
    prevCpu = process.cpuUsage();
    const mem = process.memoryUsage();
    const cpus = os.cpus();
    const cpuPercent = Math.min(100, Math.round((cpu.user + cpu.system) / 1000 / cpus.length) / 10);
    broadcastSysStats({
      cpuPercent,
      memoryMb: Math.round(mem.heapUsed / 1024 / 1024),
      memoryPercent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
    });
  }, 4000);
}
