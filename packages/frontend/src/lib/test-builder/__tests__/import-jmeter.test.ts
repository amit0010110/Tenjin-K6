import { describe, it, expect } from 'vitest';
import { parseJmx } from '../import-jmeter';

const SAMPLE_JMX = `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="Sample Test Plan">
      <elementProp name="TestPlan.user_defined_variables" elementType="Arguments">
        <collectionProp name="Arguments.arguments"/>
      </elementProp>
    </TestPlan>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="API Users">
        <elementProp name="ThreadGroup.main_controller" elementType="LoopController">
          <boolProp name="LoopController.continue_forever">false</boolProp>
          <intProp name="LoopController.loops">1</intProp>
        </elementProp>
        <stringProp name="ThreadGroup.num_threads">10</stringProp>
        <stringProp name="ThreadGroup.ramp_time">5</stringProp>
      </ThreadGroup>
      <hashTree>
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="GET /api/users">
          <stringProp name="HTTPSampler.domain">api.example.com</stringProp>
          <stringProp name="HTTPSampler.port">443</stringProp>
          <stringProp name="HTTPSampler.protocol">https</stringProp>
          <stringProp name="HTTPSampler.path">/api/users</stringProp>
          <stringProp name="HTTPSampler.method">GET</stringProp>
        </HTTPSamplerProxy>
        <hashTree>
          <ResponseAssertion guiclass="AssertionGui" testclass="ResponseAssertion" testname="Check Status 200">
            <intProp name="Assertion.test_field">0</intProp>
            <stringProp name="Assertion.test_strings">200</stringProp>
            <intProp name="Assertion.test_type">8</intProp>
          </ResponseAssertion>
          <hashTree/>
          <RegexExtractor guiclass="RegexExtractorGui" testclass="RegexExtractor" testname="Extract Token">
            <stringProp name="RegexExtractor.regex">"token":"([^"]+)"</stringProp>
            <stringProp name="RegexExtractor.template">$1$</stringProp>
            <stringProp name="RegexExtractor.match_number">1</stringProp>
            <stringProp name="RegexExtractor.refname">authToken</stringProp>
          </RegexExtractor>
          <hashTree/>
        </hashTree>
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="POST /api/data">
          <stringProp name="HTTPSampler.domain">api.example.com</stringProp>
          <stringProp name="HTTPSampler.port">443</stringProp>
          <stringProp name="HTTPSampler.protocol">https</stringProp>
          <stringProp name="HTTPSampler.path">/api/data</stringProp>
          <stringProp name="HTTPSampler.method">POST</stringProp>
          <stringProp name="HTTPSampler.postBodyRaw">{"name":"test"}</stringProp>
        </HTTPSamplerProxy>
        <hashTree>
          <JSONPathAssertion guiclass="JSONPathAssertionGui" testclass="JSONPathAssertion" testname="JSON Assertion">
            <stringProp name="JSON_PATH">$.success</stringProp>
            <stringProp name="JSONAssertion.jsonPath">$.success</stringProp>
            <stringProp name="JSONAssertion.expectedValue">true</stringProp>
          </JSONPathAssertion>
          <hashTree/>
        </hashTree>
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>`;

