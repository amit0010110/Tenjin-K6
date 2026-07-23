# Tenjin & k6 Performance Engineering: Visual Design Builder, Load Patterns, JMeter Dummy Sampler & Master Reference Scripts

This comprehensive guide answers your core questions regarding how **Functions and Patterns** work inside the **Visual Design Builder**, how **JMeter's Dummy Sampler** works (and how to achieve identical mocking behavior in Tenjin/k6), and provides **complete, ready-to-run reference scripts** illustrating every advanced capability in the application.

---

## Part 1: How Functions & Patterns Work in the Visual Design Builder

The **Visual Design Builder** allows performance engineers and QA automation teams to construct complex performance tests graphically without manual coding. Under the hood, the Visual Builder transpiles your visual blocks into production-grade JavaScript (`k6`) scripts.

### 1. What are "Functions" inside the Design Builder?
Functions in the Design Builder represent **atomic test actions and behavioral logic** executed by each Virtual User (VU) during an iteration. When you drag and drop blocks into the canvas, they map directly to high-performance k6 API calls:

| Visual Block Function | Underlying k6 / JS Action | Purpose & Practical Use Case |
| :--- | :--- | :--- |
| **HTTP Request (`GET`, `POST`, `PUT`, `DELETE`)** | `http.request(method, url, payload, params)` | Sends actual network requests to target endpoints. Supports dynamic headers, authentication tokens (`Bearer`, `Basic`), and body payloads (`JSON`, `Form-data`). |
| **Group (`Transaction Container`)** | `group('Transaction Name', function() { ... })` | Organizes multiple requests into a single logical business transaction (e.g., `Checkout Flow` or `User Login`). Captures aggregate duration across all nested requests. |
| **Think Time (`Sleep / Delay`)** | `sleep(Math.random() * (max - min) + min)` | Simulates realistic human pacing between page clicks. Prevents artificial server DDOSing and ensures accurate user behavior modeling. |
| **Check (`Assertion & Validation`)** | `check(res, { 'status is 200': (r) => r.status === 200 })` | Validates HTTP status codes, response times (`r.timings.duration < 500`), and JSON payload structures. Checks do **not** halt test execution if failed (unlike exceptions), but record pass/fail metrics. |
| **Auto-Correlation (`Extractor`)** | `res.json('token')` or `res.body.match(/csrf="([^"]+)"/)[1]` | Extracts dynamic session tokens, CSRF headers, or order IDs from a previous response and injects them into subsequent requests (`${correlation_token}`). |
| **Data File Reference (`SharedArray`)** | `new SharedArray('data', () => papaparse.parse(...))` | Reads CSV/JSON test data once into memory across all VUs (`O(1)` memory overhead) and feeds unique rows (`data[__VU % data.length]`) to requests. |

---

### 2. What is the Use of "Patterns" (Load Profiles)?
**Patterns** define the mathematical curve of traffic concurrency over time—dictating **how many VUs execute your functional blocks at any given second**. Choosing the right pattern is critical for discovering specific classes of architectural bottlenecks:

```
    Spike Test          Ramp Up / Capacity         Soak / Endurance
       /\                      /-----------               /-------------
      /  \                    /                          /
_____/    \_____        _____/                     _____/
```

1. **Ramp Up (Capacity & Scalability Testing)**
   - **How it works**: Gradually increases VUs (`0 -> 50 -> 200 -> 500`) over steps (`stages`).
   - **Use Case**: Identifies your system's inflection point—finding the exact VU threshold where response latency degrades exponentially or where database connection pools exhaust (`max_connections`).

2. **Spike Testing (Resilience & Auto-Scaling Verification)**
   - **How it works**: Instantly spikes traffic from baseline to massive volume (`10 VUs -> 1,000 VUs in 10 seconds`).
   - **Use Case**: Verifies whether Kubernetes horizontal pod autoscalers (HPA), AWS Lambda cold starts, and API rate limiters (`429 Too Many Requests`) react gracefully without crashing upstream databases.

3. **Stress / Breakpoint Testing**
   - **How it works**: Pushes concurrency far beyond normal peak design limits until the system throws `502 Bad Gateway` or `504 Gateway Timeout`.
   - **Use Case**: Determines absolute disaster recovery boundaries and safe operational buffers.

