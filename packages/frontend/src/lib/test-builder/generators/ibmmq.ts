import { TestBlock } from '../types';

export function genIbmmq(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const lines: string[] = [];
  const operation = p.operation || 'put';
  const clientType = p.clientType || 'amqp';
  const qMgrName = p.qMgrName || 'QM1';
  const channel = p.channel || 'DEV.APP.SVRCONN';
  const host = p.host || 'localhost';
  const port = p.port || '1414';
  const queueName = p.queueName || 'DEV.QUEUE.1';
  const user = p.username || 'app';
  const password = p.password || '';
  const messagePayload = p.messagePayload || '';

  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');

  lines.push(`${pad}// IBM MQ Operation (${operation.toUpperCase()}) over ${clientType === 'amqp' ? 'AMQP 0-9-1 / JMS Bridge' : 'IBM MQ Native C API'}`);
  lines.push(`${pad}var startTime = Date.now();`);
  lines.push(`${pad}var status = 200;`);
  if (clientType === 'amqp') {
    lines.push(`${pad}var url = 'amqp://${user && password ? `${user}:${password}@` : ''}${host}:${port}/';`);
    lines.push(`${pad}try {`);
    lines.push(`${pad}  var conn = amqp.connect(url);`);
    lines.push(`${pad}  var ch = conn.channel();`);
    if (operation === 'put') {
      lines.push(`${pad}  ch.publish('${queueName}', '', \`${esc(messagePayload)}\`);`);
    } else {
      lines.push(`${pad}  var msg = ch.consume('${queueName}');`);
    }
    lines.push(`${pad}  ch.close();`);
    lines.push(`${pad}  conn.close();`);
    lines.push(`${pad}} catch (err) {`);
    lines.push(`${pad}  status = 500;`);
    lines.push(`${pad}  console.error('IBM MQ (AMQP Bridge) ${operation} failed: ' + err);`);
    lines.push(`${pad}}`);
  } else {
    lines.push(`${pad}try {`);
    lines.push(`${pad}  var qMgr = ibmmq.connect({`);
    lines.push(`${pad}    qMgrName: '${qMgrName}',`);
    lines.push(`${pad}    channel: '${channel}',`);
    lines.push(`${pad}    connection: '${host}:${port}',`);
    lines.push(`${pad}    username: '${user}',`);
    if (password) lines.push(`${pad}    password: '${password}',`);
    lines.push(`${pad}  });`);
    lines.push(`${pad}  var q = ibmmq.openQueue(qMgr, '${queueName}', ${operation === 'put' ? 'ibmmq.MQOO_OUTPUT' : 'ibmmq.MQOO_INPUT_AS_Q_DEF'});`);
    if (operation === 'put') {
      lines.push(`${pad}  ibmmq.put(q, \`${esc(messagePayload)}\`);`);
    } else {
      lines.push(`${pad}  var msg = ibmmq.get(q);`);
    }
    lines.push(`${pad}  ibmmq.close(q);`);
    lines.push(`${pad}  ibmmq.disconnect(qMgr);`);
    lines.push(`${pad}} catch (err) {`);
    lines.push(`${pad}  status = 500;`);
    lines.push(`${pad}  console.error('IBM MQ Native ${operation} failed: ' + err);`);
    lines.push(`${pad}}`);
  }
  lines.push(`${pad}if (typeof __logRequest !== 'undefined') __logRequest("IBMMQ-${operation.toUpperCase()}", '${qMgrName}/${queueName}', status, '${operation === 'put' ? esc(messagePayload.slice(0, 100)) : ''}', '{}', Date.now() - startTime);`);

  for (const child of block.children.filter(c => c.enabled)) {
    const childCode = genBlock(child, indent + 1, ctx);
    if (childCode) lines.push(childCode);
  }
  return lines.join('\n');
}
