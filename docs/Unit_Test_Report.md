# Unit Test Report

Project: ResiTrack (Apartment / Residencies Organizer)
Team: H14 (Shreesh Athreya, Shree Krishna, Swaroop Venkateshwar, Sushanth S Rao)
Report ID: RESITRACK-UTR-001
Test Plan: RESITRACK-TP-001 (`2-Test-Planning/2_ResiTrack_TestPlan.pdf`), test cases as updated in `docs/Test_Case_Document.md`
Date of run: 6 Nov 2026
Code under test: `server/` on branch `master` (after PR #60, Sprint-2 code freeze)

## 1. Result

| Item | Value |
|---|---|
| Test suites | 20 run, 20 passed, 0 failed |
| Test cases | 340 run, 340 passed, 0 failed, 0 skipped |
| Run time | 19.98 s |
| Outcome | **PASS** |

## 2. Tools and environment

| Item | Detail |
|---|---|
| Test runner | Jest 29 (`npx jest --coverage --verbose`) |
| HTTP testing | Supertest 7, calls the Express app directly without opening a port |
| Database | mongodb-memory-server 10, a throwaway MongoDB started for each suite, so no real or shared data is touched |
| Machine | Windows, Node.js, run from `server/` after `npm ci` |
| CI | The same suite runs on every pull request and every push to `master` (`.github/workflows/ci.yml`) and fails the build if any test fails or coverage drops under 60% |

## 3. Results by test suite

| Test file | What it tests | Req / TC | Tests | Result |
|---|---|---|---|---|
| tenants.test.js | Register, list, edit and move out tenants; validation; occupied and deactivated flats | FR-01, TC-01, TC-12 | 26 | Pass |
| auth.test.js | Login, password hashing (bcrypt cost 12), account deactivation, admin login audit | FR-02, NFR-03, TC-02, TC-NFR-03 | 17 | Pass |
| notices.test.js | Publish notices (admin only), all roles can read, validation | FR-03, TC-03 | 7 | Pass |
| maintenanceRequests.test.js | Raise requests, status changes with history, Kanban status filter, role checks | FR-04, FR-05, FR-09, TC-04, TC-05, TC-09 | 21 | Pass |
| payments.test.js | Record rent, month and amount validation, one payment per month, paid/unpaid status | FR-06, TC-06 | 21 | Pass |
| reminders.test.js | Reminder timing (3 days before, overdue), no duplicates, retry on failure, run endpoint | FR-07, TC-07 | 32 | Pass |
| reminderScheduler.test.js | Daily cron schedule and time zone, invalid cron | FR-07, TC-07 | 4 | Pass |
| visitors.test.js | Log visitors, timestamps, newest first, no personal data in audit | FR-08, TC-08 | 8 | Pass |
| reports.test.js | Owner financial summary matches a separate DB aggregation, read-only (405), no tenant PII | FR-10, TC-10 | 20 | Pass |
| documents.test.js | PDF/JPEG upload, 5 MB limit (413), wrong type (415), content sniffing, download | FR-11, SEC-06, TC-11 | 17 | Pass |
| flats.test.js | Add, edit, deactivate flats, duplicates, vacancy filter | FR-12, TC-12 | 20 | Pass |
| complaints.test.js | File complaints, status changes with history, audit without details | FR-13, TC-13 | 12 | Pass |
| rbac.test.js | Missing, tampered and expired tokens, 30-minute sliding session, 403 for every out-of-role route | FR-14, NFR-05, SEC-03, SEC-04, TC-14, TC-NFR-05 | 21 | Pass |
| receipts.test.js | Rent receipt PDF contents and structure, resident sees only own receipts | FR-15, TC-15 | 15 | Pass |
| https.test.js | HTTP to HTTPS redirect (308), 426 for HTTP writes, HSTS header | NFR-04, SEC-02, TC-NFR-04 | 10 | Pass |
| scale.test.js | 500 seeded tenants, list endpoints under 3 s, indexes used | NFR-08, TC-NFR-08 | 17 | Pass |
| architecture.test.js | MVC layering rules for every route, controller, model, service, middleware and util file | NFR-09, TC-NFR-09 | 57 | Pass |
| auditLogs.test.js | Audit log retrieval, admin only, newest first, limit | NFR-10, SEC-05, TC-NFR-10 | 4 | Pass |
| app.test.js | Health check, 404 format, central error handler, malformed JSON | API layer | 8 | Pass |
| db.test.js | Database connection setup and failure handling | API layer | 3 | Pass |
| **Total** | | | **340** | **Pass** |

The scale suite also printed response times with 500 tenants seeded. The slowest list endpoint took 97 ms (`/api/tenants`, `/api/payments`), well under the 3 s limit in NFR-08.

## 4. Defects

No test failed in this run, so no new defects were raised. Defects found earlier in the sprints were fixed through pull requests, for example the notices read-access bug (D-3, PR #54).

## 5. Not covered by unit tests

- The React client (`client/`) has no automated tests. UI test cases were checked by hand in a browser (deviation D-8 in `3-RE/Deviations_from_SRS_SAD_TestPlan.md`).
- `server/src/server.js` (process start-up) is not loaded by unit tests. It runs in the deployment and the k6 load test. See `docs/Code_Coverage_Report.md`.

## 6. Evidence and how to reproduce

- Full console output: `docs/unit-test-output.txt`
- Machine-readable results: `docs/jest-results.json`
- Coverage report: `docs/coverage/index.html`

```
cd server
npm ci
npx jest --coverage --verbose
```
