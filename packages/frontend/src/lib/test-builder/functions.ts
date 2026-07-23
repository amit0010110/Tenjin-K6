export interface K6Function {
  name: string;
  syntax: string;
  description: string;
  category: 'Execution' | 'Data' | 'Encoding' | 'Crypto' | 'Timing' | 'HTTP' | 'Utility' | 'Random';
  example: string;
}

export const K6_FUNCTIONS: K6Function[] = [
  // Execution Context
  { name: '__VU', syntax: '__VU', description: 'Current virtual user number (1-indexed)', category: 'Execution', example: '__VU' },
  { name: '__ITER', syntax: '__ITER', description: 'Current iteration number (0-indexed) within the scenario', category: 'Execution', example: '__ITER' },
  { name: 'exec.vu.idInInstance', syntax: 'exec.vu.idInInstance', description: 'VU ID within the current instance', category: 'Execution', example: 'exec.vu.idInInstance' },
  { name: 'exec.scenario.name', syntax: 'exec.scenario.name', description: 'Name of the current scenario', category: 'Execution', example: 'exec.scenario.name' },
  { name: 'exec.scenario.iterationInInstance', syntax: 'exec.scenario.iterationInInstance', description: 'Iteration within the current instance', category: 'Execution', example: 'exec.scenario.iterationInInstance' },
  { name: 'exec.instance.vusActive', syntax: 'exec.instance.vusActive', description: 'Number of currently active VUs', category: 'Execution', example: 'exec.instance.vusActive' },

  // Environment
  { name: '__ENV', syntax: '__ENV.VAR_NAME', description: 'Access environment variables set on the config', category: 'Data', example: '__ENV.TARGET_URL' },
  { name: 'ENV', syntax: '__ENV["VAR_NAME"]', description: 'Alternative env var access syntax', category: 'Data', example: '__ENV["API_KEY"]' },

  // Random Data
  { name: 'RandomString', syntax: 'RandomString(length)', description: 'Generate a random alphanumeric string', category: 'Random', example: 'RandomString(10)' },
  { name: 'RandomInt', syntax: 'RandomInt(min, max)', description: 'Generate a random integer between min and max', category: 'Random', example: 'RandomInt(1, 100)' },
  { name: 'RandomFloat', syntax: 'RandomFloat(min, max)', description: 'Generate a random float between min and max', category: 'Random', example: 'RandomFloat(0, 1)' },
  { name: 'RandomItem', syntax: 'RandomItem(array)', description: 'Pick a random item from an array', category: 'Random', example: 'RandomItem(["a","b","c"])' },

  // UUID / Unique
  { name: 'UUID', syntax: 'uuidv4()', description: 'Generate a random UUID v4 (requires crypto module)', category: 'Utility', example: 'uuidv4()' },

  // Timing
  { name: 'Date.now', syntax: 'Date.now()', description: 'Current timestamp in milliseconds', category: 'Timing', example: 'Date.now()' },
  { name: 'new Date', syntax: 'new Date().toISOString()', description: 'Current date as ISO string', category: 'Timing', example: 'new Date().toISOString()' },

  // Encoding
  { name: 'b64encode', syntax: 'b64encode(input, "std")', description: 'Base64 encode a string', category: 'Encoding', example: 'b64encode("hello")' },
  { name: 'b64decode', syntax: 'b64decode(input)', description: 'Base64 decode a string', category: 'Encoding', example: 'b64decode("aGVsbG8=")' },

  // HTTP Helpers
  { name: 'http.get', syntax: 'http.get(url, params)', description: 'Issue an HTTP GET request', category: 'HTTP', example: 'http.get("https://api.example.com")' },
  { name: 'http.post', syntax: 'http.post(url, body, params)', description: 'Issue an HTTP POST request', category: 'HTTP', example: 'http.post(url, JSON.stringify(data), {headers: {"Content-Type": "application/json"}})' },
  { name: 'http.batch', syntax: 'http.batch(requests)', description: 'Issue multiple requests in parallel', category: 'HTTP', example: 'http.batch([{method: "GET", url: "https://..."}])' },
  { name: 'http.file', syntax: 'http.file(data, filename, contentType)', description: 'Create a file object for multipart uploads', category: 'HTTP', example: 'http.file(open("./file.pdf", "b"), "doc.pdf", "application/pdf")' },

  // JSON
  { name: 'JSON.parse', syntax: 'JSON.parse(string)', description: 'Parse a JSON string into an object', category: 'Utility', example: 'JSON.parse(res.body)' },
  { name: 'JSON.stringify', syntax: 'JSON.stringify(obj)', description: 'Convert object to JSON string', category: 'Utility', example: 'JSON.stringify({key: "value"})' },

  // Data Files
  { name: 'SharedArray', syntax: 'SharedArray(name, sourceFn)', description: 'Read-only array shared across VUs (data-driven testing)', category: 'Data', example: 'new SharedArray("users", function() { return JSON.parse(open("./users.json")); })' },
  { name: 'open', syntax: 'open(filePath)', description: 'Open a file and read its contents (init context only)', category: 'Data', example: 'open("./test-data.csv")' },
  { name: 'papaparse', syntax: 'papaparse.parse(csvString, {header: true}).data', description: 'Parse CSV string into array of objects', category: 'Data', example: 'papaparse.parse(open("./data.csv"), {header: true}).data' },
];

