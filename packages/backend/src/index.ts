import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { connectRabbitMQ, closeRabbitMQ } from './lib/rabbitmq.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';

// Patch Express 4 to forward async handler rejections to next(err)
// Without this, every async route handler that throws produces an
// unhandled promise rejection that crashes the Node process.
// Patch Express 4 to forward async handler rejections to next(err)
// @ts-ignore - express internals
import ExpressLayer from 'express/lib/router/layer.js';
const origHandle = ExpressLayer.prototype.handle_request;
ExpressLayer.prototype.handle_request = function (req: any, res: any, next: any) {
  const result = origHandle.call(this, req, res, next);
  if (result && typeof result.catch === 'function') {
    result.catch(next);
  }
  return result;
};
import { scriptRoutes } from './routes/scripts.js';
import { configRoutes } from './routes/configs.js';
import { runRoutes } from './routes/runs.js';
import { dashboardRoutes as dashboardAnalyticsRoutes } from './routes/dashboard.js';
import { scheduleRoutes } from './routes/schedules.js';
import { authRoutes } from './routes/auth.js';
import { webhookRoutes, webhookTriggerRoutes } from './routes/webhooks.js';
import { templateRoutes } from './routes/templates.js';
import { comparisonRoutes } from './routes/comparison.js';
import { validationRoutes } from './routes/validation.js';
import { environmentRoutes } from './routes/environments.js';
import { memberRoutes } from './routes/members.js';
import { csvRoutes } from './routes/csv.js';
import { alertRoutes } from './routes/alerts.js';
import { exportRoutes } from './routes/export.js';
import { gitRoutes } from './routes/git.js';
import { suiteRoutes } from './routes/suites.js';
import { projectRoutes } from './routes/projects.js';
import { patRoutes } from './routes/pats.js';
import { retentionRoutes } from './routes/retention.js';
import { workerRoutes } from './routes/workers.js';
import { correlationRoutes } from './routes/correlation.js';
import { regressionRoutes } from './routes/regression.js';
import { slaRoutes } from './routes/sla.js';
import { budgetRoutes } from './routes/budget.js';
import { auditRoutes } from './routes/audit.js';
import { pluginRoutes } from './routes/plugins.js';
import { dashboardsRoutes } from './routes/dashboards.js';
import { planRoutes } from './routes/plans.js';
import { dbConnectionRoutes } from './routes/db-connections.js';
import { outputProfilesRouter } from './routes/outputProfiles.js';
import { recordingRoutes } from './routes/recording.js';
import { swaggerRoutes } from './routes/swagger.js';
import { startWorker, runner, resultIngester } from './workers/index.js';
import { setupWebSocket, shutdownWebSocket } from './routes/ws.js';
import { startRetentionCleanup, stopRetentionCleanup } from './workers/retentionCleanup.js';
import { scheduler } from './scheduler/index.js';

const app = express();
const httpServer = createServer(app);
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger API docs (public)
app.use('/api', swaggerRoutes);

// Public routes (no auth required)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/webhooks', webhookTriggerRoutes);

// Auth middleware for all remaining API routes
app.use('/api/v1', authMiddleware);

// Protected routes
app.use('/api/v1/webhooks', webhookRoutes); // key management (needs auth)

// Protected routes
app.use('/api/v1', templateRoutes);
app.use('/api/v1', comparisonRoutes);
app.use('/api/v1', validationRoutes);
app.use('/api/v1', environmentRoutes);
app.use('/api/v1', memberRoutes);
app.use('/api/v1', csvRoutes);
app.use('/api/v1', alertRoutes);
app.use('/api/v1', exportRoutes);
app.use('/api/v1', gitRoutes);
app.use('/api/v1', scriptRoutes);
app.use('/api/v1', configRoutes);
app.use('/api/v1', runRoutes);
app.use('/api/v1', dashboardAnalyticsRoutes);
app.use('/api/v1', dashboardsRoutes);
app.use('/api/v1', scheduleRoutes);
app.use('/api/v1', suiteRoutes);
app.use('/api/v1', projectRoutes);
app.use('/api/v1', patRoutes);
app.use('/api/v1', retentionRoutes);
app.use('/api/v1', workerRoutes);
app.use('/api/v1', correlationRoutes);
app.use('/api/v1', regressionRoutes);
app.use('/api/v1', slaRoutes);
app.use('/api/v1', budgetRoutes);
app.use('/api/v1', auditRoutes);
app.use('/api/v1', pluginRoutes);
app.use('/api/v1', planRoutes);
app.use('/api/v1', dbConnectionRoutes);
app.use('/api/v1', outputProfilesRouter);
app.use('/api/v1', recordingRoutes);

// Error handler
app.use(errorHandler);

async function start(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL');

    await connectRabbitMQ();

    // Start worker in same process (or scale separately)
    await startWorker();

    // Setup WebSocket
    await setupWebSocket(httpServer);

    // Start retention cleanup scheduler
    startRetentionCleanup();

    // Start cron-based schedule engine
    await scheduler.start();

    httpServer.listen(PORT, () => {
      logger.info(`Backend listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  logger.info('Shutting down...');

  runner.abortAll();

  resultIngester.destroy();
  scheduler.stop();
  stopRetentionCleanup();
  shutdownWebSocket();
  await closeRabbitMQ();
  await prisma.$disconnect();
  httpServer.close();
  process.exit(0);
}

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection — exiting');
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