4. **Soak / Endurance Testing**
   - **How it works**: Holds a steady, moderate load (`200 VUs`) continuously over several hours (`6 to 24 hours`).
   - **Use Case**: Exposes memory leaks (`OutOfMemoryError`), unclosed database cursors, log file disk exhaustion, and gradual GC (Garbage Collection) pauses.

---

## Part 2: How JMeter's Dummy Sampler Works & The Tenjin/k6 Equivalent

### 1. What is the JMeter Dummy Sampler?
In Apache JMeter, the **Dummy Sampler** (`kg.apc.jmeter.samplers.DummySampler` from `jmeter-plugins.org`) is a special sampler that **does not send real network traffic across the wire**. Instead, it generates a synthetic, hardcoded response directly inside JMeter's engine with configurable latency, response codes, and payload bodies.

#### Key Use Cases in JMeter:
- **Debugging Post-Processors & Assertions**: Testing complex Regex/JSON Path extractors on massive JSON responses without repeatedly hammering live staging servers.
- **Simulating Downstream Microservice Latency**: Mocking a third-party payment gateway (`Stripe / PayPal`) that takes `2,500 ms` to respond so you can verify how your orchestration layer handles slow dependencies.
- **Pipeline Benchmarking**: Measuring test harness and engine overhead independent of network I/O.

---

### 2. Tenjin / k6 Equivalent: Mocking & Synthetic Dummy Samplers
In Tenjin (`k6`), you achieve identical **Dummy Sampler** behavior using two primary patterns depending on your test requirements:

#### Approach A: Built-in k6 Synthetic Delay & Mocking (Zero Network I/O)
When debugging correlations, checks, and script logic without network latency, you can return synthetic response objects or use `httpbin / local mock server`:

```javascript
import { check, sleep } from 'k6';

// 1. Pure Synthetic Dummy Sampler Function (In-Memory Mock)
function dummySampler(name, responseBody, latencyMs, statusCode = 200) {
  // Simulate network flight delay
  sleep(latencyMs / 1000);
  
  // Return synthetic response matching k6 HTTP response interface
  return {
    status: statusCode,
    body: typeof responseBody === 'object' ? JSON.stringify(responseBody) : responseBody,
    json: function() { return typeof responseBody === 'object' ? responseBody : JSON.parse(responseBody); },
    timings: { duration: latencyMs },
    headers: { 'Content-Type': 'application/json' },
    request: { method: 'GET', url: `http://dummy.internal/${name}` }
  };
}

export default function() {
  // Execute Dummy Sampler: Mocking a 1.2s slow payment gateway response
  const mockResponse = dummySampler('StripePaymentMock', {
    transactionId: 'txn_987654321',
    status: 'AUTHORIZED',
    balance: 4500.00
  }, 1200, 200);

  // Validate checks on the dummy response exactly like a real HTTP request
  check(mockResponse, {
    'Dummy check status is 200': (r) => r.status === 200,
    'Dummy transaction authorized': (r) => r.json().status === 'AUTHORIZED',
  });
}
```

#### Approach B: Remote HTTP Echo & Delay Testing (`httpbin.org`)
If you want real socket connections with deterministic response delays and bodies without setting up your own servers:

```javascript
import http from 'k6/http';
import { check } from 'k6';

