/**
 * NFR-01 (#22) / NFR-08 (#23): one-command load test.
 *
 * 1. Starts a throwaway MongoDB (mongodb-memory-server), so no real data is touched
 * 2. Seeds 500 flats and tenants, rent payments, visitors and complaints
 * 3. Starts the real API (src/server.js) on PERF_PORT (default 5055) with PERF_WORKERS
 *    worker processes (default 4, like a small 4-vCPU server; see WEB_CONCURRENCY in server.js)
 * 4. Runs 7-Testing-Tools/load-test/k6-load-test.js (200 virtual users) and saves the results there
 *
 * Usage (from server/):
 *   npm run load-test             run everything (needs k6)
 *   npm run load-test -- --serve  only start the seeded API, to run k6 by hand
 *   PERF_WORKERS=1 npm run load-test   compare with a single process
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { seedPerfData } = require('./seedPerfData');

const PORT = Number(process.env.PERF_PORT) || 5055;
const WORKERS = Number(process.env.PERF_WORKERS) || Math.min(4, os.availableParallelism());
const SERVE_ONLY = process.argv.includes('--serve');
const SERVER_JS = path.resolve(__dirname, '../../src/server.js');
const LOAD_TEST_DIR = path.resolve(__dirname, '../../../7-Testing-Tools/load-test');

// k6 on PATH, or K6_PATH, or the default Windows install folder (a fresh install is not on PATH
// until Windows / VS Code is restarted)
const K6_CANDIDATES = [
  process.env.K6_PATH,
  'k6',
  process.platform === 'win32' && path.join(process.env.ProgramFiles || 'C:\\Program Files', 'k6', 'k6.exe'),
].filter(Boolean);

function findK6() {
  for (const bin of K6_CANDIDATES) {
    const result = spawnSync(bin, ['version'], { encoding: 'utf8' });
    if (!result.error && result.status === 0) return { bin, version: (result.stdout || '').trim() };
  }
  return null;
}

function machineSummary() {
  const cpu = os.cpus()[0]?.model?.trim() || 'unknown CPU';
  const ramGb = Math.round(os.totalmem() / 1024 ** 3);
  return `${os.type()} ${os.release()}, ${cpu}, ${os.cpus().length} logical cores, ${ramGb} GB RAM, Node ${process.version}`;
}

async function waitForApi(url, api, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (api.exitCode !== null) throw new Error('the API process stopped while starting');
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`the API did not answer on ${url} within ${timeoutMs / 1000} s`);
}

async function main() {
  const k6 = SERVE_ONLY ? null : findK6();
  if (!SERVE_ONLY && !k6) {
    console.error('k6 is not installed (or not on PATH).');
    console.error('  Windows: winget install k6 --source winget   (then open a NEW terminal)');
    console.error('  macOS:   brew install k6');
    console.error('  Other:   https://grafana.com/docs/k6/latest/set-up/install-k6/');
    process.exit(1);
  }

  console.log('Starting a throwaway MongoDB...');
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  console.log('Seeding 500 tenants...');
  const started = Date.now();
  const seed = await seedPerfData();
  console.log(`Seeded in ${Date.now() - started} ms:`, seed.counts);

  // The real server, as `npm start` runs it. Values set here win over server/.env (dotenv never overrides).
  const api = spawn(process.execPath, [SERVER_JS], {
    stdio: 'inherit',
    env: {
      ...process.env,
      MONGODB_URI: mongo.getUri(),
      PORT: String(PORT),
      JWT_SECRET: crypto.randomBytes(32).toString('hex'),
      WEB_CONCURRENCY: String(WORKERS),
      REQUEST_LOGS: 'off', // logging every request would slow the server down under load
    },
  });
  const baseUrl = `http://localhost:${PORT}`;

  async function shutdown(code) {
    api.kill();
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(code);
  }

  try {
    await waitForApi(`${baseUrl}/api/health`, api);
  } catch (err) {
    console.error(`Could not start the API: ${err.message}`);
    return shutdown(1);
  }
  console.log(`ResiTrack API (perf data, ${WORKERS} worker processes) ready on ${baseUrl}`);

  const env = {
    BASE_URL: baseUrl,
    ADMIN_EMAIL: seed.admin.email,
    RESIDENT_EMAIL: seed.resident.email,
    PASSWORD: seed.password,
    MONTH: seed.currentMonth,
    SEED_COUNTS: JSON.stringify(seed.counts),
    MACHINE: machineSummary(),
    WORKERS: String(WORKERS),
  };

  if (SERVE_ONLY) {
    console.log('\nRun k6 in another terminal, for example:');
    console.log('  cd 7-Testing-Tools/load-test');
    console.log(`  k6 run -e BASE_URL=${baseUrl} -e MONTH=${seed.currentMonth} k6-load-test.js`);
    console.log(`Logins: ${seed.admin.email} / ${seed.resident.email}, password ${seed.password} (perf data only)`);
    console.log('Press Ctrl+C to stop.');
    process.on('SIGINT', () => shutdown(0));
    return undefined;
  }

  fs.mkdirSync(path.join(LOAD_TEST_DIR, 'results'), { recursive: true });
  const args = ['run', ...Object.entries({ ...env, K6_VERSION: k6.version }).flatMap(([k, v]) => ['-e', `${k}=${v}`])];
  args.push('k6-load-test.js');

  console.log(`\nRunning ${k6.version} with 200 virtual users, about 3 minutes...\n`);
  const run = spawn(k6.bin, args, { cwd: LOAD_TEST_DIR, stdio: 'inherit' });
  run.on('exit', (code) => {
    console.log(`\nResults saved in 7-Testing-Tools/load-test/results/ (k6 exit code ${code})`);
    shutdown(code ?? 1);
  });
  return undefined;
}

main().catch((err) => {
  console.error(`Load test failed: ${err.message}`);
  process.exit(1);
});
