# Test Case Document (updated after Sprint 2)

Project: ResiTrack, Team H14
Test Plan: RESITRACK-TP-001
Version: 1.2, 6 Nov 2026
Replaces: the test case table in `2-Test-Planning/2_ResiTrack_TestPlan.pdf` §7 (v1.1, 13 Oct 2026)

The test cases were updated to match what changed during Sprint 1 and Sprint 2. Every change is explained in `3-RE/Deviations_from_SRS_SAD_TestPlan.md` (D-1 to D-9). The "Change" column shows whether a case is **Unchanged**, **Modified** or **Extended** (same expected result, more checks added).

## 1. Functional test cases

| TC ID | Req | UC | Description | Expected result | Priority | Change | Automated by |
|---|---|---|---|---|---|---|---|
| TC-01 | FR-01 | UC-01 | Register a new tenant | Record created with correct fields; success message shown. **Added:** invalid email/phone, a lease ending before it starts, and occupied or deactivated flats are rejected; a duplicate email gives 409 and leaves the flat vacant; move-out frees the flat | High | Extended | tenants.test.js |
| TC-02 | FR-02 | UC-02 | Login with valid/invalid credentials | Valid login succeeds; invalid login rejected, no session created. **Added:** unknown email and wrong password give the same answer; a deactivated account gets 403 | High | Extended | auth.test.js |
| TC-03 | FR-03 | UC-03 | Post a community notice | Notice visible to **every logged-in role** within 5 s (was "all residents"); only admins can publish | High | Modified (D-3, D-5) | notices.test.js |
| TC-04 | FR-04 | UC-04 | Raise a maintenance request | Request saved as "Open"; confirmation shown. **Added:** the resident sees only their own requests | High | Modified (D-2) | maintenanceRequests.test.js |
| TC-05 | FR-05 | UC-05 | Update maintenance request status | Status change saved with history and shown in the resident view within 3 s. **Maintenance and Admin** may change status (was Maintenance only); residents and owners get 403 | High | Modified (D-1, D-5) | maintenanceRequests.test.js |
| TC-06 | FR-06 | UC-06 | Record a rent payment | Payment correct; tenant marked paid. **Added:** one payment per tenant per month; no future dates; no payments for moved-out tenants | High | Extended | payments.test.js |
| TC-07 | FR-07 | UC-07 | Automated payment reminder | Reminder sent 3 days before the due date. **Added:** overdue reminder after the due date; each reminder sent once; failed sends retried; job runs daily at 09:00 India time | Medium | Extended | reminders.test.js, reminderScheduler.test.js |
| TC-08 | FR-08 | UC-08 | Log a visitor entry | Entry appears with timestamp, newest first; the client cannot set the timestamp | Medium | Unchanged | visitors.test.js |
| TC-09 | FR-09 | UC-09 | Kanban board, move a card | Board shows **Open, In Progress and Resolved** columns (was open requests only); dragging a card saves the new status; admin moves are audited | Medium | Modified (D-1, D-4) | maintenanceRequests.test.js (API); drag and drop checked by hand |
| TC-10 | FR-10 | UC-10 | Owner financial summary | Rent collected, dues and occupancy match a DB aggregation. Readable by **Owner and Admin** (was Owner only); read-only, other methods return 405; no tenant names or contact details | Medium | Modified (D-6) | reports.test.js |
| TC-11 | FR-11 | UC-11 | Upload lease / ID document | PDF/JPEG up to 5 MB accepted, stored and retrievable. **Added:** over 5 MB → 413, other types → 415, decided from the file contents and not the name | Medium | Extended | documents.test.js |
| TC-12 | FR-12 | UC-12 | Manage flat inventory | Add, edit and deactivate work; a deactivated flat cannot be assigned. **Added:** an occupied flat cannot be deactivated; duplicate flat numbers → 409 | High | Extended | flats.test.js, tenants.test.js |
| TC-13 | FR-13 | UC-13 | File a complaint and track status | Complaint logged as Open; each status change is added to its history | Medium | Unchanged | complaints.test.js |
| TC-14 | FR-14 | UC-14 | Role-based access control | Every out-of-role call gets 403. **Added:** missing or tampered token → 401; role is read from the database, not the token | High | Extended | rbac.test.js |
| TC-15 | FR-15 | UC-15 | Generate monthly rent receipt | PDF has tenant name, flat, amount and date. **Added:** residents can download only their own receipts | Low | Extended | receipts.test.js |

