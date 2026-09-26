/**
 * MeshPulse — Cloud-Native Multi-Container Distributed Microservice
 * MCA Trimester 5 - DevOps Lab 4
 * Author: Achindra Sharma (2547105)
 * Class: 4MCA A
 */

import http from 'node:http';
import net from 'node:net';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const REDIS_HOST = process.env.REDIS_HOST || 'cache';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');

const serverStartTime = Date.now();

// MIME Types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// =========================================================================
// Native Zero-Dependency Redis RESP (REdis Serialization Protocol) Client
// =========================================================================
function sendRedisCommand(commandArgs) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ host: REDIS_HOST, port: REDIS_PORT, timeout: 3000 }, () => {
      // Build RESP Array
      let payload = `*${commandArgs.length}\r\n`;
      for (const arg of commandArgs) {
        const str = String(arg);
        payload += `$${Buffer.byteLength(str)}\r\n${str}\r\n`;
      }
      client.write(payload);
    });

    let buffer = '';
    client.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      // Simple parse of RESP responses
      if (buffer.startsWith('+')) {
        // Simple string e.g. +PONG\r\n or +OK\r\n
        const val = buffer.substring(1).trim();
        client.end();
        resolve(val);
      } else if (buffer.startsWith(':')) {
        // Integer e.g. :1\r\n
        const val = parseInt(buffer.substring(1).trim(), 10);
        client.end();
        resolve(val);
      } else if (buffer.startsWith('$')) {
        // Bulk string
        const lines = buffer.split('\r\n');
        const len = parseInt(lines[0].substring(1), 10);
        if (len === -1) {
          client.end();
          resolve(null);
        } else if (lines.length > 2) {
          client.end();
          resolve(lines[1]);
        }
      } else if (buffer.startsWith('-')) {
        // Error e.g. -ERR message\r\n
        client.end();
        reject(new Error(buffer.substring(1).trim()));
      } else {
        client.end();
        resolve(buffer.trim());
      }
    });

    client.on('timeout', () => {
      client.destroy();
      reject(new Error(`Connection to Redis at ${REDIS_HOST}:${REDIS_PORT} timed out`));
    });

    client.on('error', (err) => {
      reject(err);
    });
  });
}

