import express from 'express';
import { execSync } from 'child_process';
import path from 'path';
import { prisma } from '../lib/prisma.js';

export { prisma };

const seedUserId = '00000000-0000-0000-0000-000000000000';
const seedProjectId = '00000000-0000-0000-0000-000000000001';

export function initTestDb() {
  const uniqueDb = `test-${process.env.VITEST_WORKER_ID || '0'}.db`;
  const testDbPath = path.join(__dirname, '..', '..', 'prisma', uniqueDb);
  process.env.DATABASE_URL = `file:${testDbPath}`;
  execSync('npx prisma db push --accept-data-loss 2>&1', {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
    stdio: 'pipe',
    timeout: 30000,
  });
}

export async function seedTestData() {
  await prisma.user.upsert({
    where: { id: seedUserId },
    update: {},
    create: { id: seedUserId, email: 'test@dev.local', name: 'Test Dev', passwordHash: '' },
  });

  await prisma.project.upsert({
    where: { id: seedProjectId },
    update: {},
    create: { id: seedProjectId, name: 'Test Project', description: 'Test', userId: seedUserId },
  });
}

export async function cleanTestData() {
  // Delete in reverse dependency order
  await prisma.slaBreach.deleteMany();
  await prisma.slaRule.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.dashboard.deleteMany();
  await prisma.testPlan.deleteMany();
  await prisma.databaseConnection.deleteMany();
  await prisma.alertEvent.deleteMany();
  await prisma.alertRule.deleteMany();
  await prisma.thresholdResult.deleteMany();
  await prisma.testResultPoint.deleteMany();
  await prisma.testResult.deleteMany();
  await prisma.testRun.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.testSuiteScript.deleteMany();
  await prisma.testSuite.deleteMany();
  await prisma.testConfig.deleteMany();
  await prisma.csvFile.deleteMany();
  await prisma.gitRepo.deleteMany();
  await prisma.environment.deleteMany();
  await prisma.script.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.personalAccessToken.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.plugin.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.project.deleteMany({ where: { id: { not: seedProjectId } } });
  await prisma.user.deleteMany({ where: { id: { not: seedUserId } } });
}

export function createTestApp() {
  const app = express();
  app.use(express.json());
  return app;
}

const __imports = 0; // dummy to ensure module is treated as ESM