export const CORRELATION_PATTERNS = [
  {
    name: 'CSRF Token (Django)',
    description: 'Extract CSRF token from Django forms',
    extractType: 'regex' as const,
    expression: 'csrfmiddlewaretoken" value="([^"]+)"',
    variableName: 'csrfToken',
    appliesTo: ['django', 'python'],
  },
  {
    name: 'CSRF Token (Rails)',
    description: 'Extract CSRF token from Rails meta tag',
    extractType: 'regex' as const,
    expression: 'csrf-token" content="([^"]+)"',
    variableName: 'csrfToken',
    appliesTo: ['rails', 'ruby'],
  },
  {
    name: 'Session Cookie (JSESSIONID)',
    description: 'Extract Java session ID from cookie',
    extractType: 'cookie' as const,
    expression: 'JSESSIONID',
    variableName: 'sessionId',
    appliesTo: ['java', 'spring', 'jsp'],
  },
  {
    name: 'Auth Token (Bearer JWT)',
    description: 'Extract JWT token from login response body',
    extractType: 'jsonpath' as const,
    expression: '$.token',
    variableName: 'authToken',
    appliesTo: ['rest', 'jwt', 'oauth'],
  },
  {
    name: 'Auth Token (Access Token)',
    description: 'Extract access_token from OAuth response',
    extractType: 'jsonpath' as const,
    expression: '$.access_token',
    variableName: 'accessToken',
    appliesTo: ['oauth', 'auth0', 'keycloak'],
  },
  {
    name: 'User ID from Profile',
    description: 'Extract user ID from profile endpoint response',
    extractType: 'jsonpath' as const,
    expression: '$.id',
    variableName: 'userId',
    appliesTo: ['rest', 'api'],
  },
  {
    name: 'PHP Session ID (PHPSESSID)',
    description: 'Extract PHP session ID from cookie',
    extractType: 'cookie' as const,
    expression: 'PHPSESSID',
    variableName: 'phpSessionId',
    appliesTo: ['php', 'laravel', 'wordpress'],
  },
  {
    name: 'View State (ASP.NET)',
    description: 'Extract __VIEWSTATE from ASP.NET form',
    extractType: 'regex' as const,
    expression: '__VIEWSTATE" value="([^"]+)"',
    variableName: 'viewState',
    appliesTo: ['asp.net', 'dotnet'],
  },
  {
    name: 'Pagination Next Page',
    description: 'Extract next page URL from Link header',
    extractType: 'regex' as const,
    expression: '<([^>]+)>; rel="next"',
    variableName: 'nextPage',
    appliesTo: ['rest', 'api', 'pagination'],
  },
  {
    name: 'Location Header (REST)',
    description: 'Extract resource ID from Location header after POST',
    extractType: 'header' as const,
    expression: 'Location',
    variableName: 'resourceUrl',
    appliesTo: ['rest', 'api', 'crud'],
  },
  {
    name: 'GraphQL CSRF Token',
    description: 'Extract CSRF token from GraphQL playground',
    extractType: 'regex' as const,
    expression: '"csrfToken":"([^"]+)"',
    variableName: 'gqlCsrfToken',
    appliesTo: ['graphql', 'apollo'],
  },
];