// =========================================================================
// HTTP Request Router
// =========================================================================
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. Liveness Probe (/healthz)
  if (req.method === 'GET' && (pathname === '/healthz' || pathname === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'HEALTHY',
      service: 'MeshPulse-API',
      uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
      timestamp: new Date().toISOString()
    }));
  }

  // 2. Readiness Probe (/livez) - Tests Redis connectivity
  if (req.method === 'GET' && pathname === '/livez') {
    try {
      const pong = await sendRedisCommand(['PING']);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'READY',
        service: 'MeshPulse-API',
        cacheConnection: pong === 'PONG' ? 'CONNECTED' : pong,
        networks: ['frontend-net', 'backend-net']
      }));
    } catch (err) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'DEGRADED',
        error: err.message,
        cacheConnection: 'DISCONNECTED'
      }));
    }
  }

  // 3. Architecture & Mesh Topology Telemetry API
  if (req.method === 'GET' && pathname === '/api/mesh-info') {
    let cacheStatus = 'UNKNOWN';
    let dbKeysCount = 0;
    try {
      const pong = await sendRedisCommand(['PING']);
      if (pong === 'PONG') {
        cacheStatus = 'ONLINE';
        dbKeysCount = await sendRedisCommand(['DBSIZE']) || 0;
      }
    } catch (e) {
      cacheStatus = 'OFFLINE';
    }

    // Inspect Tmpfs mount status
    let tmpfsWritable = false;
    try {
      const testPath = '/tmp/mesh-probe.tmp';
      fs.writeFileSync(testPath, 'tmpfs-ok', 'utf8');
      tmpfsWritable = fs.readFileSync(testPath, 'utf8') === 'tmpfs-ok';
      fs.unlinkSync(testPath);
    } catch (e) {
      tmpfsWritable = false;
    }

    const networkInterfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(networkInterfaces)) {
      for (const net of networkInterfaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          ips.push({ interface: name, ip: net.address });
        }
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      student: {
        name: 'Achindra Sharma',
        regNo: '2547105',
        class: '4MCA A',
        lab: 'Lab 4 — Multi-Container Composition, Networking & Storage'
      },
      container: {
        service: 'api',
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        pid: process.pid,
        uid: typeof process.getuid === 'function' ? process.getuid() : 1000,
        runningAsRoot: typeof process.getuid === 'function' ? process.getuid() === 0 : false,
        networkInterfaces: ips
      },
      meshTopology: {
        services: [
          { name: 'gateway', role: 'Reverse Proxy & Ingress', image: 'nginx:alpine', network: 'frontend-net', port: 80 },
          { name: 'api', role: 'Core Microservice Router', image: 'mesh-api:1.0.0', networks: ['frontend-net', 'backend-net'], port: 3000 },
          { name: 'cache', role: 'Persistent State Store', image: 'redis:alpine', network: 'backend-net', port: 6379, volume: 'redis_data' },
          { name: 'watchdog', role: 'Network & Health Sentinel', image: 'mesh-watchdog:1.0.0', network: 'backend-net' }
        ],
        networks: [
          { name: 'frontend-net', scope: 'Public Ingress (gateway <-> api)', subnet: '172.28.1.0/24' },
          { name: 'backend-net', scope: 'Isolated Data Tier (api <-> cache <-> watchdog)', subnet: '172.28.2.0/24' }
        ],
        storageTiers: [
          { type: 'Named Volume', name: 'redis_data', mount: '/data', target: 'cache', persistent: true, purpose: 'Append-Only Database Persistence' },
          { type: 'Bind Mount', source: './nginx/nginx.conf', mount: '/etc/nginx/nginx.conf', target: 'gateway', persistent: true, readonly: true, purpose: 'Immutable Edge Routing Configuration' },
          { type: 'Tmpfs Mount', mount: '/tmp', target: 'api', persistent: false, inMemory: true, purpose: 'Zero-Disk-IO Ephemeral Security Storage' }
        ]
      },
      runtimeState: {
        cacheStatus,
        dbKeysCount,
        tmpfsWritable,
        uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000)
      }
    }));
  }

  // 4. DNS Service Discovery & Cross-Container Ping API
  if (req.method === 'GET' && pathname === '/api/network/dns-test') {
    const targets = [
      { name: 'cache', port: 6379, expectedNetwork: 'backend-net' },
      { name: 'gateway', port: 80, expectedNetwork: 'frontend-net' },
      { name: 'watchdog', expectedNetwork: 'backend-net' }
    ];

    const results = [];
    for (const target of targets) {
      const startTime = Date.now();
      try {
        const addresses = await dns.lookup(target.name, { all: true });
        const latencyMs = Date.now() - startTime;
        results.push({
          target: target.name,
          resolved: true,
          addresses: addresses.map(a => a.address),
          latencyMs,
          network: target.expectedNetwork,
          status: 'REACHABLE'
        });
      } catch (err) {
        results.push({
          target: target.name,
          resolved: false,
          error: err.code || err.message,
          network: target.expectedNetwork,
          status: 'UNREACHABLE'
        });
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      timestamp: new Date().toISOString(),
      discoveryEngine: 'Docker Internal Embedded DNS (127.0.0.11)',
      results
    }));
  }

  // 5. Storage Write API (Validates Named Volume Storage in Redis)
  if (req.method === 'POST' && pathname === '/api/storage/write') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const key = payload.key || `mesh-record-${Date.now()}`;
        const value = JSON.stringify({
          message: payload.message || 'MeshPulse persistent state checkpoint',
          author: 'Achindra Sharma (2547105)',
          timestamp: new Date().toISOString(),
          source: 'api-container-uid1000'
        });

        await sendRedisCommand(['SET', key, value]);
        const keysCount = await sendRedisCommand(['DBSIZE']) || 1;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: 'Record successfully committed to Redis named volume (redis_data)',
          key,
          totalKeysStored: keysCount,
          persistenceMechanism: 'AOF (Append Only File) on /data'
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 6. Storage Read API (Validates Persistence Retrieval)
  if (req.method === 'GET' && pathname === '/api/storage/read') {
    try {
      const keysRaw = await sendRedisCommand(['KEYS', 'mesh-record*']);
      let keys = [];
      if (typeof keysRaw === 'string') {
        keys = keysRaw.split('\r\n').filter(k => k && !k.startsWith('*') && !k.startsWith('$'));
      }

      const records = [];
      for (const k of keys.slice(0, 10)) {
        const val = await sendRedisCommand(['GET', k]);
        try {
          records.push({ key: k, data: JSON.parse(val) });
        } catch {
          records.push({ key: k, data: val });
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        totalRecords: keys.length,
        volume: 'redis_data:/data',
        records
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 7. Tmpfs Ephemeral Storage Test API
  if (req.method === 'GET' && pathname === '/api/storage/tmpfs-test') {
    const testFile = `/tmp/session-${Date.now()}.token`;
    const tokenPayload = `ephemeral-token-${Math.random().toString(36).substring(2)}`;
    try {
      fs.writeFileSync(testFile, tokenPayload, 'utf8');
      const readBack = fs.readFileSync(testFile, 'utf8');
      fs.unlinkSync(testFile);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'SUCCESS',
        mountPoint: '/tmp',
        storageTier: 'tmpfs (RAM-backed in-memory filesystem)',
        persistent: false,
        verification: readBack === tokenPayload ? 'VERIFIED' : 'FAILED',
        benefit: 'Zero disk write overhead, cryptographic token hygiene on reboot'
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ERROR', error: err.message }));
    }
  }

  // 8. Static File Server for MeshPulse Web Dashboard
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

// Graceful Container Shutdown Handler (PID 1 Signal Trapping)
function handleShutdown(signal) {
  console.log(`\n🛑 [MeshPulse API] Received ${signal}. Draining active microservice connections...`);
  server.close(() => {
    console.log('✅ [MeshPulse API] HTTP server closed gracefully. Exiting process.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('⚠️ [MeshPulse API] Forceful exit timeout elapsed.');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [MeshPulse API] Microservice listening on http://0.0.0.0:${PORT}`);
    console.log(`   - Hostname: ${os.hostname()}`);
    console.log(`   - Connected Redis: ${REDIS_HOST}:${REDIS_PORT}`);
    console.log(`   - Networks: frontend-net & backend-net`);
    console.log(`   - Health probe: http://localhost:${PORT}/healthz`);
  });
}

export default server;
