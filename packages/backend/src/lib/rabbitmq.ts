import amqp from 'amqplib';
import { logger } from './logger.js';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
let connection: any = null;
let channel: any = null;

export const QUEUE_RUN_TEST = 'run-test';
export const QUEUE_RESULT_POINT = 'result-point';

export async function connectRabbitMQ(): Promise<void> {
  const conn = await amqp.connect(RABBITMQ_URL);
  connection = conn;
  channel = await conn.createChannel();

  await channel.assertQueue(QUEUE_RUN_TEST, { durable: true });
  await channel.assertQueue(QUEUE_RESULT_POINT, { durable: true });

  logger.info('Connected to RabbitMQ');
}

export function getChannel(): any {
  if (!channel) throw new Error('RabbitMQ not connected');
  return channel;
}

export async function closeRabbitMQ(): Promise<void> {
  if (channel) await channel.close();
  if (connection) await connection.close();
}
