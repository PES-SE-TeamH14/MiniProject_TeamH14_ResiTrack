// NFR-01 (#22): 95th percentile response time <= 3 s with 200 concurrent users (TC-NFR-01).
// Runs against a server seeded with 500 tenants (NFR-08, #23, TC-NFR-08).
// Normally started by `npm run load-test` in server/, which seeds the data and passes the -e values.
import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5055';
const PASSWORD = __ENV.PASSWORD || 'Perf@12345';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'perf-admin@resitrack.local';
const RESIDENT_EMAIL = __ENV.RESIDENT_EMAIL || 'perf-resident@resitrack.local';
const MONTH = __ENV.MONTH || new Date().toISOString().slice(0, 7);
const VUS = Number(__ENV.VUS || 200);
const HOLD = __ENV.HOLD || '2m';
const LIMIT_MS = 3000;

// What each kind of user does, with how often (weights add up to 100)
const ADMIN_ACTIONS = [
  { name: 'GET /api/tenants', weight: 25, run: (h) => http.get(`${BASE_URL}/api/tenants`, h) },
  { name: 'GET /api/payments/status', weight: 20, run: (h) => http.get(`${BASE_URL}/api/payments/status?month=${MONTH}`, h) },
  { name: 'GET /api/flats', weight: 15, run: (h) => http.get(`${BASE_URL}/api/flats`, h) },
  { name: 'GET /api/payments', weight: 15, run: (h) => http.get(`${BASE_URL}/api/payments?month=${MONTH}`, h) },
  { name: 'GET /api/complaints', weight: 10, run: (h) => http.get(`${BASE_URL}/api/complaints`, h) },
  { name: 'GET /api/visitors', weight: 10, run: (h) => http.get(`${BASE_URL}/api/visitors`, h) },
  { name: 'GET /api/health', weight: 5, run: (h) => http.get(`${BASE_URL}/api/health`, h) },
];
const RESIDENT_ACTIONS = [
  { name: 'GET /api/complaints', weight: 60, run: (h) => http.get(`${BASE_URL}/api/complaints`, h) },
  {
    name: 'POST /api/complaints',
    weight: 20,
    expect: 201,
    run: (h) =>
      http.post(
        `${BASE_URL}/api/complaints`,
        JSON.stringify({
          title: 'Load test complaint',
          description: 'Created by the k6 load test.',
          category: 'Plumbing',
          flatNumber: 'A-001',
        }),
        h,
      ),
  },
  {
    name: 'POST /api/visitors',
    weight: 20,
    expect: 201,
    run: (h) =>
      http.post(
        `${BASE_URL}/api/visitors`,
        JSON.stringify({ visitorName: 'Load Test', contact: '9876543210', purpose: 'Delivery', flatNumber: 'A-001' }),
        h,
      ),
  },
];
const ENDPOINTS = ['POST /api/auth/login', ...new Set([...ADMIN_ACTIONS, ...RESIDENT_ACTIONS].map((a) => a.name))];

// Every endpoint gets its own p95 limit, so one slow action cannot hide behind fast ones
const endpointThresholds = {};
for (const name of ENDPOINTS) {
  endpointThresholds[`http_req_duration{name:${name}}`] = [`p(95)<${LIMIT_MS}`];
  endpointThresholds[`http_reqs{name:${name}}`] = ['count>0'];
}

export const options = {
  scenarios: {
    // 200 signed-in users clicking around the app
    users: {
      executor: 'ramping-vus',
      exec: 'userFlow',
      startVUs: 0,
      stages: [
        { duration: '30s', target: VUS }, // ramp up
        { duration: HOLD, target: VUS }, // 200 concurrent users
        { duration: '15s', target: 0 }, // ramp down
      ],
      gracefulRampDown: '10s',
    },
    // Meanwhile, people keep signing in: 1 login per second while all 200 users are active.
    // (A login costs ~0.3 s of CPU on purpose: bcrypt cost 12, NFR-03.)
    logins: {
      executor: 'constant-arrival-rate',
      exec: 'loginFlow',
      rate: 1,
      timeUnit: '1s',
      startTime: '30s',
      duration: HOLD,
      preAllocatedVUs: 5,
      maxVUs: 20,
    },
  },
  thresholds: {
    http_req_duration: [`p(95)<${LIMIT_MS}`], // NFR-01
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    ...endpointThresholds,
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function pick(actions) {
  let roll = Math.random() * 100;
  for (const action of actions) {
    roll -= action.weight;
    if (roll < 0) return action;
  }
  return actions[actions.length - 1];
}

function login(email) {
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ email, password: PASSWORD }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'POST /api/auth/login' },
  });
  const ok = check(res, { 'POST /api/auth/login 200': (r) => r.status === 200 });
  return ok ? res.json('token') : null;
}

// Runs once before the test: one admin and one resident session that the virtual users start from
export function setup() {
  const adminToken = login(ADMIN_EMAIL);
  const residentToken = login(RESIDENT_EMAIL);
  if (!adminToken || !residentToken) {
    exec.test.abort(`Could not log in at ${BASE_URL}. Is the seeded server running?`);
  }
  return { adminToken, residentToken };
}