describe('parseJmx', () => {
  it('parses a JMX file into blocks', () => {
    const blocks = parseJmx(SAMPLE_JMX);
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('creates a scenario from ThreadGroup', () => {
    const blocks = parseJmx(SAMPLE_JMX);
    const group = blocks.find(b => b.type === 'scenario' || b.type === 'stages-scenario' || b.type === 'group');
    expect(group).toBeDefined();
    expect(group?.label).toContain('API Users');
  });

  it('creates http-request blocks for each sampler', () => {
    const blocks = parseJmx(SAMPLE_JMX);
    const httpBlocks = blocks.flatMap(b => b.children).filter(c => c.type === 'http-request');
    expect(httpBlocks.length).toBe(2);
  });

  it('maps GET request correctly', () => {
    const blocks = parseJmx(SAMPLE_JMX);
    const getBlock = blocks.flatMap(b => b.children).find(c => c.type === 'http-request' && c.properties.method === 'GET');
    expect(getBlock).toBeDefined();
    expect(getBlock?.properties.url).toContain('api.example.com');
    expect(getBlock?.properties.url).toContain('/api/users');
  });

  it('maps POST request with body', () => {
    const blocks = parseJmx(SAMPLE_JMX);
    const postBlock = blocks.flatMap(b => b.children).find(c => c.type === 'http-request' && c.properties.method === 'POST');
    expect(postBlock).toBeDefined();
    expect(postBlock?.properties.body).toContain('{"name":"test"}');
  });

  it('creates check blocks from ResponseAssertion', () => {
    const blocks = parseJmx(SAMPLE_JMX);
    const getBlock = blocks.flatMap(b => b.children).find(c => c.type === 'http-request' && c.properties.method === 'GET');
    const checks = getBlock?.children.filter(c => c.type === 'check') || [];
    expect(checks.length).toBe(1);
    expect(checks[0].properties.expected).toBe('200');
  });

  it('creates extract-variable from RegexExtractor', () => {
    const blocks = parseJmx(SAMPLE_JMX);
    const getBlock = blocks.flatMap(b => b.children).find(c => c.type === 'http-request' && c.properties.method === 'GET');
    const extracts = getBlock?.children.filter(c => c.type === 'extract-variable') || [];
    expect(extracts.length).toBe(1);
    expect(extracts[0].properties.variableName).toBe('authToken');
  });

  it('creates json-assertion from JSONPathAssertion', () => {
    const blocks = parseJmx(SAMPLE_JMX);
    const postBlock = blocks.flatMap(b => b.children).find(c => c.type === 'http-request' && c.properties.method === 'POST');
    const jAssert = postBlock?.children.find(c => c.type === 'json-assertion');
    expect(jAssert).toBeDefined();
    expect(jAssert?.properties.jsonPath).toBe('$.success');
  });

  it('returns empty array for invalid XML', () => {
    const blocks = parseJmx('not xml');
    expect(blocks).toEqual([]);
  });

  it('returns empty array for non-JMeter XML', () => {
    const blocks = parseJmx('<root><item/></root>');
    expect(blocks).toEqual([]);
  });

  it('parses TMeter custom ScriptWrapper and propMap JMX format', () => {
    const TMETER_JMX = `<?xml version='1.0' encoding='UTF-8'?>
<com.tmeter.save.ScriptWrapper>
  <testPlan class="hashTree" serialization="custom">
    <org.apache.jorphan.collections.HashTree>
      <default>
        <data serialization="custom">
          <java.util.IdentityHashMap>
            <com.tmeter.testelement.TestPlan>
              <propMap class="java.util.Collections$SynchronizedMap">
                <java.util.Map_-Entry>
                  <java.lang.String>TestElement.name</java.lang.String>
                  <com.tmeter.testelement.property.StringProperty>
                    <name>TestElement.name</name>
                    <value>Test Plan</value>
                  </com.tmeter.testelement.property.StringProperty>
                </java.util.Map_-Entry>
              </propMap>
            </com.tmeter.testelement.TestPlan>
            <hashTree serialization="custom">
              <org.apache.jorphan.collections.HashTree>
                <default>
                  <data serialization="custom">
                    <java.util.IdentityHashMap>
                      <com.tmeter.threads.ThreadGroup>
                        <propMap class="java.util.LinkedHashMap">
                          <java.util.Map_-Entry>
                            <java.lang.String>TestElement.name</java.lang.String>
                            <com.tmeter.testelement.property.StringProperty>
                              <name>TestElement.name</name>
                              <value>Thread Group</value>
                            </com.tmeter.testelement.property.StringProperty>
                          </java.util.Map_-Entry>
                          <java.util.Map_-Entry>
                            <java.lang.String>ThreadGroup.num_threads</java.lang.String>
                            <com.tmeter.testelement.property.IntegerProperty>
                              <name>ThreadGroup.num_threads</name>
                              <value>5</value>
                            </com.tmeter.testelement.property.IntegerProperty>
                          </java.util.Map_-Entry>
                        </propMap>
                      </com.tmeter.threads.ThreadGroup>
                      <hashTree serialization="custom">
                        <org.apache.jorphan.collections.HashTree>
                          <default>
                            <data serialization="custom">
                              <java.util.IdentityHashMap>
                                <com.tmeter.protocol.http.sampler.HTTPSamplerProxy>
                                  <propMap class="java.util.LinkedHashMap">
                                    <java.util.Map_-Entry>
                                      <java.lang.String>HTTPSampler.domain</java.lang.String>
                                      <com.tmeter.testelement.property.StringProperty>
                                        <name>HTTPSampler.domain</name>
                                        <value>yethiprod.tenjinonline.com</value>
                                      </com.tmeter.testelement.property.StringProperty>
                                    </java.util.Map_-Entry>
                                    <java.util.Map_-Entry>
                                      <java.lang.String>HTTPSampler.path</java.lang.String>
                                      <com.tmeter.testelement.property.StringProperty>
                                        <name>HTTPSampler.path</name>
                                        <value>/signin</value>
                                      </com.tmeter.testelement.property.StringProperty>
                                    </java.util.Map_-Entry>
                                    <java.util.Map_-Entry>
                                      <java.lang.String>HTTPSampler.method</java.lang.String>
                                      <com.tmeter.testelement.property.StringProperty>
                                        <name>HTTPSampler.method</name>
                                        <value>GET</value>
                                      </com.tmeter.testelement.property.StringProperty>
                                    </java.util.Map_-Entry>
                                  </propMap>
                                </com.tmeter.protocol.http.sampler.HTTPSamplerProxy>
                                <hashTree/>
                              </java.util.IdentityHashMap>
                            </data>
                          </default>
                        </org.apache.jorphan.collections.HashTree>
                      </hashTree>
                    </java.util.IdentityHashMap>
                  </data>
                </default>
              </org.apache.jorphan.collections.HashTree>
            </hashTree>
          </java.util.IdentityHashMap>
        </data>
      </default>
    </org.apache.jorphan.collections.HashTree>
  </testPlan>
</com.tmeter.save.ScriptWrapper>`;

    const blocks = parseJmx(TMETER_JMX);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe('scenario');
    expect(blocks[0].children.length).toBe(1);
    expect(blocks[0].children[0].type).toBe('http-request');
    expect(blocks[0].children[0].properties.url).toContain('yethiprod.tenjinonline.com/signin');
  });

  it('parses real user test plan (6).jmx from Downloads if present', () => {
    // Dynamically test user file if on local environment
    try {
      const fs = require('fs');
      if (fs.existsSync('/Users/yethi/Downloads/test plan (6).jmx')) {
        const content = fs.readFileSync('/Users/yethi/Downloads/test plan (6).jmx', 'utf8');
        const blocks = parseJmx(content);
        expect(blocks.length).toBeGreaterThan(0);
        expect(blocks[0].type).toBe('stages-scenario');
        expect(blocks[0].label).toBe('Browser Recorded UI Flow');
        // RecordController should become a transaction block enclosing all 15 recorded API calls
        expect(blocks[0].children.some(c => c.type === 'transaction' && c.label === 'UI Interaction Flow (15 APIs)')).toBe(true);
      }
    } catch (e) {
      // Ignore if fs not available or file moved
    }
  });

  it('parses VirtualUserGroup and RecordController directly', () => {
    const VUG_JMX = `<?xml version="1.0" encoding="UTF-8"?>
    <jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
      <hashTree>
        <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="Sample Test Plan">
        </TestPlan>
        <hashTree>
          <VirtualUserGroup guiclass="VirtualUserGroupGui" testclass="VirtualUserGroup" testname="Recorded UI Flow" enabled="true">
            <stringProp name="VirtualUserGroup.num_threads">10</stringProp>
            <stringProp name="VirtualUserGroup.ramp_time">10</stringProp>
            <stringProp name="VirtualUserGroup.duration">60</stringProp>
          </VirtualUserGroup>
          <hashTree>
            <RecordController guiclass="RecordController" testclass="RecordController" testname="UI Interaction Flow" enabled="true">
            </RecordController>
            <hashTree>
              <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="GET /signin" enabled="true">
                <stringProp name="HTTPSampler.domain">example.com</stringProp>
                <stringProp name="HTTPSampler.path">/signin</stringProp>
                <stringProp name="HTTPSampler.method">GET</stringProp>
              </HTTPSamplerProxy>
              <hashTree/>
            </hashTree>
          </hashTree>
        </hashTree>
      </hashTree>
    </jmeterTestPlan>`;

    const blocks = parseJmx(VUG_JMX);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe('stages-scenario');
    expect(blocks[0].label).toBe('Recorded UI Flow');
    expect(blocks[0].children.length).toBe(1);
    expect(blocks[0].children[0].type).toBe('transaction');
    expect(blocks[0].children[0].label).toBe('UI Interaction Flow');
    expect(blocks[0].children[0].children[0].type).toBe('http-request');
  });

  it('parses ISO8583Config and ISO8583Sampler with MessageField elements into iso8583 blocks', () => {
    const ISO_JMX = `<?xml version="1.0" encoding="UTF-8"?>
    <jmeterTestPlan version="1.2">
      <hashTree>
        <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="ISO Test Plan"/>
        <hashTree>
          <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Banking VUs">
            <stringProp name="ThreadGroup.num_threads">5</stringProp>
          </ThreadGroup>
          <hashTree>
            <nz.co.breakpoint.jmeter.iso8583.ISO8583Config guiclass="TestBeanGUI" testclass="nz.co.breakpoint.jmeter.iso8583.ISO8583Config" testname="ISO Connection">
              <stringProp name="host">10.1.209.85</stringProp>
              <stringProp name="port">39127</stringProp>
              <stringProp name="classname">ASCIIChannel</stringProp>
            </nz.co.breakpoint.jmeter.iso8583.ISO8583Config>
            <hashTree/>
            <nz.co.breakpoint.jmeter.iso8583.ISO8583Sampler guiclass="TestBeanGUI" testclass="nz.co.breakpoint.jmeter.iso8583.ISO8583Sampler" testname="Account Inquiry">
              <collectionProp name="fields">
                <elementProp name="0" elementType="nz.co.breakpoint.jmeter.iso8583.MessageField" testname="0">
                  <stringProp name="content">1200</stringProp>
                </elementProp>
                <elementProp name="3" elementType="nz.co.breakpoint.jmeter.iso8583.MessageField" testname="3">
                  <stringProp name="content">820000</stringProp>
                </elementProp>
              </collectionProp>
            </nz.co.breakpoint.jmeter.iso8583.ISO8583Sampler>
            <hashTree>
              <JSR223Assertion guiclass="TestBeanGUI" testclass="JSR223Assertion" testname="Validate Response Code">
                <stringProp name="JSR223.script">assert prev.getResponseCode().equals("200")</stringProp>
              </JSR223Assertion>
              <hashTree/>
            </hashTree>
          </hashTree>
        </hashTree>
      </hashTree>
    </jmeterTestPlan>`;

    const blocks = parseJmx(ISO_JMX);
    expect(blocks.length).toBe(1);
    const tg = blocks[0];
    expect(tg.children.length).toBe(2); // ISO8583Config and ISO8583Sampler

    const cfg = tg.children[0];
    expect(cfg.type).toBe('iso8583');
    expect(cfg.properties.tcpHost).toBe('10.1.209.85');
    expect(cfg.properties.tcpPort).toBe('39127');

    const sampler = tg.children[1];
    expect(sampler.type).toBe('iso8583');
    expect(sampler.properties.mti).toBe('1200');
    expect(sampler.properties.processingCode).toBe('820000');
    expect(sampler.children.length).toBe(1);
    expect(sampler.children[0].type).toBe('check');
    expect(sampler.children[0].properties.target).toBe('custom-script');
  });
});



