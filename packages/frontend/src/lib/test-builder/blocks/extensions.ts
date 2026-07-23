import type { BlockTypeDefinition, BlockType } from '../types';

export const extensions: Partial<Record<BlockType, BlockTypeDefinition>> = {
  'kafka': {
    type: 'kafka',
    label: 'Apache Kafka',
    icon: 'Radio',
    description: 'Produce or consume messages to Apache Kafka topics using xk6-kafka',
    color: 'orange',
    canHaveChildren: true,
    defaultProperties: {
      operation: 'produce',
      brokers: 'localhost:9092',
      topic: 'load-test-topic',
      messageKey: 'user-key-1',
      messagePayload: '{"event":"USER_LOGIN","timestamp":1710000000}',
    },
    fields: [
      {
        key: 'operation', label: 'Operation', type: 'select', required: true,
        options: [
          { label: 'Produce Message (Writer)', value: 'produce' },
          { label: 'Consume Message (Reader)', value: 'consume' },
        ],
      },
      { key: 'brokers', label: 'Kafka Broker(s)', type: 'string', placeholder: 'localhost:9092', required: true, defaultValue: 'localhost:9092' },
      { key: 'topic', label: 'Topic Name', type: 'string', placeholder: 'load-test-topic', required: true, defaultValue: 'load-test-topic' },
      { key: 'messageKey', label: 'Message Key', type: 'string', placeholder: 'user-key-1', defaultValue: 'user-key-1', showIf: { key: 'operation', value: 'produce' } },
      { key: 'messagePayload', label: 'Message Payload JSON/Text', type: 'code', placeholder: 'JSON payload...', defaultValue: '{"event":"USER_LOGIN","timestamp":1710000000}', showIf: { key: 'operation', value: 'produce' } },
    ],
  },
  'redis': {
    type: 'redis',
    label: 'Redis Cache & Pub/Sub',
    icon: 'Database',
    description: 'Execute Redis commands (SET, GET, DEL) using xk6-redis',
    color: 'red',
    canHaveChildren: true,
    defaultProperties: {
      operation: 'set',
      address: 'localhost:6379',
      password: '',
      key: 'session:user:101',
      value: '{"token":"xyz123","active":true}',
      expirationSeconds: '3600',
    },
    fields: [
      {
        key: 'operation', label: 'Command', type: 'select', required: true,
        options: [
          { label: 'SET (Store Value with Expiration)', value: 'set' },
          { label: 'GET (Retrieve Value)', value: 'get' },
          { label: 'DEL (Delete Key)', value: 'del' },
        ],
      },
      { key: 'address', label: 'Redis Address', type: 'string', placeholder: 'localhost:6379', required: true, defaultValue: 'localhost:6379' },
      { key: 'password', label: 'Password / Auth', type: 'string', placeholder: 'Optional password', defaultValue: '' },
      { key: 'key', label: 'Redis Key', type: 'string', placeholder: 'session:user:101', required: true, defaultValue: 'session:user:101' },
      { key: 'value', label: 'Value to SET', type: 'code', placeholder: 'Value content...', defaultValue: '{"token":"xyz123","active":true}', showIf: { key: 'operation', value: 'set' } },
      { key: 'expirationSeconds', label: 'TTL / Expiration (Seconds)', type: 'string', placeholder: '3600', defaultValue: '3600', showIf: { key: 'operation', value: 'set' } },
    ],
  },
  'mqtt': {
    type: 'mqtt',
    label: 'MQTT IoT Protocol',
    icon: 'Activity',
    description: 'Connect, publish telemetry, and subscribe to IoT topics using xk6-mqtt',
    color: 'teal',
    canHaveChildren: true,
    defaultProperties: {
      operation: 'publish',
      brokerUrl: 'tcp://localhost:1883',
      topic: 'iot/sensors/temperature',
      qos: '1',
      messagePayload: '{"sensorId":"DEV_01","temp":24.5,"unit":"C"}',
    },
    fields: [
      {
        key: 'operation', label: 'Operation', type: 'select', required: true,
        options: [
          { label: 'Publish Telemetry Message', value: 'publish' },
          { label: 'Subscribe & Listen to Topic', value: 'subscribe' },
        ],
      },
      { key: 'brokerUrl', label: 'MQTT Broker URL', type: 'string', placeholder: 'tcp://localhost:1883', required: true, defaultValue: 'tcp://localhost:1883' },
      { key: 'topic', label: 'Topic Path', type: 'string', placeholder: 'iot/sensors/temperature', required: true, defaultValue: 'iot/sensors/temperature' },
      {
        key: 'qos', label: 'Quality of Service (QoS)', type: 'select', required: true,
        options: [
          { label: 'QoS 0 - At most once', value: '0' },
          { label: 'QoS 1 - At least once', value: '1' },
          { label: 'QoS 2 - Exactly once', value: '2' },
        ],
      },
      { key: 'messagePayload', label: 'Message Payload', type: 'code', placeholder: 'JSON telemetry...', defaultValue: '{"sensorId":"DEV_01","temp":24.5,"unit":"C"}', showIf: { key: 'operation', value: 'publish' } },
    ],
  },
};
