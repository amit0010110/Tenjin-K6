import type { TestBlock } from './types';

/**
 * Helper to extract field map from ISO8583Sampler's collectionProp name="fields"
 */
function extractIsoFields(el: Element): Record<string, string> {
  const fields: Record<string, string> = {};
  const fieldsProp = el.querySelector('collectionProp[name="fields"]');
  if (!fieldsProp) return fields;

  for (const child of Array.from(fieldsProp.children)) {
    if (child.tagName.toLowerCase() === 'elementprop') {
      const nameAttr = child.getAttribute('name') || child.getAttribute('testname') || '';
      const contentEl = child.querySelector('stringProp[name="content"]');
      const contentVal = contentEl ? contentEl.textContent || '' : '';
      if (nameAttr && contentVal) {
        fields[nameAttr] = contentVal;
      }
    }
  }
  return fields;
}

/**
 * Converts enterprise JMeter elements (ISO 8583 banking sockets, JMS queues, and JSR223/BeanShell assertions)
 * into high-fidelity visual test blocks.
 */
export function convertEnterpriseElement(
  el: Element,
  tc: string,
  name: string,
  parseChildren: (parent: Element) => Element[],
  convertChild: (el: Element) => TestBlock | null,
  strProp: (el: Element, prop: string) => string,
  intProp: (el: Element, prop: string, def?: number) => number,
  toBlock: (type: string, overrides?: Partial<TestBlock>) => TestBlock
): TestBlock | null {
  // 1. ISO 8583 Financial Socket Configuration (nz.co.breakpoint.jmeter.iso8583.ISO8583Config)
  if (tc === 'ISO8583Config' || tc === 'nz.co.breakpoint.jmeter.iso8583.ISO8583Config') {
    const host = strProp(el, 'host') || 'localhost';
    const port = strProp(el, 'port') || '5000';
    const classname = strProp(el, 'classname') || 'ASCIIChannel';
    const packager = strProp(el, 'packager') || '/csv/ISO_CFG_XML.xml';
    const keystore = strProp(el, 'keystore') || '';
    const keyPassword = strProp(el, 'keyPassword') || '';

    return toBlock('iso8583', {
      label: name || 'ISO 8583 Socket Config',
      properties: {
        transport: 'tcp-binary',
        tcpHost: host,
        tcpPort: port,
        tcpHeaderType: classname.toLowerCase().includes('2byte') ? '2byte' : 'none',
        dataFormat: 'json',
        customFields: JSON.stringify({ packager, classname, keystore, hasSsl: !!keystore }),
      },
    });
  }

  // 2. ISO 8583 Financial Message Sampler (nz.co.breakpoint.jmeter.iso8583.ISO8583Sampler)
  if (tc === 'ISO8583Sampler' || tc === 'nz.co.breakpoint.jmeter.iso8583.ISO8583Sampler') {
    const fields = extractIsoFields(el);
    const mti = fields['0'] || '0200';
    const pan = fields['2'] || '';
    const processingCode = fields['3'] || '301000';
    const amount = fields['4'] || '000000000000';
    const stan = fields['11'] || '';
    const timeout = intProp(el, 'timeout', 20000);
    const successCode = strProp(el, 'successResponseCode') || '000';

    // Remove core fields from custom fields dictionary
    const customMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (!['0', '2', '3', '4', '11'].includes(k)) {
        customMap[k] = v;
      }
    }

    const children = parseChildren(el).map(convertChild).filter(Boolean) as TestBlock[];

    return toBlock('iso8583', {
      label: name || `ISO 8583 (${mti} - ${processingCode})`,
      properties: {
        mti,
        pan,
        processingCode,
        amount,
        stan,
        transport: 'tcp-binary',
        tcpHost: '${ISO_HOST}',
        tcpPort: '${ISO_PORT}',
        dataFormat: 'json',
        customFields: JSON.stringify({ ...customMap, timeout, expectedCode: successCode }),
      },
      children,
    });
  }

  // 3. JMS Samplers & Queues (JMSSampler, JMSPublisher, JMSSubscriber)
  if (['JMSSampler', 'JMSPublisher', 'JMSSubscriber'].includes(tc)) {
    const providerUrl = strProp(el, 'JMSSampler.ProviderUrl') || strProp(el, 'jms.provider_url') || 'amqp://localhost';
    const destination = strProp(el, 'JMSSampler.Topic') || strProp(el, 'jms.topic') || strProp(el, 'jms.destination') || 'test-queue';
    const content = strProp(el, 'JMSSampler.Content') || strProp(el, 'jms.text_message') || '';
    const children = parseChildren(el).map(convertChild).filter(Boolean) as TestBlock[];

    return toBlock('script', {
      label: name || `JMS ${tc.replace('JMS', '')}`,
      properties: {
        code: `// JMS Message (${tc}) -> ${destination}\n// Provider: ${providerUrl}\nconst payload = ${JSON.stringify(content || { message: 'hello jms' })};\n// Send via k6 worker socket / queue engine`,
      },
      children,
    });
  }

  // 4. JSR223 & BeanShell Assertions
  if (tc === 'JSR223Assertion' || tc === 'BeanShellAssertion') {
    const script = strProp(el, 'JSR223.script') || strProp(el, 'BeanShellAssertion.script') || '';
    return toBlock('check', {
      label: name || 'Custom Script Assertion',
      properties: {
        target: 'custom-script',
        operator: '==',
        expected: 'true',
        scriptCode: script || '// Custom assertion code',
      },
    });
  }

  return null;
}
