import { vi } from 'vitest';

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

// Mock RabbitMQ to avoid needing a running instance
vi.mock('../lib/rabbitmq.js', () => ({
  QUEUE_RUN_TEST: 'run-test',
  QUEUE_RESULT_POINT: 'result-point',
  connectRabbitMQ: vi.fn().mockResolvedValue(undefined),
  getChannel: vi.fn().mockReturnValue({
    sendToQueue: vi.fn(),
    assertQueue: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  }),
  closeRabbitMQ: vi.fn().mockResolvedValue(undefined),
}));