export default function() {
  // Calls httpbin to echo exactly what we send after a 2-second delay
  const payload = JSON.stringify({ mockOrder: 'ORDER-101', total: 99.95 });
  const res = http.post('https://httpbin.org/delay/2', payload, {
    headers: { 'Content-Type': 'application/json' }
  });

  check(res, {
    'HTTP status is 200': (r) => r.status === 200,
    'Echoed body verified': (r) => JSON.parse(r.body).data === payload,
  });
}
```

---

## Part 3: Master Functional Reference Script (`All-in-One k6 Implementation`)

Below is a production-ready, **Master Reference Script** combining all major Tenjin performance testing capabilities into a single executable workflow. You can copy this script directly into the **Script Editor** (`/projects/:pid/scripts/new`) or run it via terminal or worker pods.

```javascript
/**
 * ============================================================================
 * TENJIN PLATFORM - MASTER FUNCTIONAL REFERENCE SCRIPT (k6)
 * ============================================================================
 * Demonstrates:
 *   1. Load Profiles & Stages (Ramp up, Steady State, Ramp down)
 *   2. Regression Detection Thresholds (Duration, Error Rate, Custom Metrics)
 *   3. Data-Driven Testing (SharedArray CSV/JSON reading)
 *   4. Transaction Grouping & Think Time Pacing
 *   5. Auto-Correlation (Extracting & Chaining Dynamic Session Tokens)
 *   6. JMeter Dummy Sampler Equivalent (Synthetic Response Mocking)
 *   7. Custom Trend Metrics & Tagging for Output Profiles (InfluxDB / Prometheus)
 * ============================================================================
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend, Rate, Counter } from 'k6/metrics';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';

// ============================================================================
// 1. CUSTOM PERFORMANCE METRICS & THRESHOLDS (Regression Detection)
// ============================================================================
const checkoutDurationTrend = new Trend('custom_checkout_duration_ms', true);
const loginSuccessRate = new Rate('custom_login_success_rate');
const databaseQueryErrors = new Counter('custom_db_query_errors');

export const options = {
  // Load Pattern: Stage-based Ramp Up & Spike
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 VUs
    { duration: '1m', target: 10 },  // Hold steady at 10 VUs
    { duration: '15s', target: 50 }, // Spike up to 50 VUs
    { duration: '30s', target: 0 },  // Graceful ramp down to 0 VUs
  ],
  // Regression Detection Thresholds (Fail the pipeline if breached)
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1200'], // 95% of requests under 500ms
    'http_req_failed': ['rate<0.01'],                 // Error rate under 1%
    'custom_checkout_duration_ms': ['p(95)<800'],     // Custom checkout boundary
    'custom_login_success_rate': ['rate>0.98'],       // Login must succeed 98%+
  },
  // Tagging for Output Profiles (Prometheus / InfluxDB / Elastic)
  tags: {
    environment: 'staging',
    test_tier: 'master_functional_regression',
  },
};

// ============================================================================
// 2. DATA-DRIVEN SHARED ARRAY (Reads CSV Data Once into Memory)
// ============================================================================
const testUsers = new SharedArray('Test Users CSV', function () {
  // Synthetic inline CSV for reference (in production: open('./users.csv'))
  const rawCsv = `username,password,role
user_alpha@tenjin.io,SecretPass123!,admin
user_beta@tenjin.io,SecretPass456!,standard
user_gamma@tenjin.io,SecretPass789!,standard`;
  
  return papaparse.parse(rawCsv, { header: true }).data;
});

// Synthetic Dummy Sampler Utility (Identical to JMeter Dummy Sampler)
function executeDummySampler(name, mockPayload, simulatedDelayMs) {
  sleep(simulatedDelayMs / 1000);
  return {
    status: 200,
    body: JSON.stringify(mockPayload),
    json: () => mockPayload,
    timings: { duration: simulatedDelayMs },
  };
}

// ============================================================================
// 3. MAIN VU ITERATION LIFECYCLE
// ============================================================================
export default function () {
  // Assign unique test user row based on VU and iteration ID
  const userRow = testUsers[(__VU + __ITER) % testUsers.length];

  // --------------------------------------------------------------------------
  // TRANSACTION 1: USER AUTHENTICATION & CORRELATION
  // --------------------------------------------------------------------------
  group('1_Authentication_Flow', function () {
    const loginPayload = JSON.stringify({
      email: userRow.username,
      password: userRow.password,
    });

    const loginHeaders = {
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': 'tenjin-test-harness',
      },
    };

    // Send HTTP POST (using httpbin mock to simulate real API)
    const loginRes = http.post('https://httpbin.org/post', loginPayload, loginHeaders);

    // Assertions & Validation
    const isSuccess = check(loginRes, {
      'Login HTTP status is 200': (r) => r.status === 200,
      'Login payload echoed correctly': (r) => r.json('json.email') === userRow.username,
    });

    loginSuccessRate.add(isSuccess ? 1 : 0);

    // Auto-Correlation: Extract simulated authorization token for downstream requests
    // In real apps: const token = loginRes.json('token');
    const extractedToken = `Bearer simulated_token_vu_${__VU}_time_${Date.now()}`;

    // Store token in current VU context
    __ENV.CURRENT_TOKEN = extractedToken;

    // Think Time: Simulate realistic human hesitation
    sleep(Math.random() * 1.5 + 0.5);
  });

  // --------------------------------------------------------------------------
  // TRANSACTION 2: DOWNSTREAM API QUERIES WITH CORRELATED TOKEN
  // --------------------------------------------------------------------------
  group('2_Product_Catalog_Browse', function () {
    const authHeaders = {
      headers: {
        'Authorization': __ENV.CURRENT_TOKEN || 'Bearer default',
        'Accept': 'application/json',
      },
    };

    const res = http.get('https://httpbin.org/headers', authHeaders);

    check(res, {
      'Authorization header transmitted': (r) => r.json('headers.Authorization') === __ENV.CURRENT_TOKEN,
    });

    sleep(1.0);
  });

  // --------------------------------------------------------------------------
  // TRANSACTION 3: JMETER DUMMY SAMPLER (Mocking Third-Party Payment Gateway)
  // --------------------------------------------------------------------------
  group('3_Payment_Gateway_Mock_Dummy', function () {
    const startTime = new Date().getTime();

    // Execute Dummy Sampler simulating a 450ms credit card verification delay
    const dummyPaymentResponse = executeDummySampler('StripeVerificationDummy', {
      gatewayStatus: 'SUCCESS',
      authCode: `AUTH_${__VU}_${__ITER}`,
      feeCharged: 2.50,
    }, 450);

    // Verify synthetic dummy results
    check(dummyPaymentResponse, {
      'Dummy Payment Gateway Status 200': (r) => r.status === 200,
      'Dummy Auth Code Generated': (r) => r.json().gatewayStatus === 'SUCCESS',
    });

    const endTime = new Date().getTime();
    checkoutDurationTrend.add(endTime - startTime);
  });

  // --------------------------------------------------------------------------
  // TRANSACTION 4: TEARDOWN / LOGOUT TRANSACTION
  // --------------------------------------------------------------------------
  group('4_Logout_Session', function () {
    const logoutRes = http.delete('https://httpbin.org/delete', null, {
      headers: { 'Authorization': __ENV.CURRENT_TOKEN },
    });

    check(logoutRes, {
      'Logout completed (200)': (r) => r.status === 200,
    });
  });

  // Pacing between complete user journeys
  sleep(2.0);
}
```

---

## Part 4: How to Use These Scripts in Your Tenjin Application

1. **Creating a New Functional Test Plan**:
   - Navigate to **Projects** -> Select your Project -> Click **+ Create Test Plan** (or **Script Editor**).
   - Paste the code from `Part 3` above directly into the Monaco editor.
   - Click **Save Plan** and give it a name (e.g., `Master Functional Reference Plan`).

2. **Connecting to Output Profiles**:
   - Go to **Integrate** -> **Output Profiles**.
   - Configure an **InfluxDB**, **Prometheus / StatsD**, or **Elasticsearch** profile.
   - When running the Master Script, select that Output Profile from the execution configuration modal. Your custom metrics (`custom_checkout_duration_ms`, `custom_login_success_rate`) will automatically stream with tag `environment: staging` for real-time Grafana dashboarding.

3. **Analyzing Multi-Chart Run Details**:
   - After executing the run, open the **Run Details** screen (`/projects/:pid/runs/:rid`).
   - You will see the **8 Multi-Chart Analytics Dashboard cards** automatically visualizing your run:
     1. `Response Duration Percentiles (Avg, P95, P99)`
     2. `Network Timings Breakdown (Connecting, TLS, TTFB)`
     3. `Throughput & Execution Volume`
     4. `Network Bandwidth Transferred (KB)`
     5. `Virtual Users (VUs) Concurrency Profile`
     6. `Checks Pass vs Fail Ratio (%)`
     7. `HTTP Request Lifecycle Phases Breakdown`
     8. `Custom Protocols & Extensions Performance`
