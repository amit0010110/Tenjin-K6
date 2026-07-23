import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { validationRoutes } from '../validation.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1', validationRoutes);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe('Validation Routes', () => {
  it('validates a valid script', async () => {
    const res = await request(app)
      .post('/api/v1/scripts/validate')
      .send({
        content: `import http from 'k6/http';
import { check } from 'k6';
export const options = { vus: 1, duration: '30s' };
export default function() {
  const res = http.get('https://test.k6.io');
  check(res, { 'status is 200': (r) => r.status === 200 });
}`,
      });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(Array.isArray(res.body.issues)).toBe(true);
  });

  it('flags missing export default', async () => {
    const res = await request(app)
      .post('/api/v1/scripts/validate')
      .send({ content: '// just a comment' });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.issues.some((i: any) => i.message.includes('export default'))).toBe(true);
  });

  it('flags missing options', async () => {
    const res = await request(app)
      .post('/api/v1/scripts/validate')
      .send({ content: 'export default function() { http.get("https://test.com"); }' });
    expect(res.status).toBe(200);
    expect(res.body.issues.some((i: any) => i.message.includes('options'))).toBe(true);
  });

  it('warns on http.get without check', async () => {
    const res = await request(app)
      .post('/api/v1/scripts/validate')
      .send({ content: 'export default function() { http.get("https://test.com"); }' });
    expect(res.status).toBe(200);
    expect(res.body.issues.some((i: any) => i.message.includes('check()'))).toBe(true);
  });

  it('rejects empty body', async () => {
    const res = await request(app)
      .post('/api/v1/scripts/validate')
      .send({});
    expect(res.status).toBe(400);
  });
});
