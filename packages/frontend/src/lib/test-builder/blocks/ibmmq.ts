import type { BlockTypeDefinition, BlockType } from '../types';

export const ibmmq: Partial<Record<BlockType, BlockTypeDefinition>> = {
  'ibmmq': {
    type: 'ibmmq',
    label: 'IBM MQ (Native / AMQP)',
    icon: 'MessageSquare',
    description: 'Put, get, or browse messages on IBM MQ queues and topics',
    color: 'indigo',
    canHaveChildren: true,
    defaultProperties: {
      operation: 'put',
      clientType: 'amqp',
      qMgrName: 'QM1',
      channel: 'DEV.APP.SVRCONN',
      host: 'localhost',
      port: '1414',
      queueName: 'DEV.QUEUE.1',
      username: 'app',
      password: '',
      messagePayload: '{"event":"TRANSACTION_INIT","amount":150.00,"currency":"USD"}',
    },
    fields: [
      {
        key: 'operation', label: 'Operation', type: 'select', required: true,
        options: [
          { label: 'Put Message (MQPUT / Publish)', value: 'put' },
          { label: 'Get Message (MQGET / Consume)', value: 'get' },
        ],
      },
      {
        key: 'clientType', label: 'Client Connection Protocol', type: 'select', required: true,
        options: [
          { label: 'AMQP 0-9-1 / JMS Bridge (Pure Go - xk6-amqp)', value: 'amqp' },
          { label: 'IBM MQ Native C API (Requires /opt/mqm C SDK - xk6-ibmmq)', value: 'native' },
        ],
      },
      { key: 'qMgrName', label: 'Queue Manager Name (QMgr)', type: 'string', placeholder: 'QM1', required: true, defaultValue: 'QM1' },
      { key: 'channel', label: 'Server Connection Channel', type: 'string', placeholder: 'DEV.APP.SVRCONN', defaultValue: 'DEV.APP.SVRCONN' },
      { key: 'host', label: 'IBM MQ Hostname', type: 'string', placeholder: 'localhost', required: true, defaultValue: 'localhost' },
      { key: 'port', label: 'Listener Port', type: 'string', placeholder: '1414', defaultValue: '1414' },
      { key: 'queueName', label: 'Queue / Topic Name', type: 'string', placeholder: 'DEV.QUEUE.1', required: true, defaultValue: 'DEV.QUEUE.1' },
      { key: 'username', label: 'Username', type: 'string', placeholder: 'app', defaultValue: 'app' },
      { key: 'password', label: 'Password', type: 'string', placeholder: 'Optional password', defaultValue: '' },
      { key: 'messagePayload', label: 'Message Payload (JSON / XML / Text)', type: 'code', placeholder: 'Payload content...', defaultValue: '{"event":"TRANSACTION_INIT","amount":150.00,"currency":"USD"}', showIf: { key: 'operation', value: 'put' } },
    ],
  },
};
