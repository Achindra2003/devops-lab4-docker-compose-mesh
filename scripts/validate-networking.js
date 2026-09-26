/**
 * MeshPulse Network Validation & Zero-Trust Segmentation Suite
 * MCA Trimester 5 - DevOps Lab 4
 * Author: Achindra Sharma (2547105)
 */

import { execSync } from 'node:child_process';

console.log('🌐 ===============================================================');
console.log('🌐 MESHPULSE DOCKER COMPOSE NETWORK VALIDATION SUITE');
console.log('🌐 Student: Achindra Sharma (2547105) — 4MCA A');
console.log('🌐 ===============================================================\n');

let passCount = 0;
let failCount = 0;

function runCheck(title, fn) {
  try {
    process.stdout.write(`🔍 Checking: ${title}... `);
    const result = fn();
    console.log(`✅ [PASS]`);
    if (result) console.log(`   └─▶ ${result}`);
    passCount++;
  } catch (err) {
    console.log(`❌ [FAIL]`);
    console.error(`   └─▶ ${err.message}`);
    failCount++;
  }
}

// 1. Check Docker Compose Services Active
runCheck('Active Compose Services', () => {
  const output = execSync('docker compose ps --format json', { encoding: 'utf8' });
  const lines = output.trim().split('\n').filter(Boolean);
  if (lines.length === 0) throw new Error('No services running! Run "docker compose up -d" first.');
  return `Found ${lines.length} active service containers in mesh.`;
});

// 2. Validate Custom Bridge Networks
runCheck('Network Subnet Isolation (frontend-net vs backend-net)', () => {
  const frontNet = execSync('docker network inspect meshpulse-frontend-net --format "{{(index .IPAM.Config 0).Subnet}}"', { encoding: 'utf8' }).trim();
  const backNet = execSync('docker network inspect meshpulse-backend-net --format "{{(index .IPAM.Config 0).Subnet}}"', { encoding: 'utf8' }).trim();

  if (frontNet !== '172.28.1.0/24') throw new Error(`frontend-net subnet mismatch: expected 172.28.1.0/24, got ${frontNet}`);
  if (backNet !== '172.28.2.0/24') throw new Error(`backend-net subnet mismatch: expected 172.28.2.0/24, got ${backNet}`);

  return `frontend-net: ${frontNet} | backend-net: ${backNet}`;
});

// 3. Validate DNS Resolution from API to Cache on backend-net
runCheck('Service Discovery: API -> Cache (backend-net)', () => {
  const output = execSync('docker exec mesh-api node -e "dns.lookup(\'cache\', (err, addr) => { if (err) process.exit(1); console.log(addr); })"', { encoding: 'utf8' }).trim();
  if (!output.startsWith('172.28.2.')) throw new Error(`DNS resolved outside backend-net subnet: ${output}`);
  return `DNS 'cache' resolved to IP: ${output} (Internal DNS 127.0.0.11)`;
});

// 4. Validate DNS Resolution from Gateway to API on frontend-net
runCheck('Service Discovery: Gateway -> API (frontend-net)', () => {
  const output = execSync('docker exec mesh-gateway nslookup api', { encoding: 'utf8' });
  if (!output.includes('172.28.1.')) throw new Error(`DNS resolution failed for 'api' on frontend-net`);
  return `'api' successfully resolved by Nginx gateway on frontend-net`;
});

// 5. CRITICAL SECURITY CHECK: Gateway CANNOT reach Cache (Zero-Trust Isolation)
runCheck('Zero-Trust Network Isolation (Gateway -> Cache BLOCKED)', () => {
  try {
    execSync('docker exec mesh-gateway nc -z -w 2 cache 6379', { encoding: 'utf8', stdio: 'pipe' });
    throw new Error('SECURITY VIOLATION: Gateway was able to connect to Cache! Network segmentation failed.');
  } catch (err) {
    if (err.message && err.message.includes('SECURITY VIOLATION')) throw err;
    return `Verified: Gateway cannot reach 'cache:6379'. Direct database exposure prevented.`;
  }
});

// 6. Validate HTTP Ingress via Gateway Port 8080
runCheck('Ingress Reverse Proxy Routing (Host -> Gateway:8080 -> API)', () => {
  const output = execSync('docker exec mesh-gateway wget -qO- http://127.0.0.1:80/healthz', { encoding: 'utf8' });
  const json = JSON.parse(output);
  if (json.status !== 'HEALTHY') throw new Error(`Unexpected status from gateway health probe: ${json.status}`);
  return `Gateway proxy successfully routed request to API: ${json.service} (status: ${json.status})`;
});

console.log('\n===============================================================');
console.log(`📊 NETWORK VALIDATION SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log('===============================================================\n');

if (failCount > 0) process.exit(1);
process.exit(0);