## 2. Non-functional test cases

| TC ID | Req | Description | Expected result | Priority | Change | How it is run |
|---|---|---|---|---|---|---|
| TC-NFR-01 | NFR-01 | Response time under load | 95th percentile ≤ 3 s at 200 concurrent users | High | Unchanged | k6 (`7-Testing-Tools/load-test`) |
| TC-NFR-02 | NFR-02 | Availability during peak hours | Uptime ≥ 99.5% (8 AM - 10 PM, 30 days). A 24-hour figure also counts, as it is stricter; if monitored for less than 30 days, the actual period is stated | Medium | Modified (how it is measured) | UptimeRobot, plus `uptime.yml` every 15 min |
| TC-NFR-03 | NFR-03, SEC-01 | Password storage security | bcrypt hash, cost 12, never plain text or returned by the API | High | Unchanged | auth.test.js |
| TC-NFR-04 | NFR-04, SEC-02 | Transport encryption | TLS 1.2+ only. Plain HTTP: GET/HEAD redirected with 308, other methods 426; HSTS header sent. `/api/health` stays open over HTTP for platform health checks | High | Modified (exact HTTP behaviour fixed) | https.test.js, plus SSL Labs or `npm run check-tls` |
| TC-NFR-05 | NFR-05, SEC-04 | Session timeout | A session idle for 30+ min is rejected (401 SESSION_EXPIRED) and the user is sent to login. Each request renews the 30-minute window (X-Auth-Token header) | High | Modified (sliding session added) | rbac.test.js |
| TC-NFR-06 | NFR-06 | Mobile responsiveness | Key screens usable at 375 px, no clipped controls | Medium | Modified (run by hand, not Cypress/Playwright; D-8) | Manual, browser dev tools |
| TC-NFR-07 | NFR-07 | New admin onboarding (timed) | First-time admin logs in, adds a flat and registers a tenant unaided in ≤ 10 min. At least 2 participants from outside the team | Medium | Modified (protocol written; adding a flat is now part of the task) | Manual, `2-Test-Planning/TC-NFR-07_Onboarding_Usability_Test.md` |
| TC-NFR-08 | NFR-08 | Scalability with 500 tenants | With 500 tenants seeded, responses ≤ 3 s. **Added:** queries use indexes, not full scans | Medium | Extended | scale.test.js, k6 |
| TC-NFR-09 | NFR-09 | Code structure and coverage | Coverage ≥ 60% for statements, branches, functions and lines, measured over all of `server/src`; MVC layering checked automatically on every PR | Medium | Extended | architecture.test.js, Jest coverage threshold in CI |
| TC-NFR-10 | NFR-10, SEC-05 | Audit logging of admin actions | Each admin login, create, edit and delete creates a log entry with actor ID and timestamp, **without personal details**; only admins can read the log | High | Extended | auditLogs.test.js and audit checks in each module's tests |

## 3. Changes to the test approach

| Plan (v1.1) | Now | Reason |
|---|---|---|
| Tools: Jest/Mocha, Supertest, Cypress/Playwright | Jest + Supertest + mongodb-memory-server for the API. UI cases checked by hand | No time to add browser automation in two sprints (D-8) |
| Test against a MongoDB test cluster | A throwaway in-memory MongoDB for each test suite | Tests never touch shared data and run the same way in CI |
| Unit tests for controllers with ≥ 60% coverage | 340 tests across 20 suites; coverage measured over the whole server, enforced in CI | Stricter than the plan |

## 4. Revision history

| Version | Date | Changes |
|---|---|---|
| 1.0 | 28 Sep 2026 | Initial test plan (Part-1) |
| 1.1 | 13 Oct 2026 | Test case IDs aligned with SRS §6 RTM; every FR and NFR given a test case |
| 1.2 | 6 Nov 2026 | Updated after Sprint 2: TC-03, 04, 05, 09, 10 and TC-NFR-02, 04, 05, 06, 07 modified, other cases extended with the extra checks now automated; test approach updated (section 3) |
