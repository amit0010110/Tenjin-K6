export type TestRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'aborted';

export type MetricType = 'counter' | 'gauge' | 'rate' | 'trend';

export type TriggerType = 'manual' | 'scheduled' | 'ci';

export interface TestRun {
  id: string;
  testConfigId: string;
  scriptId: string;
  projectId: string;
  userId: string;
  status: TestRunStatus;
  statusMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  k6ExitCode: number | null;
  triggerType: TriggerType;
  createdAt: string;
}

export interface MetricPoint {
  type: 'Point';
  metric: string;
  data: {
    time: string;
    value: number;
    tags: Record<string, string>;
  };
}

export interface StatusPoint {
  type: 'Status';
  data: {
    time: string;
    status: string;
  };
}

export type K6OutputLine = MetricPoint | StatusPoint;

export interface AggregatedMetric {
  metricName: string;
  metricType: MetricType;
  avg: number;
  min: number;
  max: number;
  med: number;
  p90: number;
  p95: number;
  p99: number;
  count: number;
  rate: number;
  value: number;
  tags: Record<string, string>;
}

export interface ThresholdRule {
  metric: string;
  expression: string;
  abortOnFail?: boolean;
  delayAbortEval?: string;
}

export interface ThresholdResult {
  metric: string;
  expression: string;
  passed: boolean;
  actual: number | null;
  aborted: boolean;
}

export interface ScriptConfig {
  vus?: number;
  duration?: string;
  iterations?: number;
  stages?: { duration: string; target: number }[];
  scenarios?: Record<string, ScenarioConfig>;
  thresholds?: Record<string, (string | ThresholdRule)[]>;
  tags?: Record<string, string>;
  env?: Record<string, string>;
}

export interface ScenarioConfig {
  executor: string;
  startTime?: string;
  gracefulStop?: string;
  vus?: number;
  iterations?: number;
  maxDuration?: string;
  stages?: { duration: string; target: number }[];
  env?: Record<string, string>;
  tags?: Record<string, string>;
}

export interface CreateScriptRequest {
  name: string;
  content: string;
  envVars?: Record<string, string>;
  tags?: Record<string, string>;
}

export interface CreateConfigRequest {
  name: string;
  description?: string;
  options: ScriptConfig;
  outputProfileId?: string | null;
}

