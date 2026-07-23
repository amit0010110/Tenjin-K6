// eslint-disable-next-line @typescript-eslint/no-require-imports
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TenjinT6 API',
      version: '1.0.0',
      description: 'REST API for the k6 performance testing platform — script management, test execution, result aggregation, alerting, scheduling, team collaboration, and k6 Cloud integration.',
    },
    servers: [
      { url: '/api/v1', description: 'API v1' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token or Personal Access Token (gp6_ prefix)',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            errors: {
              type: 'array',
              items: { type: 'object' },
              description: 'Validation error details (Zod issues)',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['user', 'admin'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            userId: { type: 'string', format: 'uuid' },
            k6CloudToken: { type: 'string', nullable: true, description: 'Masked token' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Script: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            version: { type: 'integer' },
            content: { type: 'string', description: 'k6 JavaScript test script' },
            envVars: { type: 'object', description: 'JSON object of environment variables' },
            tags: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        TestConfig: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            scriptId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            options: { type: 'object', description: 'k6 options (vus, duration, thresholds, outputs, etc.)' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        TestRun: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            testConfigId: { type: 'string', format: 'uuid', nullable: true },
            scriptId: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed', 'aborted'] },
            statusMessage: { type: 'string', nullable: true },
            startedAt: { type: 'string', format: 'date-time', nullable: true },
            finishedAt: { type: 'string', format: 'date-time', nullable: true },
            k6ExitCode: { type: 'integer', nullable: true },
            triggerType: { type: 'string', enum: ['manual', 'schedule', 'webhook', 'suite'] },
            cloudRunId: { type: 'string', nullable: true },
            cloudRunUrl: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        TestResult: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            testRunId: { type: 'string', format: 'uuid' },
            metricName: { type: 'string' },
            metricType: { type: 'string' },
            avg: { type: 'number', nullable: true },
            min: { type: 'number', nullable: true },
            max: { type: 'number', nullable: true },
            med: { type: 'number', nullable: true },
            p90: { type: 'number', nullable: true },
            p95: { type: 'number', nullable: true },
            p99: { type: 'number', nullable: true },
            count: { type: 'integer', nullable: true },
          },
        },
        Schedule: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            testConfigId: { type: 'string', format: 'uuid' },
            name: { type: 'string', nullable: true },
            cronExpr: { type: 'string', description: '5-field cron expression' },
            enabled: { type: 'boolean' },
            lastRunAt: { type: 'string', format: 'date-time', nullable: true },
            nextRunAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Environment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            baseUrl: { type: 'string', nullable: true },
            variables: { type: 'object' },
            isDefault: { type: 'boolean' },
          },
        },
        AlertRule: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            metricName: { type: 'string' },
            condition: { type: 'string', enum: ['gt', 'lt', 'gte', 'lte', 'eq'] },
            threshold: { type: 'number' },
            channelType: { type: 'string', enum: ['slack', 'webhook', 'email'] },
            channelConfig: { type: 'object' },
            enabled: { type: 'boolean' },
          },
        },
        ApiKey: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            key: { type: 'string', description: 'Full key shown only on creation' },
            lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        PersonalAccessToken: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            token: { type: 'string', description: 'Full token (gp6_ prefix) shown only on creation' },
            scopes: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
            lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Template: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            content: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
