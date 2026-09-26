/**
 * MeshPulse Multi-Tier Storage Validation & Persistence Recovery Suite
 * MCA Trimester 5 - DevOps Lab 4
 * Author: Achindra Sharma (2547105)
 */

import { execSync } from 'node:child_process';

console.log('💾 ===============================================================');
console.log('💾 MESHPULSE DOCKER COMPOSE STORAGE VALIDATION SUITE');
console.log('💾 Student: Achindra Sharma (2547105) — 4MCA A');
console.log('💾 ===============================================================\n');

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

// 1. Inspect Named Volume Existence
runCheck('Named Persistent Volume Registration (meshpulse_redis_data)', () => {
  const output = execSync('docker volume inspect meshpulse_redis_data --format "{{.Name}} | Driver: {{.Driver}}"', { encoding: 'utf8' }).trim();
  return `Verified volume: ${output}`;
});

// 2. Validate Read-Only Bind Mount Immutability on Gateway
runCheck('Read-Only Bind Mount Security (:ro on /etc/nginx/nginx.conf)', () => {
  const mounts = execSync('docker inspect mesh-gateway --format "{{json .Mounts}}"', { encoding: 'utf8' });
  if (!mounts.includes('nginx.conf')) throw new Error('nginx.conf bind mount not found on mesh-gateway');
  if (!mounts.includes('"RW":false')) throw new Error('Bind mount is not read-only (:ro)!');

  // Verify write prevention
  try {
    execSync('docker exec mesh-gateway touch /etc/nginx/nginx.conf', { encoding: 'utf8', stdio: 'pipe' });
    throw new Error('SECURITY VIOLATION: Managed to write to read-only bind mount!');
  } catch (err) {
    if (err.message && err.message.includes('SECURITY VIOLATION')) throw err;
    return `Verified: Bind mount /etc/nginx/nginx.conf is strictly read-only. Modification blocked.`;
  }
});

// 3. Validate In-Memory Tmpfs Mount on API
runCheck('In-Memory Tmpfs Mount (/tmp on mesh-api)', () => {
  const output = execSync('docker exec mesh-api df -T /tmp', { encoding: 'utf8' });
  if (!output.toLowerCase().includes('tmpfs')) throw new Error(`Mount /tmp is not tmpfs:\n${output}`);
  return `Verified: /tmp mounted as high-speed RAM-backed tmpfs. Zero disk I/O leaks.`;
});

// 4. End-to-End Volume Persistence & Crash Recovery Test
runCheck('Data Durability & Crash Recovery (Survives Container Destruction)', () => {
  const testKey = 'eval_checkpoint_2547105';
  const testVal = 'Achindra Sharma - Survives Container Down - 100% Data Integrity';

  // Step A: Write data
  execSync(`docker exec mesh-cache redis-cli SET "${testKey}" "${testVal}"`, { encoding: 'utf8' });
  execSync('docker exec mesh-cache redis-cli SAVE', { encoding: 'utf8' });

  // Step B: Destroy container
  execSync('docker compose stop cache', { encoding: 'utf8' });
  execSync('docker compose rm -f cache', { encoding: 'utf8' });

  // Step C: Spin up fresh container attached to the same named volume
  execSync('docker compose up -d cache', { encoding: 'utf8' });

  // Wait 3 seconds for Redis to initialize AOF replay
  let recovered = '';
  for (let i = 0; i < 5; i++) {
    try {
      recovered = execSync(`docker exec mesh-cache redis-cli GET "${testKey}"`, { encoding: 'utf8' }).trim();
      if (recovered === testVal) break;
    } catch {
      execSync('timeout /t 1 >nul 2>&1 || sleep 1');
    }
  }

  if (recovered !== testVal) {
    throw new Error(`Data recovery failed! Expected "${testVal}", got "${recovered}"`);
  }

  return `Container destroyed and recreated. Key "${testKey}" recovered intact with 100% fidelity.`;
});

console.log('\n===============================================================');
console.log(`📊 STORAGE VALIDATION SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log('===============================================================\n');

if (failCount > 0) process.exit(1);
process.exit(0);
