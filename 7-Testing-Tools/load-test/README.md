# Load and scale testing (NFR-01 #22, NFR-08 #23)

| Requirement | Test case | Target | How it is tested |
|---|---|---|---|
| NFR-01: respond within 3 s under normal load | TC-NFR-01 | 95th percentile ≤ 3 s at 200 concurrent users | k6 load test, `k6-load-test.js` |
| NFR-08: scale to 500 tenant records | TC-NFR-08 | ≤ 3 s responses with 500 tenants; reference fields indexed | the k6 run above uses 500 tenants, plus `server/tests/scale.test.js` (runs in CI with `npm test`) |

**Latest results: [results/report.md](results/report.md)** (full k6 output in `results/summary.json`).

## Finding: one Node process is not enough

The first run used a single API process and **failed**: 95th percentile 6.1 s
([results/baseline-1-process.md](results/baseline-1-process.md)). Even `GET /api/health`, which does no database
work, had a 1.1 s p95, so the bottleneck was the single Node.js process (one CPU core, about 60 requests/s),
not MongoDB. bcrypt logins (cost 12, NFR-03) used a large share of that one core.

Fix: `src/server.js` can now run several worker processes that share the port (Node `cluster`), set with
`WEB_CONCURRENCY` (default 1). The load test runs the real server with 4 workers, like a small 4-vCPU server.
Deployment (#20) should set `WEB_CONCURRENCY` to the number of CPU cores of the host.

## What the load test does

`npm run load-test` (in `server/`) runs `server/scripts/perf/runLoadTest.js`, which:

1. starts a throwaway MongoDB in memory, so no real data is touched
2. seeds synthetic data: 500 flats, 500 current tenants, 1350 rent payments (3 months), 300 visitors and 300 complaints (`server/scripts/perf/seedPerfData.js`)
3. starts the real API (`src/server.js`) on port 5055 with 4 worker processes (`PERF_WORKERS` to change) and request logging switched off
4. runs `k6-load-test.js` and writes `results/report.md` and `results/summary.json`

The k6 script simulates:

- **200 concurrent signed-in users** (ramp up 30 s, hold 2 min, ramp down 15 s), each waiting 1–2 s between clicks
  - 4 in 5 are admins: tenant list (500 tenants), rent status for the month, flats, payments, complaints, visitors
  - 1 in 5 are residents: view complaints, file a complaint, log a visitor
- **1 login per second** at the same time. Logins are deliberately expensive (bcrypt cost 12, NFR-03), so they are measured separately instead of all 200 users logging in within the same 30 seconds.

The run **fails** (k6 exits with code 99) if any of these thresholds is missed:

- overall 95th percentile ≥ 3 s, or any single endpoint's 95th percentile ≥ 3 s
- more than 1 % failed requests, or fewer than 99 % of checks passing

## Run it yourself

1. Install k6 once:
   - Windows: `winget install k6 --source winget`, then open a **new** terminal
   - macOS: `brew install k6`
   - Others: <https://grafana.com/docs/k6/latest/set-up/install-k6/>
2. From the repository root:

   ```bash
   cd server
   npm install
   npm run load-test
   ```

   It takes about 3 minutes and needs no `.env`.

To start only the seeded API and run k6 yourself (for example with other settings), use `npm run load-test -- --serve`. The k6 script also accepts `-e VUS=300 -e HOLD=5m`. To compare with a single process, set `PERF_WORKERS=1` first (PowerShell: `$env:PERF_WORKERS=1`).

The **Load test** GitHub Actions workflow runs the same command when the load-test files change, or on demand (Actions tab, "Run workflow"). The report appears in the run summary and is attached as an artifact.

## Indexes (NFR-08)

The indexes on reference and sort fields are listed in `server/src/models/README.md`. `server/tests/scale.test.js` checks that they exist and that the main look-ups use them (`IXSCAN`, no full collection scan, no in-memory sort).