export interface OutputProfile {
  id: string;
  projectId: string;
  name: string;
  outputType: string;
  configJson: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOutputProfileRequest {
  name: string;
  outputType: string;
  configJson: string;
  isDefault?: boolean;
}

export interface TestConfig {
  id: string;
  scriptId: string;
  name: string;
  description?: string | null;
  options: ScriptConfig;
  prometheusPushUrl?: string | null;
  outputProfileId?: string | null;
  outputProfile?: OutputProfile | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetRule {
  id: string;
  name: string;
  metric: string;
  expression: string;
  severity: 'error' | 'warning';
  enabled: boolean;
}

export interface BudgetCheckResult {
  runId: string;
  rules: Array<{
    ruleId: string;
    name: string;
    metric: string;
    expression: string;
    severity: 'error' | 'warning';
    passed: boolean;
    actual: number | null;
  }>;
  passed: boolean;
  timestamp: string;
}

export interface ApiError {
  statusCode: number;
  message: string;
  details?: unknown;
}

// Real-time k6 output configuration
export interface OutputConfig {
  type: string;
  enabled: boolean;
  config: Record<string, string>;
}

export interface OutputTypeInfo {
  label: string;
  description: string;
  category: 'Cloud' | 'APM' | 'Database' | 'Streaming' | 'File' | 'Observability';
  icon: string;
  flag: (cfg: Record<string, string>) => string | null;
  fields: { key: string; label: string; placeholder?: string; secret?: boolean }[];
  envMap?: Record<string, string>; // maps config field → k6 env var name
}

export const OUTPUT_TYPES: Record<string, OutputTypeInfo> = {
  cloud: {
    label: 'k6 Cloud',
    description: 'Stream results to Grafana Cloud k6. Set API token in Project Settings.',
    category: 'Cloud', icon: '☁️',
    flag: () => '--out cloud',
    fields: [],
  },
  prometheus: {
    label: 'Prometheus Remote Write',
    description: 'Stream metrics to a Prometheus-compatible remote write endpoint',
    category: 'Observability', icon: '📊',
    flag: (c) => `--out output-prometheus-remote=${c.url}`,
    fields: [{ key: 'url', label: 'Remote Write URL', placeholder: 'https://prometheus.example.com/api/v1/write' }],
    envMap: { url: 'K6_PROMETHEUS_REMOTE_URL' },
  },
  influxdb: {
    label: 'InfluxDB v1',
    description: 'Send metrics to InfluxDB v1 (/write endpoint)',
    category: 'Database', icon: '🗄️',
    flag: (c) => `--out influxdb=${c.url}`,
    fields: [{ key: 'url', label: 'InfluxDB v1 URL', placeholder: 'http://user:pass@localhost:8086/k6db' }],
  },
  'influxdb-v2': {
    label: 'InfluxDB v2 (xk6)',
    description: 'Send metrics to InfluxDB v2 using xk6-output-influxdb extension',
    category: 'Database', icon: '⚡',
    flag: (c) => `--out xk6-influxdb=${c.url}`,
    fields: [
      { key: 'url', label: 'InfluxDB URL', placeholder: 'http://192.168.16.54:32444' },
      { key: 'organization', label: 'Organization', placeholder: 'my-org' },
      { key: 'bucket', label: 'Bucket', placeholder: 'myk6db' },
      { key: 'token', label: 'API Token', placeholder: 'YOUR_API_TOKEN==', secret: true },
    ],
    envMap: {
      organization: 'K6_INFLUXDB_ORGANIZATION',
      bucket: 'K6_INFLUXDB_BUCKET',
      token: 'K6_INFLUXDB_TOKEN',
    },
  },
  datadog: {
    label: 'Datadog',
    description: 'Send metrics to Datadog',
    category: 'APM', icon: '🐶',
    flag: () => '--out datadog',
    fields: [
      { key: 'apiKey', label: 'Datadog API Key', placeholder: '...', secret: true },
      { key: 'site', label: 'Datadog Site', placeholder: 'datadoghq.com' },
    ],
    envMap: { apiKey: 'K6_DATADOG_API_KEY', site: 'K6_DATADOG_SITE' },
  },
  newrelic: {
    label: 'New Relic',
    description: 'Send metrics to New Relic',
    category: 'APM', icon: '🟢',
    flag: () => '--out newrelic',
    fields: [
      { key: 'apiKey', label: 'New Relic API Key', placeholder: '...', secret: true },
      { key: 'appId', label: 'Application ID', placeholder: '...' },
    ],
    envMap: { apiKey: 'K6_NEWRELIC_API_KEY', appId: 'K6_NEWRELIC_APP_ID' },
  },
  elasticsearch: {
    label: 'Elasticsearch',
    description: 'Send metrics to Elasticsearch',
    category: 'Database', icon: '🔍',
    flag: (c) => `--out elasticsearch=${c.url}`,
    fields: [{ key: 'url', label: 'Elasticsearch URL', placeholder: 'http://localhost:9200' }],
  },
  kafka: {
    label: 'Apache Kafka',
    description: 'Send metrics to Kafka',
    category: 'Streaming', icon: '📨',
    flag: () => '--out kafka',
    fields: [
      { key: 'brokers', label: 'Brokers (comma separated)', placeholder: 'localhost:9092' },
      { key: 'topic', label: 'Topic', placeholder: 'k6-metrics' },
    ],
    envMap: { brokers: 'K6_KAFKA_BROKERS', topic: 'K6_KAFKA_TOPIC' },
  },
  statsd: {
    label: 'StatsD',
    description: 'Send metrics to StatsD',
    category: 'Observability', icon: '📈',
    flag: (c) => `--out statsd=${c.addr}`,
    fields: [{ key: 'addr', label: 'StatsD Address', placeholder: 'localhost:8125' }],
  },
  opentelemetry: {
    label: 'OpenTelemetry',
    description: 'Export metrics via OpenTelemetry',
    category: 'Observability', icon: '🔭',
    flag: (c) => `--out opentelemetry=${c.endpoint}`,
    fields: [{ key: 'endpoint', label: 'OTLP Endpoint', placeholder: 'http://localhost:4318' }],
  },
  timescaledb: {
    label: 'TimescaleDB',
    description: 'Send metrics to TimescaleDB',
    category: 'Database', icon: '⏱️',
    flag: (c) => `--out timescaledb=${c.url}`,
    fields: [{ key: 'url', label: 'TimescaleDB URL', placeholder: 'postgres://user:pass@host:5432/k6' }],
  },
  csv: {
    label: 'CSV File',
    description: 'Write results to a CSV file on the server',
    category: 'File', icon: '📄',
    flag: (c) => `--out csv=${c.path}`,
    fields: [{ key: 'path', label: 'Output Path', placeholder: '/tmp/k6-results.csv' }],
  },
  json: {
    label: 'JSON File',
    description: 'Write results to a JSON file on the server',
    category: 'File', icon: '📋',
    flag: (c) => `--out json=${c.path}`,
    fields: [{ key: 'path', label: 'Output Path', placeholder: '/tmp/k6-results.json' }],
  },
  cloudwatch: {
    label: 'Amazon CloudWatch',
    description: 'Send metrics to AWS CloudWatch (uses AWS env vars)',
    category: 'Cloud', icon: '🌩️',
    flag: () => '--out cloudwatch',
    fields: [{ key: 'region', label: 'AWS Region', placeholder: 'us-east-1' }],
    envMap: { region: 'AWS_REGION' },
  },
  dynatrace: {
    label: 'Dynatrace',
    description: 'Send metrics to Dynatrace',
    category: 'APM', icon: '🔵',
    flag: () => '--out dynatrace',
    fields: [
      { key: 'apiToken', label: 'API Token', placeholder: '...', secret: true },
      { key: 'url', label: 'Dynatrace URL', placeholder: 'https://abc.live.dynatrace.com' },
    ],
    envMap: { apiToken: 'K6_DYNATRACE_APITOKEN', url: 'K6_DYNATRACE_URL' },
  },
  netdata: {
    label: 'Netdata',
    description: 'Send metrics to Netdata',
    category: 'Observability', icon: '🟡',
    flag: (c) => `--out netdata=${c.url}`,
    fields: [{ key: 'url', label: 'Netdata URL', placeholder: 'http://localhost:19999' }],
  },
  'grafana-cloud-prometheus': {
    label: 'Grafana Cloud Prometheus',
    description: 'Send metrics to Grafana Cloud Prometheus',
    category: 'Cloud', icon: '📤',
    flag: (c) => `--out grafana-cloud-prometheus=${c.url}`,
    fields: [
      { key: 'url', label: 'Prometheus URL', placeholder: 'https://prometheus-prod-XX-prod.grafana.net/api/prom/push' },
      { key: 'apiKey', label: 'API Key', placeholder: '...', secret: true },
    ],
    envMap: { apiKey: 'K6_GRAFANA_CLOUD_API_KEY' },
  },
};
