# Baseline (before the fix): single API process – NFR-01 (#22)

First run, with one Node.js process. Kept for comparison; see ../README.md.

**Result: FAIL** – 95th percentile 6088 ms (limit 3000 ms) with 200 concurrent users (peak 210 k6 virtual users, including logins).

## Setup

- Run on: 2026-10-27T15:28:19.809Z
- Tool: k6.exe v2.2.0 (commit/00a9a1b7f5, go1.26.5, windows/amd64)
- Machine: Windows_NT 10.0.26300, 13th Gen Intel(R) Core(TM) i7-13650HX, 20 logical cores, 24 GB RAM, Node v22.20.0
- Load: ramp to 200 virtual users over 30 s, hold for 2m, ramp down 15 s; 1–2 s think time between actions
- Users: 4 in 5 are admins (tenants, rent status, flats, payments, complaints, visitors), 1 in 5 are residents (complaints, visitors)
- Logins: 1 per second during the hold, on top of the 200 users (bcrypt cost 12)
- Data: 500 flats, 500 tenants, 1350 payments, 300 visitors, 300 complaints (throwaway MongoDB)

## Overall

| Metric | Value |
|---|---|
| Requests | 10118 (60.5 per second) |
| Failed requests | 0.03 % (limit 1 %) |
| Checks passed | 99.97 % |
| Median | 490 ms |
| 90th percentile | 4347 ms |
| **95th percentile** | **6088 ms** (limit 3000 ms) |
| 99th percentile | 8776 ms |
| Slowest | 13599 ms |

## Per endpoint

| Endpoint | Requests | Median | 95th percentile | Slowest | p95 ≤ 3 s |
|---|---|---|---|---|---|
| POST /api/auth/login | 117 | 776 ms | 8854 ms | 12888 ms | FAIL |
| GET /api/tenants | 1934 | 559 ms | 6653 ms | 9965 ms | FAIL |
| GET /api/payments/status | 1548 | 738 ms | 8732 ms | 13599 ms | FAIL |
| GET /api/flats | 1169 | 360 ms | 4348 ms | 8308 ms | FAIL |
| GET /api/payments | 1172 | 568 ms | 6975 ms | 9714 ms | FAIL |
| GET /api/complaints | 2075 | 385 ms | 4394 ms | 6802 ms | FAIL |
| GET /api/visitors | 781 | 370 ms | 4327 ms | 8292 ms | FAIL |
| GET /api/health | 407 | 110 ms | 1100 ms | 2263 ms | PASS |
| POST /api/complaints | 444 | 295 ms | 3169 ms | 4319 ms | FAIL |
| POST /api/visitors | 471 | 303 ms | 3052 ms | 5653 ms | FAIL |

Full k6 output: `summary.json` in this folder.
