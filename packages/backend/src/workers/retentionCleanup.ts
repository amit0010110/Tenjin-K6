import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const DEFAULT_RETENTION_DAYS = 90;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day

async function purgeProject(projectId: string, olderThanDays: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const oldRuns = await prisma.testRun.findMany({
    where: { projectId, createdAt: { lt: cutoff } },
    select: { id: true },
  });

  const runIds = oldRuns.map((r) => r.id);
  if (runIds.length === 0) return 0;

  await prisma.testRun.deleteMany({ where: { id: { in: runIds } } });
  return runIds.length;
}

export async function runRetentionCleanup(): Promise<void> {
  const projects = await prisma.project.findMany({ select: { id: true } });

  let totalDeleted = 0;
  for (const project of projects) {
    const deleted = await purgeProject(project.id, DEFAULT_RETENTION_DAYS);
    totalDeleted += deleted;
  }

  if (totalDeleted > 0) {
    logger.info({ deletedRuns: totalDeleted, projects: projects.length }, 'Retention cleanup completed');
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startRetentionCleanup(): void {
  logger.info('Starting retention cleanup scheduler (every 24h)');
  runRetentionCleanup().catch((err) => logger.error({ err }, 'Initial retention cleanup failed'));
  intervalHandle = setInterval(() => {
    runRetentionCleanup().catch((err) => logger.error({ err }, 'Retention cleanup failed'));
  }, CLEANUP_INTERVAL_MS);
}

export function stopRetentionCleanup(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
