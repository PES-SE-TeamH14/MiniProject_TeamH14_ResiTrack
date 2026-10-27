# Load test results – NFR-01 (#22) and NFR-08 (#23)

**Result: PASS** – 95th percentile 647 ms (limit 3000 ms) with 200 concurrent users (peak 201 k6 virtual users, including logins).

## Setup

- Run on: 2026-10-27T15:39:49.808Z
- Tool: k6.exe v2.2.0 (commit/00a9a1b7f5, go1.26.5, windows/amd64)
- Machine: Windows_NT 10.0.26300, 13th Gen Intel(R) Core(TM) i7-13650HX, 20 logical cores, 24 GB RAM, Node v22.20.0
- Server: 4 API worker process(es) (WEB_CONCURRENCY), MongoDB on the same machine
- Load: ramp to 200 virtual users over 30 s, hold for 2m, ramp down 15 s; 1–2 s think time between actions
- Users: 4 in 5 are admins (tenants, rent status, flats, payments, complaints, visitors), 1 in 5 are residents (complaints, visitors)
- Logins: 1 per second during the hold, on top of the 200 users (bcrypt cost 12)
- Data: 500 flats, 500 tenants, 1350 payments, 300 visitors, 300 complaints (throwaway MongoDB)

## Overall

| Metric | Value |
|---|---|
| Requests | 17118 (102.6 per second) |
| Failed requests | 0.00 % (limit 1 %) |
| Checks passed | 100.00 % |
| Median | 93 ms |
| 90th percentile | 518 ms |
| **95th percentile** | **647 ms** (limit 3000 ms) |
| 99th percentile | 863 ms |
| Slowest | 1307 ms |

## Per endpoint

| Endpoint | Requests | Median | 95th percentile | Slowest | p95 ≤ 3 s |
|---|---|---|---|---|---|
| POST /api/auth/login | 123 | 741 ms | 965 ms | 1090 ms | PASS |
| GET /api/tenants | 3404 | 110 ms | 675 ms | 1005 ms | PASS |
| GET /api/payments/status | 2683 | 151 ms | 841 ms | 1307 ms | PASS |
| GET /api/flats | 2023 | 67 ms | 474 ms | 789 ms | PASS |
| GET /api/payments | 2029 | 122 ms | 679 ms | 1117 ms | PASS |
| GET /api/complaints | 3420 | 84 ms | 501 ms | 726 ms | PASS |
| GET /api/visitors | 1371 | 72 ms | 487 ms | 771 ms | PASS |
| GET /api/health | 669 | 15 ms | 133 ms | 218 ms | PASS |
| POST /api/complaints | 699 | 47 ms | 366 ms | 511 ms | PASS |
| POST /api/visitors | 697 | 42 ms | 375 ms | 596 ms | PASS |

Full k6 output: `summary.json` in this folder.
