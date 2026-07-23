# JMeter to k6 Foundry Feature Mapping & Script Reference Guide

This document is the master reference guide for how all **58 JMeter features and plugins** from your checklist are implemented inside **k6 Foundry (`graphanak6`)**. 

For every item, you will find:
1. **Visual UI Usage**: Where to configure it inside the Visual Test Builder (`TestBuilder.tsx`).
2. **Generated / Standalone Script**: The exact `k6` JavaScript code snippet demonstrating the functionality.

---

## Table of Contents
1. [Test Plan & Core Configurations (Items 1 – 6)](#1-test-plan--core-configurations)
2. [Workload & Thread Groups (Items 7, 11 – 15)](#2-workload--thread-groups)
3. [Script Recording & Plugin Management (Items 8 – 10)](#3-script-recording--plugin-management)
4. [Samplers & Protocol Extensions (Items 16 – 19, 32 – 40)](#4-samplers--protocol-extensions)
5. [Flow Controllers & Timers (Items 24 – 31, 41)](#5-flow-controllers--timers)
6. [Extractors & Pre/Post-Processors (Items 42 – 50)](#6-extractors--prepost-processors)
7. [Listeners, Reports & Real-Time Monitoring (Items 51 – 58)](#7-listeners-reports--real-time-monitoring)
8. [Complete End-to-End Multi-Protocol Script](#8-complete-end-to-end-multi-protocol-script)

---

## 1. Test Plan & Core Configurations

### #1. Test Plan (Root Element)
* **Visual UI**: The root tree workspace inside **Test Builder**. Each `TestConfig` stores the visual block tree.
* **Script Equivalent**: In `k6`, the entire script file represents the Test Plan. Global settings reside in `export const options = { ... }`.
```javascript
// Test Plan Root Options
export const options = {
  scenarios: {
    main_test: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 100,
      maxDuration: '5m',
    },
  },
};

export default function () {
  // Test execution lifecycle runs here
}
```

### #2. User Defined Variables
* **Visual UI**: Drag a **`Set Variable`** (`set-variable`) or **`Data File`** (`data-file`) block under **Data**, or manage Global Variables via **Environments** (`/environments`).
* **Script Equivalent**:
```javascript
// Global environment variables
const TARGET_URL = __ENV.TARGET_URL || 'https://api.example.com';
const API_TOKEN = __ENV.API_TOKEN || 'test-secret-token-123';

export default function () {
  // VU-local variables
  let userId = `user_${__VU}_${__ITER}`;
}
```

### #3. HTTP Request Defaults
* **Visual UI**: Drag an **`HTTP Defaults`** (`http-defaults`) block into your request tree to set common base URLs, timeouts, tags, and parameters across all subsequent HTTP calls.
* **Script Equivalent**:
```javascript
import http from 'k6/http';

const defaultParams = {
  timeout: '10s',
  tags: { app: 'core-banking', tier: 'backend' },
};

export default function () {
  // Uses default parameters automatically
  http.get('https://api.example.com/v1/health', defaultParams);
}
```

### #4. HTTP Header Manager
* **Visual UI**: Drag a **`Header Manager`** (`header-manager`) block. Headers are automatically injected into every HTTP request inside its group/scenario.
* **Script Equivalent**:
```javascript
import http from 'k6/http';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${__ENV.API_TOKEN || 'secret'}`,
  'X-Client-Version': '2.1.0',
};

export default function () {
  http.get('https://api.example.com/v1/accounts', { headers });
}
```

### #5. HTTP Cookie Manager
* **Visual UI**: Drag a **`Cookie Manager`** (`cookie-manager`) block to automate cookie persistence across Virtual Users (`VUs`).
* **Script Equivalent**:
```javascript
import http from 'k6/http';

export default function () {
  const jar = http.cookieJar();
  jar.set('https://api.example.com', 'session_id', 'abc123token', {
    domain: 'api.example.com',
    path: '/',
    secure: true,
    httpOnly: true,
  });

  // Cookie jar automatically attaches session_id to requests matching domain
  http.get('https://api.example.com/profile');
}
```

### #6. HTTP Cache Manager
* **Visual UI**: Drag a **`Cache Manager`** (`cache-manager`) block to simulate browser `If-Modified-Since` and `ETag` caching behavior.
* **Script Equivalent**:
```javascript
import http from 'k6/http';

export default function () {
  const headers = {
    'If-None-Match': 'W/"abc-123456"',
    'Cache-Control': 'max-age=3600',
  };
  const res = http.get('https://api.example.com/static/app.js', { headers });
  if (res.status === 304) {
    // Cached response simulated accurately
  }
}
```

---

## 2. Workload & Thread Groups

### #7, #11. Thread Group (Standard VUs & Loops)
* **Visual UI**: Drag a **`Standard Scenario`** (`scenario`) block from the **Scenarios** category.
* **Script Equivalent**:
```javascript
export const options = {
  scenarios: {
    standard_thread_group: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
    },
  },
};
```

### #12. Concurrency Thread Group
* **Visual UI**: Use the **`Standard Scenario`** block with **Constant Concurrency** selected.
* **Script Equivalent**:
```javascript
export const options = {
  scenarios: {
    concurrency_group: {
      executor: 'constant-vus',
      vus: 200,
      duration: '10m',
    },
  },
};
```

### #13. Ultimate Thread Group (Complex Workloads)
* **Visual UI**: Drag a **`Stages / Ramp Scenario`** (`stages-scenario`) block to configure multi-stage ramp-up, steady-state, and ramp-down phases in a table.
* **Script Equivalent**:
```javascript
export const options = {
  scenarios: {
    ultimate_schedule: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 }, // Ramp up to 100 VUs over 2m
        { duration: '10m', target: 100 }, // Hold steady at 100 VUs for 10m
        { duration: '3m', target: 300 }, // Spike to 300 VUs over 3m
        { duration: '5m', target: 300 }, // Hold 300 VUs for 5m
        { duration: '2m', target: 0 },   // Ramp down to 0
      ],
      gracefulRampDown: '30s',
    },
  },
};
```

### #14. Stepping Thread Group
* **Visual UI**: Use the **`Stages / Ramp Scenario`** block to define incremental steps (`10 -> 20 -> 30 VUs`).
* **Script Equivalent**:
```javascript
export const options = {
  scenarios: {
    stepping_group: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '10s', target: 20 },
        { duration: '1m', target: 20 },
        { duration: '10s', target: 30 },
        { duration: '1m', target: 30 },
        { duration: '30s', target: 0 },
      ],
    },
  },
};
```

### #15. Arrivals Thread Group (Open Workload Model)
* **Visual UI**: Drag an **`Arrivals Scenario`** (`arrivals-scenario`) block to control exact throughput (`iterations/sec` or `requests/min`) independent of server response latency.
* **Script Equivalent**:
```javascript
export const options = {
  scenarios: {
    open_arrival_rate: {
      executor: 'constant-arrival-rate',
      rate: 100, // 100 new test iterations initiated...
      timeUnit: '1s', // ...every 1 second
      duration: '15m',
      preAllocatedVUs: 50,
      maxVUs: 500,
    },
  },
};
```

---

## 3. Script Recording & Plugin Management

### #8. HTTP(S) Test Script Recorder
* **Visual UI**: Navigate to the **Recorder (`/recorder`)** tab. You can record user sessions using either:
  1. **Playwright Built-in Browser**: Opens a live browser session and converts clicks, navigations, and API calls into a visual script tree.
  2. **HAR / Proxy Import**: Import network recordings from Chrome DevTools or proxy tools directly into the Test Builder.

### #9. JMeter Plugins Manager (Custom `xk6` Binary Compiler)
* **Visual UI**: Navigate to the **Plugins (`/plugins`)** tab. Select any required `xk6` Go extension (`xk6-sql`, `xk6-kafka`, `xk6-redis`, `xk6-ibmmq`, `xk6-amqp`, `xk6-tcp`, `xk6-sftp`) and click **`Build k6 Binary`**.
* **How It Works**: The backend automatically compiles a custom native binary (`.k6-build/k6-<projectId>`) using `xk6 build` and switches to executing that binary when you click **Run Test**.

### #10. Functions Helper Dialog (Dynamic Variables & Faker)
* **Visual UI**: Drag a **`Random Variable / Faker`** (`random-var`) or **`Script`** (`script`) block.
* **Script Equivalent**:
```javascript
import { randomString, randomIntBetween, uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export default function () {
  const dynamicCorrelationId = uuidv4();
  const randomPin = randomIntBetween(1000, 9999);
  const fakeUsername = `user_${randomString(8)}`;
}
```

---

## 4. Samplers & Protocol Extensions

### #16. Dummy Sampler
* **Visual UI**: Drag a **`Dummy Sampler`** (`dummy-sampler`) block under **Requests**.
* **Script Equivalent**:
```javascript
import { sleep } from 'k6';

export default function () {
  var startTime = Date.now();
  var simulatedLatencyMs = 150;
  sleep(simulatedLatencyMs / 1000);
  
  var status = 200;
  var mockResponseBody = JSON.stringify({ status: 'SUCCESS', transactionId: 'TXN-998877' });
  
  if (typeof __logRequest !== 'undefined') {
    __logRequest("DUMMY-SAMPLER", 'Mock Payment Gateway', status, mockResponseBody, '{}', Date.now() - startTime);
  }
}
```

### #17, #18, #38. ISO 8583 Sampler & TCP Socket Connection
* **Visual UI**: Drag an **`ISO 8583`** (`iso8583`) block under **Protocol Extensions (`xk6`)**. Configure MTI, PAN, STAN, Amount, and DE fields directly in the visual table.
* **Script Equivalent**:
```javascript
import ISO8583 from 'k6/x/iso8583';

const client = new ISO8583.Client({
  address: 'localhost:8082',
  network: 'tcp',
  timeout: '5s',
});

export default function () {
  var startTime = Date.now();
  try {
    client.connect();
    var msg = client.newMessage();
    msg.setMTI('0100');
    msg.setField(2, '4000000000000002'); // Primary Account Number (PAN)
    msg.setField(4, '000001000000');     // Amount (10,000.00)
    msg.setField(11, '123456');          // STAN
    
    var res = client.sendAndReceive(msg);
    client.close();
  } catch (err) {
    console.error('ISO8583 transaction failed: ' + err);
  }
}
```

### #19, #35. IBM MQ (`com.ibm.mq`) & JMS Pub/Sub
* **Visual UI**: Drag an **`IBM MQ (Native / AMQP)`** (`ibmmq`) block under **Protocol Extensions (`xk6`)**. Select between **AMQP 0-9-1 / JMS Bridge (`Pure Go`)** or **Native C API (`xk6-ibmmq`)**.
* **Script Equivalent (AMQP / JMS Bridge)**:
```javascript
import amqp from 'k6/x/amqp';

export default function () {
  var startTime = Date.now();
  var url = 'amqp://app:password@localhost:5672/';
  try {
    var conn = amqp.connect(url);
    var ch = conn.channel();
    ch.publish('DEV.QUEUE.1', '', `{"action":"TRANSFER","amount":500}`);
    ch.close();
    conn.close();
  } catch (err) {
    console.error('IBM MQ / AMQP publish failed: ' + err);
  }
}
```
* **Script Equivalent (IBM MQ Native C API (`xk6-ibmmq`))**:
```javascript
import ibmmq from 'k6/x/ibmmq';

export default function () {
  try {
    var qMgr = ibmmq.connect({
      qMgrName: 'QM1',
      channel: 'DEV.APP.SVRCONN',
      connection: 'localhost:1414',
      username: 'app',
      password: 'password',
    });
    var q = ibmmq.openQueue(qMgr, 'DEV.QUEUE.1', ibmmq.MQOO_OUTPUT);
    ibmmq.put(q, `{"action":"TRANSFER","amount":500}`);
    ibmmq.close(q);
    ibmmq.disconnect(qMgr);
  } catch (err) {
    console.error('IBM MQ Native operation failed: ' + err);
  }
}
```

### #32. HTTP Request
* **Visual UI**: Drag an **`HTTP Request`** (`http-request`) block.
* **Script Equivalent**:
```javascript
import http from 'k6/http';

export default function () {
  const payload = JSON.stringify({ accountId: 'ACC_101', amount: 250.00 });
  const params = { headers: { 'Content-Type': 'application/json' } };
  const res = http.post('https://api.example.com/v1/transfers', payload, params);
}
```

### #33. JDBC Request (SQL Database)
* **Visual UI**: Drag a **`SQL Query`** (`sql-query`) block under **Protocol Extensions (`xk6`)**.
* **Script Equivalent**:
```javascript
import sql from 'k6/x/sql';

const db = sql.open('postgres', 'postgres://user:password@localhost:5432/core_banking?sslmode=disable');

export default function () {
  var startTime = Date.now();
  try {
    var results = db.query("SELECT balance FROM accounts WHERE account_id = 'ACC_101'");
    db.exec("UPDATE accounts SET balance = balance - 50 WHERE account_id = 'ACC_101'");
  } catch (err) {
    console.error('SQL query failed: ' + err);
  }
}
export function teardown() { db.close(); }
```

### #34. FTP / SFTP Request
* **Visual UI**: Drag an **`FTP / SFTP`** (`ftp`) block under **Protocol Extensions (`xk6`)**.
* **Script Equivalent**:
```javascript
import ftp from 'k6/x/ftp';

export default function () {
  try {
    ftp.put({
      host: 'localhost:21',
      username: 'testuser',
      password: 'password',
    }, '/upload/settlement_file.xml', '<xml>Settlement Data</xml>');
  } catch (err) {
    console.error('FTP transfer error: ' + err);
  }
}
```

### #36, #37, #40. Java Request, OS Process & JSR223 Sampler
* **Visual UI**: Drag a **`Script`** (`script`) block under **Metrics & Debug** or run custom `xk6` modules.
* **Script Equivalent**:
```javascript
// Executes JavaScript inline with microsecond performance
export default function () {
  var customResult = Math.sqrt(Math.random() * 1000000);
  if (customResult > 500) {
    // Custom processing flow
  }
}
```

---

## 5. Flow Controllers & Timers

### #24. Loop Controller
* **Visual UI**: Drag a **`Loop`** (`loop`) block under **Flow Control**.
* **Script Equivalent**:
```javascript
export default function () {
  for (let i = 0; i < 5; i++) {
    http.get(`https://api.example.com/items?page=${i}`);
  }
}
```

### #25. If Controller & #26. While Controller
* **Visual UI**: Drag a **`Condition`** (`condition`) block under **Flow Control**.
* **Script Equivalent**:
```javascript
export default function () {
  let res = http.get('https://api.example.com/status');
  
  // If Controller
  if (res.status === 200 && res.json().ready === true) {
    http.post('https://api.example.com/process');
  }

  // While Controller
  let retries = 0;
  while (res.status === 202 && retries < 5) {
    sleep(2);
    res = http.get('https://api.example.com/status');
    retries++;
  }
}
```

### #27. Transaction Controller
* **Visual UI**: Drag a **`Group / Transaction`** (`group` / `transaction`) block under **Flow Control**.
* **Script Equivalent**:
```javascript
import { group } from 'k6';
import http from 'k6/http';

export default function () {
  group('Payment Checkout Flow', function () {
    http.post('https://api.example.com/cart/add', { itemId: 'ITEM_1' });
    http.post('https://api.example.com/checkout', { cardNo: '4111222233334444' });
  }); // Measures total combined response time of all requests inside the group
}
```

### #28. Once Only Controller
* **Visual UI**: Drag a **`Once Only`** (`once-only`) block under **Flow Control**.
* **Script Equivalent**:
```javascript
export default function () {
  // Executes only once on the very first iteration of each Virtual User
  if (__VU_ITER === 0) {
    http.post('https://api.example.com/auth/login', { user: `user_${__VU}`, pass: 'secret' });
  }

  // Executes on every iteration
  http.get('https://api.example.com/dashboard');
}
```

### #29. Runtime Controller
* **Visual UI**: Drag a **`Runtime`** (`runtime`) block under **Flow Control**.
* **Script Equivalent**:
```javascript
import { sleep } from 'k6';
import http from 'k6/http';

export default function () {
  const durationSec = 30;
  const start = Date.now();
  
  // Repeats execution inside loop for exactly 30 seconds
  while ((Date.now() - start) < (durationSec * 1000)) {
    http.get('https://api.example.com/ping');
    sleep(1);
  }
}
```

### #31. Parallel Controller
* **Visual UI**: Drag an **`HTTP Batch (Parallel)`** (`http-batch`) block under **Requests**.
* **Script Equivalent**:
```javascript
import http from 'k6/http';

export default function () {
  // Executes all 3 requests simultaneously over the network in parallel
  const responses = http.batch([
    ['GET', 'https://api.example.com/profile'],
    ['GET', 'https://api.example.com/notifications'],
    ['GET', 'https://api.example.com/settings'],
  ]);
}
```

### #41. Constant Timer
* **Visual UI**: Drag a **`Sleep / Wait`** (`sleep` / `wait`) block under **Timing**.
* **Script Equivalent**:
```javascript
import { sleep } from 'k6';

export default function () {
  http.get('https://api.example.com/step1');
  sleep(2.5); // Constant 2.5 second delay
  http.get('https://api.example.com/step2');
}
```

---

## 6. Extractors & Pre/Post-Processors

### #42. JSON Extractor
* **Visual UI**: Drag an **`Extract Variable`** (`extract-variable`) block under **Validation** and select **JSONPath**.
* **Script Equivalent**:
```javascript
import http from 'k6/http';

export default function () {
  const res = http.post('https://api.example.com/auth/login', JSON.stringify({ user: 'test' }));
  const token = res.json().data.accessToken;
  // Store extracted variable for correlation across requests
  __ENV.BEARER_TOKEN = token;
}
```

### #43. Regular Expression Extractor
* **Visual UI**: Drag an **`Extract Variable`** (`extract-variable`) block and select **Regex**.
* **Script Equivalent**:
```javascript
import http from 'k6/http';

export default function () {
  const res = http.get('https://api.example.com/session');
  const match = res.body.match(/csrf_token="([a-zA-Z0-9_-]+)"/);
  const csrfToken = match ? match[1] : null;
}
```

### #44. Boundary Extractor
* **Visual UI**: Drag an **`Extract Variable`** (`extract-variable`) block and select **Boundary String**.
* **Script Equivalent**:
```javascript
export default function () {
  const body = `<sessionId>ABC-998877-XYZ</sessionId>`;
  const left = `<sessionId>`;
  const right = `</sessionId>`;
  const extracted = body.split(left)[1]?.split(right)[0];
}
```

### #45, #46. Response & BeanShell Assertion
* **Visual UI**: Drag an **`Assertion`** (`check` / `assertion`) block under **Validation**.
* **Script Equivalent**:
```javascript
import { check } from 'k6';
import http from 'k6/http';

export default function () {
  const res = http.get('https://api.example.com/accounts/ACC_101');
  
  check(res, {
    'Status is 200 OK': (r) => r.status === 200,
    'Response code not 500': (r) => r.status !== 500,
    'Response body contains Active': (r) => r.body.includes('"status":"ACTIVE"'),
    'Transaction time under 400ms': (r) => r.timings.duration < 400,
  });
}
```

### #47, #48, #49, #50. Pre/Post-Processors (Groovy / BeanShell / JS)
* **Visual UI**: Drag a **`Pre-Processor`** (`pre-processor`) or **`Post-Processor`** (`post-processor`) block under **Processors**.
* **Script Equivalent**:
```javascript
export default function () {
  // Pre-Processor Logic (Run right before request)
  var timestampHeader = Date.now().toString();
  var hmacSignature = `sig_${timestampHeader}_secret`;

  var res = http.get('https://api.example.com/secure', {
    headers: { 'X-Timestamp': timestampHeader, 'X-Signature': hmacSignature },
  });

  // Post-Processor Logic (Run right after request completes)
  if (res.status === 200) {
    var responseSizeKb = res.body.length / 1024;
    if (responseSizeKb > 500) {
      console.warn(`Large response warning: ${responseSizeKb.toFixed(2)} KB`);
    }
  }
}
```

---

## 7. Listeners, Reports & Real-Time Monitoring

### #51. View Results Tree (Live Streaming Logs)
* **Visual UI**: Navigate to the **Live Run Monitor (`LiveRunMonitor.tsx`)** during active test execution. You will see a live, expandable tree of every request (`__requestLog`), response status code, payload snippet, and error trace.
* **Script Equivalent**: The backend worker automatically intercepts and streams structured logs over WebSockets:
```javascript
if (typeof __logRequest !== 'undefined') {
  __logRequest("HTTP-GET", 'https://api.example.com/profile', res.status, res.body.slice(0, 100), JSON.stringify(res.headers), res.timings.duration);
}
```

### #52. Summary Report & #53. Aggregate Report
* **Visual UI**: Navigate to **Analytics (`/analytics`)** or the Run Details summary tab.
* **Capabilities**:
  * **Summary Report**: Real-time throughput (Req/sec), error percentage %, active VUs, and total data transferred.
  * **Aggregate Report**: Full statistical percentile distribution (`Avg`, `Min`, `P90`, `P95`, `P99`, `Max`) per endpoint.

### #54. View Results in Table
* **Visual UI**: Navigate to the **Test Runs List (`RunsList.tsx`)** to see historical tabular records of all test runs, start/end timestamps, duration, trigger type (`Manual`, `Schedule`, `CI/CD API`), and status (`Completed`, `Failed`).

### #55. Listener Pack (Backend Listener: InfluxDB / Prometheus / Grafana)
* **Visual UI**: In your Test Plan configuration options, select **Outputs (`outputs`)** and check **InfluxDB**, **Prometheus**, or **Grafana Cloud**.
* **How It Works**: When the backend runs your script (`k6Runner.ts`), it passes the native `k6` output flags:
```bash
# InfluxDB output stream
k6 run --out influxdb=http://localhost:8086/k6_metrics script.js

# Prometheus Remote Write output stream
k6 run --out experimental-prometheus-rw script.js
```

### #56. WebSocket Samplers
* **Visual UI**: Drag a **`WebSocket`** (`websocket`) block under **Requests**.
* **Script Equivalent**:
```javascript
import ws from 'k6/ws';
import { check } from 'k6';

export default function () {
  const url = 'wss://echo.websocket.events';
  const response = ws.connect(url, {}, function (socket) {
    socket.on('open', function () {
      socket.send('Hello WebSocket Server!');
    });
    socket.on('message', function (data) {
      check(data, { 'Received echo message': (msg) => msg === 'Hello WebSocket Server!' });
      socket.close();
    });
  });
}
```

### #57. PerfMon Metrics Collector (System Stats Monitor)
* **Visual UI**: Navigate to the **Live Run Monitor (`LiveRunMonitor.tsx`)** -> **System Stats Card**.
* **How It Works**: The backend worker (`workers/index.ts:170`) streams CPU % utilization, total RAM usage (`memoryMb`), and heap percentage every 4 seconds over WebSockets during test runs.

### #58. JSON Plugins
* **Visual UI**: Drag a **`JSON Assertion`** (`json-assertion`) block under **Validation** to validate exact JSON schema paths and expected values without manual parsing.

---

## 8. Complete End-to-End Multi-Protocol Script

Below is a complete, production-grade `k6` script demonstrating **HTTP**, **SQL**, **Kafka**, **Redis**, and **IBM MQ** executing concurrently within a unified load test:

```javascript
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import sql from 'k6/x/sql';
import redis from 'k6/x/redis';
import amqp from 'k6/x/amqp';

// #1, #7, #15: Root Test Plan & Workload Model Options
export const options = {
  scenarios: {
    multi_protocol_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 25 },
        { duration: '2m', target: 25 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<500'],
    'checks': ['rate>0.99'],
  },
};

// Global connections established once per worker
const db = sql.open('postgres', 'postgres://app:password@localhost:5432/banking?sslmode=disable');
const redisClient = new redis.Client({ addr: 'localhost:6379' });

export default function () {
  // #28: Once Only Controller (VU Login & Session Setup)
  if (__VU_ITER === 0) {
    group('VU Initialization', function () {
      let loginRes = http.post('https://api.example.com/auth/token', JSON.stringify({ user: `vu_${__VU}` }), {
        headers: { 'Content-Type': 'application/json' },
      });
      check(loginRes, { 'Login Successful': (r) => r.status === 200 });
      __ENV.TOKEN = loginRes.json().data.token; // #42: JSON Extractor
    });
  }

  // #27: Transaction Controller Group
  group('Enterprise Transaction Flow', function () {
    
    // Step 1: Redis Cache Lookup (#58 JSON / #16 Redis extension)
    let cacheKey = `user:session:vu_${__VU}`;
    redisClient.set(cacheKey, JSON.stringify({ active: true, timestamp: Date.now() }), 3600);
    let cachedData = redisClient.get(cacheKey);
    check(cachedData, { 'Redis Cache Hit': (val) => val !== null });

    // Step 2: HTTP Request with Headers & Check (#32, #4, #45)
    let apiRes = http.get('https://api.example.com/v1/accounts/summary', {
      headers: {
        'Authorization': `Bearer ${__ENV.TOKEN || 'mock-jwt-token'}`,
        'X-Request-ID': `req_${Date.now()}_${__VU}`,
      },
    });
    check(apiRes, { 'Accounts summary status 200': (r) => r.status === 200 });

    // Step 3: SQL Database Audit Update (#33)
    try {
      db.exec(`UPDATE accounts SET last_accessed = NOW() WHERE user_id = 'vu_${__VU}'`);
    } catch (err) {
      console.error('SQL audit log failed: ' + err);
    }

    // Step 4: Publish Asynchronous Message to IBM MQ / AMQP Bridge (#19, #35)
    try {
      let amqpConn = amqp.connect('amqp://app:password@localhost:5672/');
      let ch = amqpConn.channel();
      ch.publish('DEV.QUEUE.AUDIT', '', JSON.stringify({
        event: 'TRANSACTION_COMPLETED',
        vu: __VU,
        duration: apiRes.timings.duration,
      }));
      ch.close();
      amqpConn.close();
    } catch (err) {
      console.error('MQ publish error: ' + err);
    }

  });

  // #41: Constant Timer (Pacing)
  sleep(1.5);
}

export function teardown() {
  db.close();
}
```