export function loginFlow() {
  login(exec.scenario.iterationInTest % 5 === 0 ? RESIDENT_EMAIL : ADMIN_EMAIL);
}

// Per virtual user: 1 in 5 is a resident, the rest are admins
const isResident = __VU % 5 === 0;
let token = null;

export function userFlow(data) {
  if (!token) token = isResident ? data.residentToken : data.adminToken;

  const action = pick(isResident ? RESIDENT_ACTIONS : ADMIN_ACTIONS);
  const params = {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    tags: { name: action.name },
  };
  const res = action.run(params);
  check(res, { [`${action.name} ${action.expect || 200}`]: (r) => r.status === (action.expect || 200) });

  // Sliding session (NFR-05): keep the refreshed token, as the React client does
  const fresh = res.headers['X-Auth-Token'];
  if (fresh) token = fresh;

  sleep(1 + Math.random()); // think time between clicks: 1-2 s
}

// ---------- results ----------

function ms(value) {
  return value === undefined ? '-' : `${Math.round(value)} ms`;
}

function passed(metric) {
  const thresholds = (metric && metric.thresholds) || {};
  return Object.values(thresholds).every((t) => t.ok);
}

export function handleSummary(data) {
  const json = JSON.stringify(data, null, 2);
  let report;
  try {
    report = buildReport(data);
  } catch (err) {
    // Unknown summary format (other k6 version): keep the raw data, k6's exit code still says pass/fail
    report = `# Load test results – NFR-01 (#22)\n\nCould not build the report (${err}). See summary.json.\n`;
  }
  return {
    'results/report.md': report,
    'results/summary.json': json,
    stdout: `\n${report}\n`,
  };
}

function buildReport(data) {
  const m = data.metrics;
  const d = m.http_req_duration.values;
  const allOk = Object.values(m).every(passed);
  const seed = __ENV.SEED_COUNTS ? JSON.parse(__ENV.SEED_COUNTS) : null;

  const rows = ENDPOINTS.map((name) => {
    const t = m[`http_req_duration{name:${name}}`];
    const c = m[`http_reqs{name:${name}}`];
    if (!t) return null;
    return `| ${name} | ${c ? c.values.count : '-'} | ${ms(t.values.med)} | ${ms(t.values['p(95)'])} | ${ms(t.values.max)} | ${passed(t) ? 'PASS' : 'FAIL'} |`;
  }).filter(Boolean);

  const lines = [
    '# Load test results – NFR-01 (#22) and NFR-08 (#23)',
    '',
    `**Result: ${allOk ? 'PASS' : 'FAIL'}** – 95th percentile ${ms(d['p(95)'])} (limit ${LIMIT_MS} ms) with ${VUS} concurrent users (peak ${m.vus.values.max} k6 virtual users, including logins).`,
    '',
    '## Setup',
    '',
    `- Run on: ${new Date().toISOString()}`,
    `- Tool: ${__ENV.K6_VERSION || 'k6'}`,
    `- Machine: ${__ENV.MACHINE || 'not recorded'}`,
    `- Server: ${__ENV.WORKERS || '?'} API worker process(es) (WEB_CONCURRENCY), MongoDB on the same machine`,
    `- Load: ramp to ${VUS} virtual users over 30 s, hold for ${HOLD}, ramp down 15 s; 1–2 s think time between actions`,
    '- Users: 4 in 5 are admins (tenants, rent status, flats, payments, complaints, visitors), 1 in 5 are residents (complaints, visitors)',
    '- Logins: 1 per second during the hold, on top of the 200 users (bcrypt cost 12)',
    seed
      ? `- Data: ${seed.flats} flats, ${seed.tenants} tenants, ${seed.payments} payments, ${seed.visitors} visitors, ${seed.complaints} complaints (throwaway MongoDB)`
      : '- Data: see the seed script',
    '',
    '## Overall',
    '',
    '| Metric | Value |',
    '|---|---|',
    `| Requests | ${m.http_reqs.values.count} (${m.http_reqs.values.rate.toFixed(1)} per second) |`,
    `| Failed requests | ${(m.http_req_failed.values.rate * 100).toFixed(2)} % (limit 1 %) |`,
    `| Checks passed | ${(m.checks.values.rate * 100).toFixed(2)} % |`,
    `| Median | ${ms(d.med)} |`,
    `| 90th percentile | ${ms(d['p(90)'])} |`,
    `| **95th percentile** | **${ms(d['p(95)'])}** (limit ${LIMIT_MS} ms) |`,
    `| 99th percentile | ${ms(d['p(99)'])} |`,
    `| Slowest | ${ms(d.max)} |`,
    '',
    '## Per endpoint',
    '',
    '| Endpoint | Requests | Median | 95th percentile | Slowest | p95 ≤ 3 s |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
    'Full k6 output: `summary.json` in this folder.',
    '',
  ];
  return lines.join('\n');
}
