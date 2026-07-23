import { TestBlock } from '../types';

export function genKafka(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const lines: string[] = [];
  const operation = p.operation || 'produce';
  const brokers = (p.brokers || 'localhost:9092').split(',').map((s: string) => `'${s.trim()}'`).join(', ');
  const topic = p.topic || 'load-test-topic';
  const key = p.messageKey || 'key-1';
  const payload = p.messagePayload || '';
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');

  lines.push(`${pad}// Apache Kafka (${operation.toUpperCase()}) to topic: ${topic}`);
  lines.push(`${pad}var startTime = Date.now();`);
  lines.push(`${pad}var status = 200;`);
  lines.push(`${pad}try {`);
  if (operation === 'produce') {
    lines.push(`${pad}  var writer = new kafka.Writer({ brokers: [${brokers}], topic: '${topic}' });`);
    lines.push(`${pad}  writer.produce({ messages: [{ key: '${key}', value: \`${esc(payload)}\` }] });`);
    lines.push(`${pad}  writer.close();`);
  } else {
    lines.push(`${pad}  var reader = new kafka.Reader({ brokers: [${brokers}], topic: '${topic}' });`);
    lines.push(`${pad}  var messages = reader.consume({ limit: 1 });`);
    lines.push(`${pad}  reader.close();`);
  }
  lines.push(`${pad}} catch (err) {`);
  lines.push(`${pad}  status = 500;`);
  lines.push(`${pad}  console.error('Kafka ${operation} error: ' + err);`);
  lines.push(`${pad}}`);
  lines.push(`${pad}if (typeof __logRequest !== 'undefined') __logRequest("KAFKA-${operation.toUpperCase()}", '${topic}', status, '${operation === 'produce' ? esc(payload.slice(0, 100)) : ''}', '{}', Date.now() - startTime);`);

  for (const child of block.children.filter(c => c.enabled)) {
    const childCode = genBlock(child, indent + 1, ctx);
    if (childCode) lines.push(childCode);
  }
  return lines.join('\n');
}

export function genRedis(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const lines: string[] = [];
  const operation = p.operation || 'set';
  const address = p.address || 'localhost:6379';
  const password = p.password || '';
  const key = p.key || 'test:key';
  const value = p.value || '';
  const ttl = p.expirationSeconds || '3600';
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');

  lines.push(`${pad}// Redis Command (${operation.toUpperCase()}) for key: ${key}`);
  lines.push(`${pad}var startTime = Date.now();`);
  lines.push(`${pad}var status = 200;`);
  lines.push(`${pad}var redisClient = new redis.Client({ addr: '${address}'${password ? `, password: '${password}'` : ''} });`);
  lines.push(`${pad}try {`);
  if (operation === 'set') {
    lines.push(`${pad}  redisClient.set('${key}', \`${esc(value)}\`, ${parseInt(ttl, 10) || 3600});`);
  } else if (operation === 'get') {
    lines.push(`${pad}  var val = redisClient.get('${key}');`);
  } else {
    lines.push(`${pad}  redisClient.del('${key}');`);
  }
  lines.push(`${pad}} catch (err) {`);
  lines.push(`${pad}  status = 500;`);
  lines.push(`${pad}  console.error('Redis ${operation} error: ' + err);`);
  lines.push(`${pad}}`);
  lines.push(`${pad}if (typeof __logRequest !== 'undefined') __logRequest("REDIS-${operation.toUpperCase()}", '${key}', status, '${operation === 'set' ? esc(value.slice(0, 100)) : ''}', '{}', Date.now() - startTime);`);

  for (const child of block.children.filter(c => c.enabled)) {
    const childCode = genBlock(child, indent + 1, ctx);
    if (childCode) lines.push(childCode);
  }
  return lines.join('\n');
}

export function genMqtt(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const lines: string[] = [];
  const operation = p.operation || 'publish';
  const brokerUrl = p.brokerUrl || 'tcp://localhost:1883';
  const topic = p.topic || 'test/topic';
  const qos = p.qos || '1';
  const payload = p.messagePayload || '';
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');

  lines.push(`${pad}// MQTT IoT (${operation.toUpperCase()}) on topic: ${topic}`);
  lines.push(`${pad}var startTime = Date.now();`);
  lines.push(`${pad}var status = 200;`);
  lines.push(`${pad}var mqttClient = new mqtt.Client({ url: '${brokerUrl}' });`);
  lines.push(`${pad}try {`);
  lines.push(`${pad}  mqttClient.connect();`);
  if (operation === 'publish') {
    lines.push(`${pad}  mqttClient.publish('${topic}', \`${esc(payload)}\`, ${parseInt(qos, 10) || 1});`);
  } else {
    lines.push(`${pad}  mqttClient.subscribe('${topic}', ${parseInt(qos, 10) || 1});`);
  }
  lines.push(`${pad}  mqttClient.close();`);
  lines.push(`${pad}} catch (err) {`);
  lines.push(`${pad}  status = 500;`);
  lines.push(`${pad}  console.error('MQTT ${operation} error: ' + err);`);
  lines.push(`${pad}}`);
  lines.push(`${pad}if (typeof __logRequest !== 'undefined') __logRequest("MQTT-${operation.toUpperCase()}", '${topic}', status, '${operation === 'publish' ? esc(payload.slice(0, 100)) : ''}', '{}', Date.now() - startTime);`);

  for (const child of block.children.filter(c => c.enabled)) {
    const childCode = genBlock(child, indent + 1, ctx);
    if (childCode) lines.push(childCode);
  }
  return lines.join('\n');
}
