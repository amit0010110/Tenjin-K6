import cron, { type ScheduledTask } from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { prisma } from '../lib/prisma.js';
import { getChannel, QUEUE_RUN_TEST } from '../lib/rabbitmq.js';
import { logger } from '../lib/logger.js';
import { OUTPUT_TYPES } from '@tenjint6/shared';

function safeJson(val: any): any {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
  return val ?? {};
}

class Scheduler {
  private jobs: Map<string, ScheduledTask> = new Map();
  private running = false;

  async start(): Promise<void> {
    this.running = true;
    const schedules = await prisma.schedule.findMany({ where: { enabled: true } });
    let registered = 0;
    for (const s of schedules) {
      if (this.registerJob(s)) registered++;
    }
    logger.info({ registered, total: schedules.length }, 'Scheduler started');
  }

  stop(): void {
    this.running = false;
    for (const [, job] of this.jobs) {
      job.stop();
    }
    this.jobs.clear();
    logger.info('Scheduler stopped');
  }

  addSchedule(schedule: { id: string; testConfigId: string; cronExpr: string; enabled: boolean }): void {
    if (schedule.enabled && this.running) {
      this.registerJob(schedule);
    }
  }

  removeSchedule(id: string): void {
    const job = this.jobs.get(id);
    if (job) {
      job.stop();
      this.jobs.delete(id);
      logger.info({ scheduleId: id }, 'Schedule unregistered');
    }
  }

  updateSchedule(id: string, updates: { cronExpr?: string; enabled?: boolean; testConfigId?: string }): void {
    this.removeSchedule(id);
    if (updates.enabled !== false && this.running) {
      prisma.schedule.findUnique({ where: { id } }).then((s) => {
        if (s && s.enabled) {
          this.registerJob(s);
        }
      }).catch((err) => logger.error({ err, scheduleId: id }, 'Failed to re-register schedule'));
    }
  }

  private registerJob(schedule: { id: string; testConfigId: string; cronExpr: string }): boolean {
    if (!cron.validate(schedule.cronExpr)) {
      logger.warn({ scheduleId: schedule.id, cronExpr: schedule.cronExpr }, 'Invalid cron expression, skipping');
      return false;
    }

    const task = cron.schedule(schedule.cronExpr, () => {
      this.executeSchedule(schedule.id).catch((err) =>
        logger.error({ err, scheduleId: schedule.id }, 'Scheduled run failed')
      );
    });

    this.jobs.set(schedule.id, task);
    logger.info({ scheduleId: schedule.id, cronExpr: schedule.cronExpr }, 'Schedule registered');
    return true;
  }

  private async executeSchedule(scheduleId: string): Promise<void> {
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        config: {
          include: {
            script: { select: { id: true, projectId: true, content: true, envVars: true } },
            outputProfile: true,
          },
        },
      },
    });

    if (!schedule || !schedule.config || !schedule.config.script) {
      logger.warn({ scheduleId }, 'Schedule or config not found, unregistering');
      this.removeSchedule(scheduleId);
      return;
    }

    const config = schedule.config;
    const script = config.script;
    const now = new Date();

    let parsedOptions: Record<string, unknown> = {};
    try { parsedOptions = typeof config.options === 'string' ? JSON.parse(config.options) : config.options as any; } catch { parsedOptions = {}; }

    const scriptEnvVars: Record<string, string> = safeJson(script.envVars);
    const configEnv: Record<string, string> = (parsedOptions.env as Record<string, string>) || {};
    const mergedEnv = { ...scriptEnvVars, ...configEnv };

    const defaultEnv = await prisma.environment.findFirst({
      where: { projectId: script.projectId, isDefault: true },
    });
    if (defaultEnv) {
      const envVars: Record<string, string> = safeJson(defaultEnv.variables);
      if (defaultEnv.baseUrl) envVars.TARGET_URL = defaultEnv.baseUrl;
      Object.assign(mergedEnv, envVars);
    }

    parsedOptions.env = mergedEnv;

    const resolvedProfile = (config as any).outputProfile || await prisma.outputProfile.findFirst({
      where: { projectId: script.projectId, isDefault: true },
    });
    if (resolvedProfile) {
      let profileConfig: Record<string, string> = {};
      try { profileConfig = JSON.parse(resolvedProfile.configJson); } catch {}
      if (!Array.isArray(parsedOptions.outputs)) parsedOptions.outputs = [];
      const existingIdx = (parsedOptions.outputs as any[]).findIndex(o => o.type === resolvedProfile.outputType);
      if (existingIdx === -1) {
        (parsedOptions.outputs as any[]).push({
          type: resolvedProfile.outputType,
          enabled: true,
          config: profileConfig,
        });
      } else if (!(parsedOptions.outputs as any[])[existingIdx].config?.url) {
        (parsedOptions.outputs as any[])[existingIdx].config = {
          ...(parsedOptions.outputs as any[])[existingIdx].config,
          ...profileConfig,
        };
        (parsedOptions.outputs as any[])[existingIdx].enabled = true;
      }
    }

    const outputs = (parsedOptions.outputs as any[]) || [];
    for (const out of outputs) {
      if (!out.enabled) continue;
      const info = OUTPUT_TYPES[out.type];
      if (!info) continue;
      if (out.type === 'cloud') {
        const project = await prisma.project.findUnique({
          where: { id: script.projectId },
          select: { k6CloudToken: true },
        });
        if (project?.k6CloudToken) mergedEnv.K6_CLOUD_TOKEN = project.k6CloudToken;
      }
      if (info.envMap) {
        for (const [fieldKey, envVarName] of Object.entries(info.envMap)) {
          const val = out.config[fieldKey];
          if (val) mergedEnv[envVarName] = val;
        }
      }
    }

    let scriptContent = script.content;
    if (mergedEnv.TARGET_URL) {
      scriptContent = scriptContent.replace(/__TARGET_URL__/g, mergedEnv.TARGET_URL);
    }

    const run = await prisma.testRun.create({
      data: {
        testConfigId: config.id,
        scriptId: script.id,
        projectId: script.projectId,
        userId: '00000000-0000-0000-0000-000000000000',
        status: 'pending',
        triggerType: 'schedule',
        optionsSnapshot: JSON.stringify(parsedOptions),
      },
    });

    const channel = getChannel();
    channel.sendToQueue(QUEUE_RUN_TEST, Buffer.from(JSON.stringify({
      runId: run.id,
      projectId: script.projectId,
      scriptContent,
      options: parsedOptions,
      prometheusPushUrl: config.prometheusPushUrl ?? undefined,
    })), { persistent: true });

    let nextRunAt: Date | null = null;
    try {
      const interval = CronExpressionParser.parse(schedule.cronExpr);
      nextRunAt = interval.next().toDate();
    } catch {
      logger.warn({ scheduleId, cronExpr: schedule.cronExpr }, 'Could not compute next run');
    }

    await prisma.schedule.update({
      where: { id: scheduleId },
      data: { lastRunAt: now, nextRunAt },
    });

    logger.info({ runId: run.id, scheduleId, triggerType: 'schedule' }, 'Scheduled run executed');
  }
}

export const scheduler = new Scheduler();
