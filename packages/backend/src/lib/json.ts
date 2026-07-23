export function safeJsonParse<T = unknown>(val: unknown): T | null {
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return null; }
  }
  return (val ?? null) as T | null;
}

export function safeJsonStringify(val: unknown): string {
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}
