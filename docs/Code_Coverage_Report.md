# Code Coverage Report

Project: ResiTrack, Team H14
Report ID: RESITRACK-CCR-001
Requirement: NFR-09 (MVC codebase with at least 60% unit test coverage), test case TC-NFR-09
Date of run: 6 Nov 2026
Tool: Jest 29 built-in coverage (Istanbul), `npx jest --coverage`

## 1. Result

Coverage is measured over **every file in `server/src/`** (`collectCoverageFrom: ["src/**/*.js"]`), so a file with no tests still counts against the total.

| Metric | Covered | Coverage | Required (NFR-09) | Result |
|---|---|---|---|---|
| Statements | 1022 / 1095 | 93.33% | 60% | Pass |
| Lines | 969 / 1030 | 94.07% | 60% | Pass |
| Functions | 123 / 133 | 92.48% | 60% | Pass |
| Branches | 383 / 460 | 83.26% | 60% | Pass (details in `Branch_Coverage_Report.md`) |

**TC-NFR-09: PASS.** The 60% limit is enforced automatically: `coverageThreshold` in `server/package.json` makes `npm test` and the CI build fail if any of the four numbers drops below 60%.

## 2. Coverage by layer

| Folder | Statements | Lines | Functions |
|---|---|---|---|
| src/routes | 100% | 100% | 100% |
| src/config | 100% | 100% | 100% |
| src/models | 100% | 100% | 100% |
| src/controllers | 99.18% | 99.77% | 100% |
| src/utils | 96.15% | 95.83% | 100% |
| src/services | 94.77% | 95.93% | 94.44% |
| src/middleware | 94.59% | 96.07% | 100% |
| src (app.js, server.js) | 28% | 30% | 0% |

Every route file, model and config file is fully covered, and every controller is at 100% line coverage.

## 3. Lines not covered, and why

| File | Lines | Coverage (lines) | Reason |
|---|---|---|---|
| server.js | 1-89 | 0% | Process start-up: clustering, HTTPS server, database connection, starting the reminder job. Unit tests load `app.js` directly instead. This file runs in the deployment and in the k6 load test (`7-Testing-Tools/load-test`). |
| reminderScheduler.js | 26-32 | 76.47% | The body of the daily cron job. The scheduler is deliberately switched off under test, so tests call `sendDueReminders()` directly instead (32 tests in `reminders.test.js`). |
| notifier.js | 11 | 75% | Console log of a sent reminder, which is switched off under test. |
| auditLogger.js | 16 | 80% | Guard that throws if an audit entry has no actor. Every caller passes the logged-in user, so it never fires. |
| token.js | 9 | 88.88% | Guard that throws if `JWT_SECRET` is not set. The test helpers always set it. |
| auth.js | 47, 83 | 94.87% | Re-throwing unexpected errors and a defensive "no user" check that the route setup makes unreachable. |
| app.js | 43 | 95.45% | Request logging, switched off under test. |
| upload.js, errorHandler.js, maintenanceRequestController.js | one line each | 95-98% | The generic upload error, logging of 500 errors (off under test), and the 2000-character description limit. |

Nothing in the business logic for the FR test cases is left uncovered. The gaps are start-up code, logging and defensive guards.

## 4. Change since Sprint 2

The NFR-09 review on 30 Oct 2026 (`4-Architecture/NFR-09_MVC_Review_and_Coverage.md`) recorded about 92% statements and 83% branches. Since then the owner financial summary (FR-10, PR #58) was added with 20 tests, and statement coverage went up to 93.33%.

## 5. Evidence

- HTML report, file by file with highlighted lines: open `docs/coverage/index.html` in a browser
- Full console output with the coverage table: `docs/unit-test-output.txt`
- CI: each pull request's Actions run shows the same table in its summary and uploads the `server-coverage` artifact
