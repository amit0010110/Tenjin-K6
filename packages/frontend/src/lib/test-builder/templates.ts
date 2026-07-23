import { TestBlock, createBlock } from './types';

export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'REST API' | 'GraphQL' | 'gRPC' | 'WebSocket' | 'Browser' | 'Database' | 'Load Test' | 'Monitoring' | 'Integration';
  tags: string[];
  code: string;
  blocks?: TestBlock[];
}

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'rest-api-health',
    name: 'REST API Health Check',
    description: 'Basic health check endpoint with status assertion',
    icon: 'HeartPulse',
    category: 'REST API',
    tags: ['health', 'monitoring', 'basic'],
    blocks: [
      createBlock('http-request', {
        label: 'GET /health',
        properties: {
          method: 'GET',
          url: 'https://api.example.com/health',
          headers: [],
          body: '',
        },
        children: [
          createBlock('check', {
            label: 'status is 200',
            properties: { target: 'status', operator: '==', expected: '200', label: 'status is 200' },
          }),
          createBlock('check', {
            label: 'response time < 500ms',
            properties: { target: 'response_time', operator: '<', expected: '500', label: 'response time < 500ms' },
          }),
        ],
      }),
    ],
    code: `import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 1,
  duration: '10s',
};

export default function () {
  const res = http.get('https://api.example.com/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}`,
  },
  {
    id: 'rest-api-crud',
    name: 'REST API CRUD Flow',
    description: 'Complete CRUD workflow: create, read, update, delete',
    icon: 'Database',
    category: 'REST API',
    tags: ['crud', 'workflow', 'api'],
    blocks: [
      createBlock('group', {
        label: 'Create Resource',
        properties: { name: 'Create Resource' },
        children: [
          createBlock('http-request', {
            label: 'POST /users',
            properties: { method: 'POST', url: '${__ENV.TARGET_URL}/users', headers: [{ key: 'Content-Type', value: 'application/json' }],             body: '{"name":"test-${__VU}","email":"test@example.com"}' },
            children: [
              createBlock('check', {
                label: 'created successfully',
                properties: { target: 'status', operator: '==', expected: '201', label: 'created successfully' },
              }),
              createBlock('extract-variable', {
                label: 'Extract user ID',
                properties: { variableName: 'userId', extractType: 'jsonpath', expression: '$.id' },
              }),
            ],
          }),
        ],
      }),
      createBlock('group', {
        label: 'Read Resource',
        properties: { name: 'Read Resource' },
        children: [
          createBlock('http-request', {
            label: 'GET /users/${userId}',
            properties: { method: 'GET', url: '${__ENV.TARGET_URL}/users/${userId}' },
            children: [
              createBlock('check', {
                label: 'retrieved successfully',
                properties: { target: 'status', operator: '==', expected: '200', label: 'retrieved successfully' },
              }),
            ],
          }),
        ],
      }),
      createBlock('group', {
        label: 'Update Resource',
        properties: { name: 'Update Resource' },
        children: [
          createBlock('http-request', {
            label: 'PUT /users/${userId}',
            properties: { method: 'PUT', url: '${__ENV.TARGET_URL}/users/${userId}', headers: [{ key: 'Content-Type', value: 'application/json' }], body: '{"name":"updated"}' },
            children: [
              createBlock('check', {
                label: 'updated successfully',
                properties: { target: 'status', operator: '==', expected: '200', label: 'updated successfully' },
              }),
            ],
          }),
        ],
      }),
      createBlock('group', {
        label: 'Delete Resource',
        properties: { name: 'Delete Resource' },
        children: [
          createBlock('http-request', {
            label: 'DELETE /users/${userId}',
            properties: { method: 'DELETE', url: '${__ENV.TARGET_URL}/users/${userId}' },
            children: [
              createBlock('check', {
                label: 'deleted successfully',
                properties: { target: 'status', operator: '==', expected: '204', label: 'deleted successfully' },
              }),
            ],
          }),
        ],
      }),
    ],
    code: `import http from 'k6/http';
import { check, group } from 'k6';

const BASE_URL = __ENV.TARGET_URL || 'https://api.example.com';

export default function () {
  group('Create Resource', function () {
    const payload = JSON.stringify({ name: 'test-\\\${__VU}', email: 'test@example.com' });
    const createRes = http.post(\`\${BASE_URL}/users\`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    check(createRes, { 'created successfully': (r) => r.status === 201 });
    const userId = JSON.parse(createRes.body).id;

    group('Read Resource', function () {
      const getRes = http.get(\`\${BASE_URL}/users/\${userId}\`);
      check(getRes, { 'retrieved successfully': (r) => r.status === 200 });
    });

    group('Update Resource', function () {
      const updateRes = http.put(\`\${BASE_URL}/users/\${userId}\`, JSON.stringify({ name: 'updated' }), {
        headers: { 'Content-Type': 'application/json' },
      });
      check(updateRes, { 'updated successfully': (r) => r.status === 200 });
    });

    group('Delete Resource', function () {
      const delRes = http.del(\`\${BASE_URL}/users/\${userId}\`);
      check(delRes, { 'deleted successfully': (r) => r.status === 204 });
    });
  });
}`,
  },
  {
    id: 'graphql-query',
    name: 'GraphQL Query',
    description: 'Execute a GraphQL query with dynamic variables',
    icon: 'Braces',
    category: 'GraphQL',
    tags: ['graphql', 'query', 'api'],
    code: `import http from 'k6/http';
import { check } from 'k6';

const GRAPHQL_URL = __ENV.GRAPHQL_URL || 'https://api.example.com/graphql';

const query = \`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
      posts { title }
    }
  }
\`;

export default function () {
  const res = http.post(GRAPHQL_URL, JSON.stringify({
    query: query,
    variables: { id: '\\\${__VU}' },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, {
    'query succeeded': (r) => r.status === 200,
    'has data': (r) => JSON.parse(r.body).data !== undefined,
  });
}`,
  },
  {
    id: 'grpc-unary',
    name: 'gRPC Unary Call',
    description: 'Simple gRPC unary RPC call with proto definition',
    icon: 'Repeat2',
    category: 'gRPC',
    tags: ['grpc', 'rpc', 'protobuf'],
    code: `import grpc from 'k6/net/grpc';
import { check } from 'k6';

const client = new grpc.Client();
client.load(['./proto'], 'service.proto');

export default function () {
  client.connect('localhost:50051', { timeout: '5s' });
  const res = client.invoke('package.Service/Method', {
    field1: 'value',
    field2: \\\${__VU},
  });
  check(res, {
    'gRPC call succeeded': (r) => r.status === grpc.StatusOK,
    'response not empty': (r) => r.message !== undefined,
  });
  client.close();
}`,
  },
  {
    id: 'websocket-chat',
    name: 'WebSocket Chat Simulation',
    description: 'Simulate a WebSocket chat connection with message exchange',
    icon: 'Radio',
    category: 'WebSocket',
    tags: ['websocket', 'realtime', 'chat'],
    code: `import ws from 'k6/ws';
import { check } from 'k6';

const WS_URL = __ENV.WS_URL || 'wss://ws.example.com/chat';

export default function () {
  const res = ws.connect(WS_URL, {}, function (socket) {
    socket.on('open', function () {
      socket.send(JSON.stringify({ type: 'join', room: 'general', user: 'user-\\\${__VU}' }));
    });

    socket.on('message', function (data) {
      const msg = JSON.parse(data);
      if (msg.type === 'message') {
        socket.send(JSON.stringify({ type: 'typing', room: 'general' }));
      }
    });

    socket.setTimeout(function () {
      socket.send(JSON.stringify({ type: 'leave', room: 'general' }));
      socket.close();
    }, 30000);

    socket.on('close', function () {});
    socket.on('error', function (e) {
      console.log('WebSocket error: ' + e.error());
    });
  });

  check(res, { 'connected successfully': (r) => r && r.status === 101 });
}`,
  },
  {
    id: 'browser-load',
    name: 'Browser Page Load Test',
    description: 'Measure frontend performance with browser-level metrics',
    icon: 'Monitor',
    category: 'Browser',
    tags: ['browser', 'frontend', 'web-vitals'],
    code: `import { browser } from 'k6/browser';
import { check } from 'k6';

export const options = {
  scenarios: {
    browser: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      options: { browser: { type: 'chromium' } },
    },
  },
};

export default async function () {
  const page = await browser.newPage();
  try {
    await page.goto('https://example.com', { waitUntil: 'networkidle' });
    check(page, {
      'page loaded': (p) => p.title() !== '',
    });

    await page.screenshot({ path: 'screenshots/\\\${__VU}.png' });
  } finally {
    await page.close();
  }
}`,
  },
  {
    id: 'load-test-spike',
    name: 'Spike Load Test',
    description: 'Test system behavior under sudden traffic spike',
    icon: 'Zap',
    category: 'Load Test',
    tags: ['spike', 'stress', 'load'],
    code: `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '2m', target: 10 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const res = http.get('https://api.example.com/endpoint');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}`,
  },
  {
    id: 'load-test-stress',
    name: 'Stress Test (Ramp-up)',
    description: 'Gradually increase load to find breaking point',
    icon: 'TrendingUp',
    category: 'Load Test',
    tags: ['stress', 'ramp-up', 'load'],
    code: `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 50 },
    { duration: '5m', target: 100 },
    { duration: '5m', target: 200 },
    { duration: '5m', target: 300 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(90)<1000', 'p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('https://api.example.com/search?q=test');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(Math.random() * 2 + 0.5);
}`,
  },
  {
    id: 'load-test-soak',
    name: 'Soak / Endurance Test',
    description: 'Sustained load over long period to find memory leaks',
    icon: 'Clock',
    category: 'Load Test',
    tags: ['soak', 'endurance', 'long-running'],
    code: `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10m', target: 100 },
    { duration: '4h', target: 100 },
    { duration: '10m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.02'],
    iteration_duration: ['avg<5000'],
  },
};

export default function () {
  const res = http.get('https://api.example.com/dashboard');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(3);
}`,
  },
  {
    id: 'api-auth-flow',
    name: 'OAuth2 / JWT Auth Flow',
    description: 'Login with credentials, extract token, use for authenticated requests',
    icon: 'Lock',
    category: 'REST API',
    tags: ['auth', 'jwt', 'oauth', 'login'],
    blocks: [
      createBlock('group', {
        label: 'Login',
        properties: { name: 'Login' },
        children: [
          createBlock('http-request', {
            label: 'POST /auth/login',
            properties: { method: 'POST', url: '${__ENV.TARGET_URL}/auth/login', headers: [{ key: 'Content-Type', value: 'application/json' }], body: '{"email":"user@example.com","password":"password123"}' },
            children: [
              createBlock('check', {
                label: 'login succeeded',
                properties: { target: 'status', operator: '==', expected: '200', label: 'login succeeded' },
              }),
              createBlock('extract-variable', {
                label: 'Extract token',
                properties: { variableName: 'token', extractType: 'jsonpath', expression: '$.token' },
              }),
            ],
          }),
        ],
      }),
      createBlock('group', {
        label: 'Authenticated Requests',
        properties: { name: 'Authenticated Requests' },
        children: [
          createBlock('auth-manager', {
            label: 'Auth: Bearer Token',
            properties: { authType: 'bearer', token: '${token}' },
          }),
          createBlock('http-request', {
            label: 'GET /user/profile',
            properties: { method: 'GET', url: '${__ENV.TARGET_URL}/user/profile' },
            children: [
              createBlock('check', {
                label: 'profile retrieved',
                properties: { target: 'status', operator: '==', expected: '200', label: 'profile retrieved' },
              }),
            ],
          }),
          createBlock('http-request', {
            label: 'GET /user/posts',
            properties: { method: 'GET', url: '${__ENV.TARGET_URL}/user/posts', headers: [], body: '' },
            children: [
              createBlock('check', {
                label: 'posts retrieved',
                properties: { target: 'status', operator: '==', expected: '200', label: 'posts retrieved' },
              }),
            ],
          }),
        ],
      }),
    ],
    code: `import http from 'k6/http';
import { check, group } from 'k6';

const BASE_URL = __ENV.TARGET_URL || 'https://api.example.com';

export default function () {
  group('Login', function () {
    const loginRes = http.post(\`\${BASE_URL}/auth/login\`, JSON.stringify({
      email: 'user@example.com',
      password: 'password123',
    }), { headers: { 'Content-Type': 'application/json' } });

    check(loginRes, { 'login succeeded': (r) => r.status === 200 });
    const token = JSON.parse(loginRes.body).token;

    group('Authenticated Requests', function () {
      const params = {
        headers: {
          'Authorization': \`Bearer \${token}\`,
          'Content-Type': 'application/json',
        },
      };

      const profileRes = http.get(\`\${BASE_URL}/user/profile\`, params);
      check(profileRes, { 'profile retrieved': (r) => r.status === 200 });

      const postsRes = http.get(\`\${BASE_URL}/user/posts?page=1\`, params);
      check(postsRes, { 'posts retrieved': (r) => r.status === 200 });
    });
  });
}`,
  },
  {
    id: 'synthetic-monitoring',
    name: 'Synthetic Monitoring',
    description: 'Low-frequency production monitoring check',
    icon: 'Activity',
    category: 'Monitoring',
    tags: ['synthetic', 'monitoring', 'production', 'sla'],
    code: `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

const ENDPOINTS = [
  { url: 'https://app.example.com', name: 'Homepage' },
  { url: 'https://api.example.com/health', name: 'API Health' },
  { url: 'https://api.example.com/v1/status', name: 'Status Endpoint' },
];

export default function () {
  for (const endpoint of ENDPOINTS) {
    const res = http.get(endpoint.url, { tags: { name: endpoint.name } });
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response < 1s': (r) => r.timings.duration < 1000,
    });
    sleep(5);
  }
}`,
  },
  {
    id: 'data-parameterization',
    name: 'Data-Driven Test (CSV)',
    description: 'Load test data from CSV file and parameterize requests',
    icon: 'Table',
    category: 'Load Test',
    tags: ['csv', 'data-driven', 'parameterization'],
    code: `import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { papaparse } from 'https://jslib.k6.io/papaparse/5.1.1/index.js';

const users = new SharedArray('users', function () {
  return papaparse.parse(open('./test-data.csv'), { header: true }).data;
});

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const user = users[__VU % users.length];
  const res = http.post('https://api.example.com/login', JSON.stringify({
    email: user.email,
    password: user.password,
  }), { headers: { 'Content-Type': 'application/json' } });

  check(res, { 'logged in': (r) => r.status === 200 });
  sleep(1);
}`,
  },
  {
    id: 'ci-pipeline-check',
    name: 'CI Pipeline Performance Gate',
    description: 'Quick performance check for CI/CD pipeline',
    icon: 'GitCommit',
    category: 'Integration',
    tags: ['ci', 'pipeline', 'gate', 'github-actions'],
    code: `import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('https://staging.example.com/api/health');
  check(res, { 'status is 200': (r) => r.status === 200 });
}`,
  },
  {
    id: 'scenario-multi-executor',
    name: 'Multi-Scenario Test',
    description: 'Combine multiple executors in one test (browsing + checkout)',
    icon: 'GitMerge',
    category: 'Load Test',
    tags: ['scenarios', 'executor', 'mixed', 'advanced'],
    code: `import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  scenarios: {
    browsing: {
      executor: 'constant-vus',
      vus: 50,
      duration: '10m',
      tags: { test_type: 'browsing' },
    },
    checkout: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '1m', target: 0 },
      ],
      tags: { test_type: 'checkout' },
    },
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 100,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '30s', target: 50 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
    },
  },
};

export default function () {
  group('Product Browsing', function () {
    const res = http.get('https://store.example.com/products');
    check(res, { 'products loaded': (r) => r.status === 200 });
    sleep(Math.random() * 3 + 1);
  });
}`,
  },
  {
    id: 'thresholds-complex',
    name: 'Advanced Thresholds & SLOs',
    description: 'Comprehensive thresholds with abort conditions and SLO tracking',
    icon: 'Gauge',
    category: 'Load Test',
    tags: ['thresholds', 'slo', 'abort'],
    code: `import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 50,
  duration: '5m',
  thresholds: {
    http_req_duration: [
      'p(90)<800',
      'p(95)<1200',
      'p(99)<2000',
      { threshold: 'avg<500', abortOnFail: true },
    ],
    http_req_failed: ['rate<0.01'],
    http_reqs: ['rate>100'],
    'http_req_duration{name:critical}': ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const res = http.get('https://api.example.com/endpoint', {
    tags: { name: 'critical' },
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'responded in time': (r) => r.timings.duration < 500,
  });
}`,
  },
  {
    id: 'websocket-stock-ticker',
    name: 'WebSocket Stock Ticker',
    description: 'Subscribe to real-time stock ticker updates',
    icon: 'TrendingUp',
    category: 'WebSocket',
    tags: ['websocket', 'streaming', 'finance'],
    code: `import ws from 'k6/ws';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '1m',
};

export default function () {
  const url = __ENV.WS_URL || 'wss://ws.example.com/stocks';
  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', function () {
      socket.send(JSON.stringify({
        type: 'subscribe',
        symbols: ['AAPL', 'GOOGL', 'MSFT', 'AMZN'],
      }));
    });

    let messageCount = 0;
    socket.on('message', function (data) {
      messageCount++;
    });

    socket.on('close', function () {
      console.log(\`Received \${messageCount} updates\`);
    });

    socket.setTimeout(function () {
      socket.close();
    }, 55000);
  });

  check(res, { 'connected': (r) => r && r.status === 101 });
}`,
  },
  {
    id: 'grpc-streaming',
    name: 'gRPC Server-Streaming',
    description: 'Consume a gRPC server-streaming API',
    icon: 'Radio',
    category: 'gRPC',
    tags: ['grpc', 'streaming', 'protobuf'],
    code: `import grpc from 'k6/net/grpc';
import { check } from 'k6';

const client = new grpc.Client();
client.load(['./proto'], 'streaming.proto');

export default function () {
  client.connect('localhost:50051', { timeout: '10s' });

  const stream = new grpc.Stream(client, 'package.Service/ServerStream');
  stream.on('data', function (data) {
    check(data, { 'received data': (d) => d.message !== undefined });
  });

  stream.on('error', function (err) {
    console.log('Stream error: ' + JSON.stringify(err));
  });

  stream.write({ id: '\\\${__VU}', subscribe: true });
  stream.setTimeout(function () {
    stream.end();
  }, 5000);

  client.close();
}`,
  },
  {
    id: 'browser-ecommerce',
    name: 'Browser E-Commerce Flow',
    description: 'Complete e-commerce journey: browse → cart → checkout',
    icon: 'ShoppingCart',
    category: 'Browser',
    tags: ['browser', 'ecommerce', 'journey'],
    code: `import { browser } from 'k6/browser';
import { check } from 'k6';

export const options = {
  scenarios: {
    ui: {
      executor: 'constant-vus',
      vus: 3,
      duration: '1m',
      options: { browser: { type: 'chromium' } },
    },
  },
};

export default async function () {
  const page = await browser.newPage();

  try {
    await page.goto('https://store.example.com');
    check(page, { 'homepage loaded': (p) => p.locator('h1').textContent() === 'Welcome' });

    await page.locator('a[href="/products"]').click();
    await page.waitForSelector('.product-card');
    check(page, { 'products visible': (p) => p.locator('.product-card').count() > 0 });

    await page.locator('.product-card:first-child a').click();
    await page.waitForSelector('.add-to-cart');
    await page.locator('.add-to-cart').click();

    await page.locator('a[href="/cart"]').click();
    await page.waitForSelector('.checkout-btn');
    check(page, { 'cart has items': (p) => p.locator('.cart-item').count() > 0 });

  } finally {
    await page.close();
  }
}`,
  },
  {
    id: 'upload-file',
    name: 'File Upload Test',
    description: 'Test file upload endpoints with multipart form data',
    icon: 'Upload',
    category: 'REST API',
    tags: ['upload', 'file', 'multipart'],
    code: `import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.TARGET_URL || 'https://api.example.com';

export const options = {
  vus: 5,
  duration: '1m',
};

export default function () {
  const fileContent = open('./test-file.pdf', 'b');
  const fileName = \`document-\${__VU}.pdf\`;

  const formData = {
    file: http.file(fileContent, fileName, 'application/pdf'),
    description: 'Test upload from VU ' + __VU,
  };

  const res = http.post(\`\${BASE_URL}/upload\`, formData);
  check(res, {
    'upload succeeded': (r) => r.status === 201,
    'has file id': (r) => JSON.parse(r.body).fileId !== undefined,
  });

  sleep(2);
}`,
  },
  {
    id: 'custom-metrics',
    name: 'Custom Business Metrics',
    description: 'Track custom business metrics alongside k6 defaults',
    icon: 'BarChart4',
    category: 'Integration',
    tags: ['metrics', 'custom', 'business'],
    code: `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter, Gauge } from 'k6/metrics';

const orderValue = new Trend('order_value');
const checkoutSuccess = new Rate('checkout_success_rate');
const totalOrders = new Counter('total_orders');
const activeUsers = new Gauge('active_users');

export const options = {
  vus: 10,
  duration: '1m',
  thresholds: {
    order_value: ['p(90)<200', 'avg>50'],
    checkout_success_rate: ['rate>0.95'],
  },
};

export default function () {
  activeUsers.add(__VU);

  const res = http.post('https://store.example.com/checkout', JSON.stringify({
    userId: __VU,
    items: ['prod-1', 'prod-2'],
    total: Math.random() * 150 + 10,
  }), { headers: { 'Content-Type': 'application/json' } });

  if (res.status === 200) {
    const data = JSON.parse(res.body);
    orderValue.add(data.total);
    checkoutSuccess.add(true);
    totalOrders.add(1);
  } else {
    checkoutSuccess.add(false);
  }

  check(res, { 'checkout processed': (r) => r.status < 500 });
  sleep(1);
}`,
  },
];
