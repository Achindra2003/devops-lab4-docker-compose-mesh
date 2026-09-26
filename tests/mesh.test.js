import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import server from '../server.js';

test('MeshPulse Microservice & Compose Architecture Tests', async (t) => {
  const TEST_PORT = 3988;

  await new Promise((resolve) => {
    server.listen(TEST_PORT, '127.0.0.1', () => resolve());
  });

  function makeRequest(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {}
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  await t.test('GET /healthz returns 200 and HEALTHY status', async () => {
    const res = await makeRequest('/healthz');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'HEALTHY');
    assert.strictEqual(res.body.service, 'MeshPulse-API');
    assert.ok(typeof res.body.uptimeSeconds === 'number');
  });

  await t.test('GET /api/mesh-info returns student attribution & multi-tier topology', async () => {
    const res = await makeRequest('/api/mesh-info');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.student.name, 'Achindra Sharma');
    assert.strictEqual(res.body.student.regNo, '2547105');
    assert.strictEqual(res.body.student.class, '4MCA A');
    assert.strictEqual(res.body.meshTopology.services.length, 4);
    assert.strictEqual(res.body.meshTopology.networks.length, 2);
    assert.strictEqual(res.body.meshTopology.storageTiers.length, 3);
  });

  await t.test('GET /api/storage/tmpfs-test validates in-memory ephemeral storage', async () => {
    const res = await makeRequest('/api/storage/tmpfs-test');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'SUCCESS');
    assert.strictEqual(res.body.verification, 'VERIFIED');
  });

  await t.test('GET /api/network/dns-test handles target resolution', async () => {
    const res = await makeRequest('/api/network/dns-test');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.body.results));
    assert.strictEqual(res.body.results.length, 3);
  });

  server.close();
});
