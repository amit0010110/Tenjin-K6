import { describe, it, expect } from 'vitest';
import { postmanToBlocks } from '../import-postman';

const SAMPLE_COLLECTION = JSON.stringify({
  info: { name: 'Petstore API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/' },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: 'test-token-123' }] },
  item: [
    {
      name: 'Pets',
      item: [
        {
          name: 'List all pets',
          request: {
            method: 'GET',
            url: { raw: 'https://petstore.example.com/api/pets', host: ['petstore', 'example', 'com'], path: ['api', 'pets'] },
            header: [{ key: 'Accept', value: 'application/json' }],
          },
        },
        {
          name: 'Create pet',
          request: {
            method: 'POST',
            url: { raw: 'https://petstore.example.com/api/pets', host: ['petstore', 'example', 'com'], path: ['api', 'pets'] },
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: { mode: 'raw', raw: JSON.stringify({ name: 'Rex', species: 'dog' }) },
          },
        },
      ],
    },
    {
      name: 'Get pet by ID',
      request: {
        method: 'GET',
        url: { raw: 'https://petstore.example.com/api/pets/{{petId}}', host: ['petstore', 'example', 'com'], path: ['api', 'pets', '{{petId}}'] },
      },
    },
  ],
});

describe('postmanToBlocks', () => {
  it('returns empty array for invalid JSON', () => {
    expect(postmanToBlocks('not json')).toEqual([]);
  });

  it('returns empty array for empty collection', () => {
    expect(postmanToBlocks(JSON.stringify({ info: { name: 'Empty' } }))).toEqual([]);
  });

  it('parses a full collection with folder, auth, and variables', () => {
    const blocks = postmanToBlocks(SAMPLE_COLLECTION);
    expect(blocks.length).toBe(1);

    const root = blocks[0];
    expect(root.type).toBe('group');
    expect(root.label).toBe('Petstore API');
    expect(root.children.length).toBeGreaterThan(0);

    // Auth manager block should exist for request-level auth (collection auth inherited)
    const authBlock = root.children.find(c => c.type === 'auth-manager');
    expect(authBlock).toBeDefined();
    expect(authBlock!.properties.authType).toBe('bearer');

    // Should have a folder (group) for Pets
    const folder = root.children.find(c => c.type === 'group' && c.label === 'Pets');
    expect(folder).toBeDefined();
    expect(folder!.children.length).toBeGreaterThanOrEqual(2);
    expect(folder!.children.filter(c => c.type === 'http-request').length).toBe(2);

    // GET request inside folder (auth-manager + http-request + check = 2 children for this request)
    const getReq = folder!.children.find(c => c.type === 'http-request' && c.properties.method === 'GET');
    expect(getReq).toBeDefined();
    expect(getReq!.properties.url).toContain('petstore.example.com');

    // POST request inside folder
    const postReq = folder!.children.find(c => c.type === 'http-request' && c.properties.method === 'POST');
    expect(postReq).toBeDefined();
    expect(postReq!.properties.body).toContain('Rex');

    // Variable extraction for {{petId}}
    const varBlock = root.children.find(c => c.type === 'extract-variable' && c.properties.variableName === 'petId');
    expect(varBlock).toBeDefined();
  });

  it('handles URL types correctly (string vs object)', () => {
    const collection = {
      info: { name: 'Test' },
      item: [{ name: 'Simple', request: { method: 'GET', url: 'https://example.com/api' } }],
    };
    const blocks = postmanToBlocks(JSON.stringify(collection));
    expect(blocks.length).toBe(1);
    const httpReq = blocks[0].children.find(c => c.type === 'http-request');
    expect(httpReq).toBeDefined();
    expect(httpReq!.properties.url).toBe('https://example.com/api');
  });

  it('skips disabled headers', () => {
    const collection = {
      info: { name: 'Test' },
      item: [{
        name: 'Req',
        request: {
          method: 'GET',
          url: 'https://example.com/api',
          header: [
            { key: 'Active', value: 'yes' },
            { key: 'Inactive', value: 'no', disabled: true },
          ],
        },
      }],
    };
    const blocks = postmanToBlocks(JSON.stringify(collection));
    const httpReq = blocks[0].children.find(c => c.type === 'http-request');
    expect(httpReq).toBeDefined();
    const headers = httpReq!.properties.headers as Array<{ key: string; value: string }>;
    expect(headers.length).toBe(1);
    expect(headers[0].key).toBe('Active');
  });

  it('handles form-urlencoded body', () => {
    const collection = {
      info: { name: 'Test' },
      item: [{
        name: 'Form',
        request: {
          method: 'POST',
          url: 'https://example.com/login',
          body: {
            mode: 'urlencoded',
            urlencoded: [{ key: 'username', value: 'admin' }, { key: 'password', value: 'secret' }],
          },
        },
      }],
    };
    const blocks = postmanToBlocks(JSON.stringify(collection));
    const httpReq = blocks[0].children.find(c => c.type === 'http-request');
    expect(httpReq).toBeDefined();
    expect(httpReq!.properties.body).toContain('username=admin');
    expect(httpReq!.properties.body).toContain('password=secret');
  });
});
