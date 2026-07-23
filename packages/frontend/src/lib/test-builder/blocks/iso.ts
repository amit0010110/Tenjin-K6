import type { BlockTypeDefinition, BlockType } from '../types';

export const iso: Partial<Record<BlockType, BlockTypeDefinition>> = {
  'iso8583': {
    type: 'iso8583',
    label: 'ISO 8583',
    icon: 'CreditCard',
    description: 'Send an ISO 8583 financial transaction message',
    color: 'amber',
    canHaveChildren: true,
    defaultProperties: {
      mti: '0200',
      pan: '',
      processingCode: '301000',
      amount: '000000010000',
      stan: '',
      transmissionDate: '',
      transmissionTime: '',
      endpoint: '${__ENV.TARGET_URL}/iso8583',
      transport: 'http-json',
      tcpHost: '192.168.1.100',
      tcpPort: '5000',
      tcpHeaderType: '2byte',
      dataFormat: 'json',
      customFields: '',
    },
    fields: [
      {
        key: 'mti', label: 'MTI', type: 'select', required: true,
        options: [
          { label: '0100 - Authorization Request', value: '0100' },
          { label: '0110 - Authorization Response', value: '0110' },
          { label: '0120 - Authorization Advice', value: '0120' },
          { label: '0200 - Financial Transaction Request', value: '0200' },
          { label: '0210 - Financial Transaction Response', value: '0210' },
          { label: '0220 - Financial Transaction Advice', value: '0220' },
          { label: '0400 - Reversal Request', value: '0400' },
          { label: '0420 - Reversal Advice', value: '0420' },
          { label: '0800 - Network Management', value: '0800' },
          { label: '0810 - Network Management Response', value: '0810' },
        ],
      },
      { key: 'pan', label: 'PAN (DE 2)', type: 'string', placeholder: 'Primary Account Number', defaultValue: '' },
      { key: 'processingCode', label: 'Processing Code (DE 3)', type: 'string', placeholder: '301000', defaultValue: '301000' },
      { key: 'amount', label: 'Amount (DE 4)', type: 'string', placeholder: '000000010000 (12 digits)', defaultValue: '000000010000' },
      { key: 'stan', label: 'STAN (DE 11)', type: 'string', placeholder: 'System trace audit number', defaultValue: '' },
      { key: 'transmissionDate', label: 'Transmission Date (DE 12)', type: 'string', placeholder: 'MMDD', defaultValue: '' },
      { key: 'transmissionTime', label: 'Transmission Time (DE 13)', type: 'string', placeholder: 'HHMMSS', defaultValue: '' },
      { key: 'customFields', label: 'Custom DE Fields (JSON)', type: 'json', placeholder: '{"48":"additional data","62":"reserved"}', defaultValue: '' },
      {
        key: 'transport', label: 'Transport', type: 'select', required: true,
        options: [
          { label: 'HTTP (JSON)', value: 'http-json' },
          { label: 'TCP (Binary - xk6)', value: 'tcp-binary' },
        ],
      },
      { key: 'endpoint', label: 'HTTP Endpoint URL', type: 'string', placeholder: 'https://...', required: true, defaultValue: '${__ENV.TARGET_URL}/iso8583', showIf: { key: 'transport', value: 'http-json' } },
      { key: 'tcpHost', label: 'TCP Host', type: 'string', placeholder: '192.168.1.100', defaultValue: '192.168.1.100', showIf: { key: 'transport', value: 'tcp-binary' } },
      { key: 'tcpPort', label: 'TCP Port', type: 'string', placeholder: '5000', defaultValue: '5000', showIf: { key: 'transport', value: 'tcp-binary' } },
      {
        key: 'tcpHeaderType', label: 'TCP Header', type: 'select', showIf: { key: 'transport', value: 'tcp-binary' },
        options: [
          { label: '2-byte length prefix (ISO 8583 standard)', value: '2byte' },
          { label: '4-byte length prefix', value: '4byte' },
          { label: 'Fixed length (no header)', value: 'none' },
        ],
      },
      {
        key: 'dataFormat', label: 'Payload Format', type: 'select', required: true,
        options: [
          { label: 'JSON (default)', value: 'json' },
          { label: 'Hex string', value: 'hex' },
        ],
      },
    ],
  },
  'iso20022': {
    type: 'iso20022',
    label: 'ISO 20022',
    icon: 'FileText',
    description: 'Send an ISO 20022 XML financial message',
    color: 'emerald',
    canHaveChildren: true,
    defaultProperties: {
      messageType: 'pain.001.001.03',
      xmlBody: '<?xml version="1.0" encoding="UTF-8"?>\n<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">\n  <CstmrCdtTrfInitn>\n    <GrpHdr>\n      <MsgId>MSG-${__ITER}</MsgId>\n      <CreDtTm>2024-01-01T12:00:00</CreDtTm>\n      <NbOfTxs>1</NbOfTxs>\n      <InitgPty><Nm>Test Company</Nm></InitgPty>\n    </GrpHdr>\n  </CstmrCdtTrfInitn>\n</Document>',
      endpoint: '${__ENV.TARGET_URL}/payments',
      contentType: 'application/xml',
    },
    fields: [
      {
        key: 'messageType', label: 'Message Type', type: 'select', required: true,
        options: [
          { label: 'pain.001.001.03 - Customer Credit Transfer', value: 'pain.001.001.03' },
          { label: 'pain.002.001.03 - Payment Status Report', value: 'pain.002.001.03' },
          { label: 'pacs.008.001.02 - FIToFICustomerCreditTransfer', value: 'pacs.008.001.02' },
          { label: 'pacs.002.001.03 - FIToFIPaymentStatusReport', value: 'pacs.002.001.03' },
          { label: 'camt.053.001.02 - BankToCustomerStatement', value: 'camt.053.001.02' },
          { label: 'camt.054.001.02 - BankToCustomerDebitCreditNotification', value: 'camt.054.001.02' },
        ],
      },
      { key: 'xmlBody', label: 'XML Body', type: 'code', placeholder: 'XML message content', defaultValue: '' },
      { key: 'endpoint', label: 'Endpoint URL', type: 'string', placeholder: 'https://...', required: true, defaultValue: '${__ENV.TARGET_URL}/payments' },
      {
        key: 'contentType', label: 'Content Type', type: 'select', required: true,
        options: [
          { label: 'application/xml', value: 'application/xml' },
          { label: 'text/xml', value: 'text/xml' },
          { label: 'application/soap+xml', value: 'application/soap+xml' },
        ],
      },
    ],
  },
};
