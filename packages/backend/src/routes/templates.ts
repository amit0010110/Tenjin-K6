import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

function assignIds(blocks: any[]): any[] {
  return blocks.map(b => ({
    ...b,
    id: crypto.randomUUID(),
    children: b.children ? assignIds(b.children) : [],
    elseBlocks: b.elseBlocks ? assignIds(b.elseBlocks) : [],
  }));
}
export const templateRoutes = Router();

const templates = [
  // ── REST API ──────────────────────────────────────────
  {
    id: 'rest-api-health',
    name: 'REST API Health Check',
    description: 'Basic health check endpoint with status assertion',
    category: 'REST API',
    blocks: [
      { type: 'http-request', label: 'GET /health', enabled: true, properties: { method: 'GET', url: '__TARGET_URL__/health', headers: [], body: '' }, children: [
        { type: 'check', label: 'status is 200', enabled: true, properties: { target: 'status', operator: '==', expected: '200' }, children: [] },
        { type: 'check', label: 'response time < 500ms', enabled: true, properties: { target: 'response_time', operator: '<', expected: '500' }, children: [] },
      ]},
    ],
    content: `import http from 'k6/http';
import { check } from 'k6';

export const options = { vus: 1, duration: '10s' };

export default function () {
  const res = http.get('__TARGET_URL__/health');
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
    category: 'REST API',
    blocks: [
      { type: 'group', label: 'Create Resource', enabled: true, properties: { name: 'Create Resource' }, children: [
        { type: 'http-request', label: 'POST /users', enabled: true, properties: { method: 'POST', url: '__TARGET_URL__/users', headers: [{ key: 'Content-Type', value: 'application/json' }], body: '{"name":"test-${__VU}","email":"test@example.com"}' }, children: [
          { type: 'check', label: 'created', enabled: true, properties: { target: 'status', operator: '==', expected: '201' }, children: [] },
          { type: 'extract-variable', label: 'Extract user ID', enabled: true, properties: { variableName: 'userId', extractType: 'jsonpath', expression: '$.id' }, children: [] },
        ]},
      ]},
      { type: 'group', label: 'Read Resource', enabled: true, properties: { name: 'Read Resource' }, children: [
        { type: 'http-request', label: 'GET /users/${userId}', enabled: true, properties: { method: 'GET', url: '__TARGET_URL__/users/${userId}', headers: [], body: '' }, children: [
          { type: 'check', label: 'retrieved', enabled: true, properties: { target: 'status', operator: '==', expected: '200' }, children: [] },
        ]},
      ]},
      { type: 'group', label: 'Update Resource', enabled: true, properties: { name: 'Update Resource' }, children: [
        { type: 'http-request', label: 'PUT /users/${userId}', enabled: true, properties: { method: 'PUT', url: '__TARGET_URL__/users/${userId}', headers: [{ key: 'Content-Type', value: 'application/json' }], body: '{"name":"updated"}' }, children: [
          { type: 'check', label: 'updated', enabled: true, properties: { target: 'status', operator: '==', expected: '200' }, children: [] },
        ]},
      ]},
      { type: 'group', label: 'Delete Resource', enabled: true, properties: { name: 'Delete Resource' }, children: [
        { type: 'http-request', label: 'DELETE /users/${userId}', enabled: true, properties: { method: 'DELETE', url: '__TARGET_URL__/users/${userId}', headers: [], body: '' }, children: [
          { type: 'check', label: 'deleted', enabled: true, properties: { target: 'status', operator: '==', expected: '204' }, children: [] },
        ]},
      ]},
    ],
    content: `import http from 'k6/http';
import { check, group } from 'k6';

const BASE_URL = __ENV.TARGET_URL || '__TARGET_URL__';

export default function () {
  group('Create Resource', function () {
    const payload = JSON.stringify({ name: 'test-\${__VU}', email: 'test@example.com' });
    const createRes = http.post(\`\${BASE_URL}/users\`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    check(createRes, { 'created': (r) => r.status === 201 });
    const userId = JSON.parse(createRes.body).id;

    group('Read Resource', function () {
      const getRes = http.get(\`\${BASE_URL}/users/\${userId}\`);
      check(getRes, { 'retrieved': (r) => r.status === 200 });
    });

    group('Update Resource', function () {
      const updateRes = http.put(\`\${BASE_URL}/users/\${userId}\`, JSON.stringify({ name: 'updated' }), {
        headers: { 'Content-Type': 'application/json' },
      });
      check(updateRes, { 'updated': (r) => r.status === 200 });
    });

    group('Delete Resource', function () {
      const delRes = http.del(\`\${BASE_URL}/users/\${userId}\`);
      check(delRes, { 'deleted': (r) => r.status === 204 });
    });
  });
}`,
  },
  {
    id: 'rest-api-auth-flow',
    name: 'OAuth2 / JWT Auth Flow',
    description: 'Login, extract token, use for authenticated requests',
    category: 'REST API',
    blocks: [
      { type: 'group', label: 'Login', enabled: true, properties: { name: 'Login' }, children: [
        { type: 'http-request', label: 'POST /auth/login', enabled: true, properties: { method: 'POST', url: '__TARGET_URL__/auth/login', headers: [{ key: 'Content-Type', value: 'application/json' }], body: '{"email":"user@example.com","password":"password123"}' }, children: [
          { type: 'check', label: 'login succeeded', enabled: true, properties: { target: 'status', operator: '==', expected: '200' }, children: [] },
          { type: 'extract-variable', label: 'Extract token', enabled: true, properties: { variableName: 'token', extractType: 'jsonpath', expression: '$.token' }, children: [] },
        ]},
      ]},
      { type: 'group', label: 'Authenticated Requests', enabled: true, properties: { name: 'Authenticated Requests' }, children: [
        { type: 'auth-manager', label: 'Auth: Bearer Token', enabled: true, properties: { authType: 'bearer', token: '${token}' }, children: [] },
        { type: 'http-request', label: 'GET /user/profile', enabled: true, properties: { method: 'GET', url: '__TARGET_URL__/user/profile', headers: [], body: '' }, children: [
          { type: 'check', label: 'profile retrieved', enabled: true, properties: { target: 'status', operator: '==', expected: '200' }, children: [] },
        ]},
      ]},
    ],
    content: `import http from 'k6/http';
import { check, group } from 'k6';

const BASE_URL = __ENV.TARGET_URL || '__TARGET_URL__';

export default function () {
  group('Login', function () {
    const loginRes = http.post(\`\${BASE_URL}/auth/login\`, JSON.stringify({
      email: 'user@example.com',
      password: 'password123',
    }), { headers: { 'Content-Type': 'application/json' } });
    check(loginRes, { 'login succeeded': (r) => r.status === 200 });
    const token = JSON.parse(loginRes.body).token;

    group('Authenticated Requests', function () {
      const params = { headers: { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json' } };
      const profileRes = http.get(\`\${BASE_URL}/user/profile\`, params);
      check(profileRes, { 'profile retrieved': (r) => r.status === 200 });
    });
  });
}`,
  },
  {
    id: 'rest-api-file-upload',
    name: 'File Upload Test',
    description: 'Test file upload endpoints with multipart form data',
    category: 'REST API',
    content: `import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.TARGET_URL || '__TARGET_URL__';

export const options = { vus: 5, duration: '1m' };

export default function () {
  const fileContent = open('./test-file.pdf', 'b');
  const fileName = \`document-\${__VU}.pdf\`;
  const formData = {
    file: http.file(fileContent, fileName, 'application/pdf'),
    description: 'Test upload from VU ' + __VU,
  };
  const res = http.post(\`\${BASE_URL}/upload\`, formData);
  check(res, { 'upload succeeded': (r) => r.status === 201 });
  sleep(2);
}`,
  },

  // ── WebSocket ─────────────────────────────────────────
  {
    id: 'websocket-chat',
    name: 'WebSocket Chat Simulation',
    description: 'Simulate WebSocket chat with message exchange',
    category: 'WebSocket',
    content: `import ws from 'k6/ws';
import { check } from 'k6';

const WS_URL = __ENV.WS_URL || 'wss://ws.example.com/chat';

export default function () {
  const res = ws.connect(WS_URL, {}, function (socket) {
    socket.on('open', function () {
      socket.send(JSON.stringify({ type: 'join', room: 'general', user: 'user-\${__VU}' }));
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
    socket.on('error', function (e) {
      console.log('WebSocket error: ' + e.error());
    });
  });
  check(res, { 'connected': (r) => r && r.status === 101 });
}`,
  },
  {
    id: 'websocket-stock-ticker',
    name: 'WebSocket Stock Ticker',
    description: 'Subscribe to real-time stock ticker updates',
    category: 'WebSocket',
    content: `import ws from 'k6/ws';
import { check } from 'k6';

export const options = { vus: 10, duration: '1m' };

export default function () {
  const url = __ENV.WS_URL || 'wss://ws.example.com/stocks';
  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', function () {
      socket.send(JSON.stringify({ type: 'subscribe', symbols: ['AAPL', 'GOOGL', 'MSFT'] }));
    });
    let msgCount = 0;
    socket.on('message', function (data) { msgCount++; });
    socket.on('close', function () { console.log(\`Received \${msgCount} updates\`); });
    socket.setTimeout(function () { socket.close(); }, 55000);
  });
  check(res, { 'connected': (r) => r && r.status === 101 });
}`,
  },

  // ── gRPC ──────────────────────────────────────────────
  {
    id: 'grpc-unary',
    name: 'gRPC Unary Call',
    description: 'gRPC unary RPC with proto definition',
    category: 'gRPC',
    content: `import grpc from 'k6/net/grpc';
import { check } from 'k6';

const client = new grpc.Client();
client.load(['./proto'], 'service.proto');

export default function () {
  client.connect('localhost:50051', { timeout: '5s' });
  const res = client.invoke('package.Service/Method', { field1: 'value', field2: __VU });
  check(res, { 'gRPC succeeded': (r) => r.status === grpc.StatusOK });
  client.close();
}`,
  },
  {
    id: 'grpc-streaming',
    name: 'gRPC Server-Streaming',
    description: 'Consume a gRPC server-streaming API',
    category: 'gRPC',
    content: `import grpc from 'k6/net/grpc';
import { check } from 'k6';

const client = new grpc.Client();
client.load(['./proto'], 'streaming.proto');

export default function () {
  client.connect('localhost:50051', { timeout: '10s' });
  const stream = new grpc.Stream(client, 'package.Service/ServerStream');
  stream.on('data', function (data) { check(data, { 'received': (d) => d.message !== undefined }); });
  stream.on('error', function (err) { console.log('Stream error: ' + JSON.stringify(err)); });
  stream.write({ id: '' + __VU, subscribe: true });
  stream.setTimeout(function () { stream.end(); }, 5000);
  client.close();
}`,
  },

  // ── GraphQL ───────────────────────────────────────────
  {
    id: 'graphql-query',
    name: 'GraphQL Query',
    description: 'Execute a GraphQL query with dynamic variables',
    category: 'GraphQL',
    content: `import http from 'k6/http';
import { check } from 'k6';

const GRAPHQL_URL = __ENV.GRAPHQL_URL || '__TARGET_URL__/graphql';

const query = \`
  query GetUser($id: ID!) {
    user(id: $id) { id name email posts { title } }
  }
\`;

export default function () {
  const res = http.post(GRAPHQL_URL, JSON.stringify({ query, variables: { id: '' + __VU } }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'query succeeded': (r) => r.status === 200, 'has data': (r) => JSON.parse(r.body).data !== undefined });
}`,
  },

  // ── Browser ───────────────────────────────────────────
  {
    id: 'browser-load',
    name: 'Browser Page Load Test',
    description: 'Measure frontend performance with browser-level metrics',
    category: 'Browser',
    content: `import { browser } from 'k6/browser';
import { check } from 'k6';

export const options = {
  scenarios: {
    browser: { executor: 'constant-vus', vus: 5, duration: '30s', options: { browser: { type: 'chromium' } } },
  },
};

export default async function () {
  const page = await browser.newPage();
  try {
    await page.goto('__TARGET_URL__', { waitUntil: 'networkidle' });
    check(page, { 'page loaded': (p) => p.title() !== '' });
  } finally { await page.close(); }
}`,
  },
  {
    id: 'browser-ecommerce',
    name: 'Browser E-Commerce Flow',
    description: 'Complete e-commerce journey: browse, cart, checkout',
    category: 'Browser',
    content: `import { browser } from 'k6/browser';
import { check } from 'k6';

export const options = {
  scenarios: {
    ui: { executor: 'constant-vus', vus: 3, duration: '1m', options: { browser: { type: 'chromium' } } },
  },
};

export default async function () {
  const page = await browser.newPage();
  try {
    await page.goto('__TARGET_URL__');
    check(page, { 'loaded': (p) => p.locator('h1').textContent() === 'Welcome' });
    await page.locator('a[href="/products"]').click();
    await page.waitForSelector('.product-card');
    await page.locator('.product-card:first-child a').click();
    await page.waitForSelector('.add-to-cart');
    await page.locator('.add-to-cart').click();
    await page.locator('a[href="/cart"]').click();
    await page.waitForSelector('.checkout-btn');
    check(page, { 'cart has items': (p) => p.locator('.cart-item').count() > 0 });
  } finally { await page.close(); }
}`,
  },

  // ── Load Test ─────────────────────────────────────────
  {
    id: 'load-test-basic',
    name: 'HTTP Load Test',
    description: 'Basic HTTP GET load test with ramp-up stages',
    category: 'Load Test',
    content: `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const res = http.get('__TARGET_URL__');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}`,
  },
  {
    id: 'load-test-smoke',
    name: 'Smoke Test',
    description: 'Minimal smoke test to verify system responds',
    category: 'Load Test',
    content: `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = { vus: 1, duration: '30s' };

export default function () {
  const res = http.get('__TARGET_URL__');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}`,
  },
  {
    id: 'load-test-spike',
    name: 'Spike Load Test',
    description: 'Test system behavior under sudden traffic spike',
    category: 'Load Test',
    content: `import http from 'k6/http';
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
  thresholds: { http_req_duration: ['p(95)<2000'], http_req_failed: ['rate<0.05'] },
};

export default function () {
  const res = http.get('__TARGET_URL__');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}`,
  },
  {
    id: 'load-test-stress',
    name: 'Stress Test (Ramp-Up)',
    description: 'Gradually increase load to find breaking point',
    category: 'Load Test',
    content: `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 50 },
    { duration: '5m', target: 100 },
    { duration: '5m', target: 200 },
    { duration: '5m', target: 300 },
    { duration: '2m', target: 0 },
  ],
  thresholds: { http_req_duration: ['p(90)<1000', 'p(95)<2000'], http_req_failed: ['rate<0.01'] },
};

export default function () {
  const res = http.get('__TARGET_URL__/search?q=test');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(Math.random() * 2 + 0.5);
}`,
  },
  {
    id: 'load-test-soak',
    name: 'Soak / Endurance Test',
    description: 'Sustained load over a long period to detect memory leaks',
    category: 'Load Test',
    content: `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10m', target: 100 },
    { duration: '4h', target: 100 },
    { duration: '10m', target: 0 },
  ],
  thresholds: { http_req_duration: ['p(95)<3000'], http_req_failed: ['rate<0.02'] },
};

export default function () {
  const res = http.get('__TARGET_URL__');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(3);
}`,
  },
  {
    id: 'load-test-multi-scenario',
    name: 'Multi-Scenario Test',
    description: 'Combine multiple executors in one test',
    category: 'Load Test',
    content: `import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  scenarios: {
    browsing: { executor: 'constant-vus', vus: 50, duration: '10m', tags: { test_type: 'browsing' } },
    checkout: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '2m', target: 20 }, { duration: '5m', target: 20 }, { duration: '1m', target: 0 }], tags: { test_type: 'checkout' } },
    spike: { executor: 'ramping-arrival-rate', startRate: 1, timeUnit: '1s', preAllocatedVUs: 20, maxVUs: 100, stages: [{ duration: '30s', target: 5 }, { duration: '30s', target: 50 }, { duration: '1m', target: 50 }, { duration: '30s', target: 0 }] },
  },
};

export default function () {
  group('Product Browsing', function () {
    const res = http.get('__TARGET_URL__/products');
    check(res, { 'products loaded': (r) => r.status === 200 });
    sleep(Math.random() * 3 + 1);
  });
}`,
  },
  {
    id: 'load-test-advanced-thresholds',
    name: 'Advanced Thresholds & SLOs',
    description: 'Comprehensive thresholds with abort conditions',
    category: 'Load Test',
    content: `import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 50, duration: '5m',
  thresholds: {
    http_req_duration: ['p(90)<800', 'p(95)<1200', 'p(99)<2000', { threshold: 'avg<500', abortOnFail: true }],
    http_req_failed: ['rate<0.01'],
    http_reqs: ['rate>100'],
    'http_req_duration{name:critical}': ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const res = http.get('__TARGET_URL__', { tags: { name: 'critical' } });
  check(res, { 'status is 200': (r) => r.status === 200, 'fast response': (r) => r.timings.duration < 500 });
}`,
  },

  // ── Monitoring ────────────────────────────────────────
  {
    id: 'synthetic-monitoring',
    name: 'Synthetic Monitoring',
    description: 'Low-frequency production monitoring check',
    category: 'Monitoring',
    content: `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = { vus: 1, duration: '1m', thresholds: { http_req_duration: ['p(99)<1000'], http_req_failed: ['rate<0.01'] } };

const ENDPOINTS = [
  { url: '__TARGET_URL__/health', name: 'API Health' },
  { url: '__TARGET_URL__/status', name: 'Status' },
];

export default function () {
  for (const ep of ENDPOINTS) {
    const res = http.get(ep.url, { tags: { name: ep.name } });
    check(res, { 'status is 200': (r) => r.status === 200, 'fast': (r) => r.timings.duration < 1000 });
    sleep(5);
  }
}`,
  },

  // ── Integration ───────────────────────────────────────
  {
    id: 'ci-pipeline-gate',
    name: 'CI Pipeline Performance Gate',
    description: 'Quick performance check for CI/CD pipelines',
    category: 'Integration',
    content: `import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10, duration: '30s',
  thresholds: { http_req_duration: ['p(95)<500'], http_req_failed: ['rate<0.01'] },
};

export default function () {
  const res = http.get('__TARGET_URL__');
  check(res, { 'status is 200': (r) => r.status === 200 });
}`,
  },
  {
    id: 'data-parameterization',
    name: 'Data-Driven Test (CSV)',
    description: 'Load test data from CSV and parameterize requests',
    category: 'Integration',
    content: `import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { papaparse } from 'https://jslib.k6.io/papaparse/5.1.1/index.js';

const users = new SharedArray('users', function () {
  return papaparse.parse(open('./test-data.csv'), { header: true }).data;
});

export const options = { vus: 10, duration: '30s' };

export default function () {
  const user = users[__VU % users.length];
  const res = http.post('__TARGET_URL__/login', JSON.stringify({ email: user.email, password: user.password }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'logged in': (r) => r.status === 200 });
  sleep(1);
}`,
  },
  {
    id: 'custom-business-metrics',
    name: 'Custom Business Metrics',
    description: 'Track custom business metrics alongside k6 defaults',
    category: 'Integration',
    content: `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter, Gauge } from 'k6/metrics';

const orderValue = new Trend('order_value');
const checkoutSuccess = new Rate('checkout_success_rate');
const totalOrders = new Counter('total_orders');

export const options = {
  vus: 10, duration: '1m',
  thresholds: { order_value: ['p(90)<200', 'avg>50'], checkout_success_rate: ['rate>0.95'] },
};

export default function () {
  const res = http.post('__TARGET_URL__/checkout', JSON.stringify({
    userId: __VU, items: ['prod-1', 'prod-2'], total: Math.random() * 150 + 10,
  }), { headers: { 'Content-Type': 'application/json' } });
  if (res.status === 200) {
    const data = JSON.parse(res.body);
    orderValue.add(data.total);
    checkoutSuccess.add(true);
    totalOrders.add(1);
  } else { checkoutSuccess.add(false); }
  check(res, { 'processed': (r) => r.status < 500 });
  sleep(1);
}`,
  },

  // ── Database ──────────────────────────────────────────
  {
    id: 'db-postgres-query',
    name: 'PostgreSQL Query Test',
    description: 'Execute SQL queries against a PostgreSQL database',
    category: 'Database',
    content: `import { postgres } from 'k6/experimental/postgres';
import { check, sleep } from 'k6';

const DEFAULT_DB = {
  host: '__DB_HOST__',
  port: __DB_PORT__,
  db: '__DB_NAME__',
  user: '__DB_USER__',
  password: '__DB_PASS__',
};

export const options = { vus: 1, iterations: 1 };

export default function () {
  const dbUrl = __ENV.DATABASE_URL || \`postgres://\${DEFAULT_DB.user}:\${DEFAULT_DB.password}@\${DEFAULT_DB.host}:\${DEFAULT_DB.port}/\${DEFAULT_DB.db}\`;
  const pool = postgres.Pool(dbUrl);
  const conn = pool.connect();

  try {
    const result = conn.query('SELECT 1 AS health');
    check(result, {
      'query succeeded': (r) => r !== undefined,
      'has rows': (r) => r.length > 0,
    });

    const queryResult = conn.query('SELECT NOW() AS current_time, current_database() AS db');
    check(queryResult, {
      'has current time': (r) => r[0]?.current_time !== undefined,
    });

    console.log(\`Query returned \${queryResult.length} rows\`);
  } finally {
    conn.close();
    pool.close();
  }
  sleep(1);
}`,
  },
  {
    id: 'db-mysql-query',
    name: 'MySQL Query Test',
    description: 'Execute SQL queries against a MySQL database',
    category: 'Database',
    content: `import mysql from 'k6/experimental/mysql';
import { check, sleep } from 'k6';

const config = {
  host: __ENV.DB_HOST || '__DB_HOST__',
  port: __ENV.DB_PORT || __DB_PORT__,
  db: __ENV.DB_NAME || '__DB_NAME__',
  user: __ENV.DB_USER || '__DB_USER__',
  password: __ENV.DB_PASS || '__DB_PASS__',
};

export const options = { vus: 1, iterations: 1 };

export default function () {
  const conn = mysql.connect(config);

  try {
    const result = conn.query('SELECT 1 AS health');
    check(result, { 'mysql connected': (r) => r[0]?.health === 1 });

    const tables = conn.query('SHOW TABLES');
    check(tables, { 'tables listed': (r) => r.length > 0 });
    console.log(\`Found \${tables.length} tables\`);

    const version = conn.query('SELECT VERSION() AS version');
    check(version, { 'version retrieved': (r) => r[0]?.version !== undefined });
  } finally {
    conn.close();
  }
  sleep(1);
}`,
  },
  {
    id: 'db-benchmark-query',
    name: 'Database Query Benchmark',
    description: 'Benchmark database query performance under load',
    category: 'Database',
    content: `import { postgres } from 'k6/experimental/postgres';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const queryDuration = new Trend('db_query_duration');

const dbUrl = __ENV.DATABASE_URL || 'postgres://user:pass@localhost:5432/mydb';

export const options = {
  vus: 10,
  duration: '1m',
  thresholds: {
    db_query_duration: ['p(95)<100'],
  },
};

export default function () {
  const pool = postgres.Pool(dbUrl);
  const conn = pool.connect();

  try {
    const start = Date.now();
    const result = conn.query('SELECT id, name, email FROM users LIMIT 10');
    const elapsed = Date.now() - start;
    queryDuration.add(elapsed);

    check(result, {
      'data returned': (r) => r.length > 0,
    });

    sleep(1);
  } finally {
    conn.close();
    pool.close();
  }
}`,
  },
];

/**
 * @openapi
 * /templates:
 *   get:
 *     tags: [Templates]
 *     summary: List available script templates
 *     responses:
 *       200:
 *         description: List of templates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   name: { type: string }
 *                   description: { type: string }
 *                   category: { type: string }
 *                   content: { type: string }
 */
templateRoutes.get('/templates', (_req: Request, res: Response) => {
  res.json(templates);
});

const createFromSchema = z.object({
  templateId: z.string(),
  projectId: z.string().uuid(),
  name: z.string().min(1).max(255),
});

/**
 * @openapi
 * /templates/use:
 *   post:
 *     tags: [Templates]
 *     summary: Create a script from a template
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               templateId: { type: string }
 *               projectId: { type: string, format: uuid }
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: Script created from template
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Script'
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Template not found
 */
templateRoutes.post('/templates/use', async (req: Request, res: Response) => {
  const parsed = createFromSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues }); return; }
  const body = parsed.data;
  const template = templates.find((t) => t.id === body.templateId);
  if (!template) {
    res.status(404).json({ message: 'Template not found' });
    return;
  }

  const script = await prisma.script.create({
    data: {
      name: body.name,
      content: template.content,
      projectId: body.projectId,
      blocks: template.blocks ? JSON.stringify(assignIds(template.blocks)) : undefined,
    },
  });

  logger.info({ scriptId: script.id, templateId: body.templateId }, 'Script created from template');
  res.status(201).json(script);
});
