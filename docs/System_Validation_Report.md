# System Validation Report

Project: ResiTrack, Team H14
Report ID: RESITRACK-SVR-001
Test Plan: RESITRACK-TP-001, test cases as updated in `docs/Test_Case_Document.md` (v1.2)
Build validated: `master` after PR #60 (Sprint-2 code freeze)
Date: 6 Nov 2026

This report checks the finished system against every test case in the Test Plan (§7) and the security controls in §5.1. Each case traces back to its SRS requirement.

## 1. Summary

| | Count |
|---|---|
| Test cases in the plan | 25 (15 functional, 10 non-functional) |
| Passed | 22 |
| Passed in part, evidence still to add | 1 (TC-NFR-04) |
| Not yet executed | 2 (TC-NFR-02, TC-NFR-07) |
| Failed | 0 |

How each case was run:
- **Automated:** Jest + Supertest API tests against an in-memory MongoDB (`docs/Unit_Test_Report.md`), run locally and in CI.
- **Load:** k6 load test (`7-Testing-Tools/load-test/results/report.md`).
- **Manual:** in a browser against the running app. The plan named Cypress/Playwright for this, but the team did these checks by hand (deviation D-8).

Exit criteria from Test Plan §5: all planned cases executed, all High-priority cases pass, no open Critical or High defects. TC-NFR-04 is High priority, so its TLS scan has to be recorded before the exit criteria are fully met.

## 2. Functional test cases

| TC | Req | Use case | Expected result (from plan) | Method | Evidence | Result |
|---|---|---|---|---|---|---|
| TC-01 | FR-01 | UC-01 | Tenant record created with correct fields | Automated | tenants.test.js, 26 tests | Pass |
| TC-02 | FR-02 | UC-02 | Valid login succeeds; invalid login rejected, no session | Automated | auth.test.js, login suite (10 tests) | Pass |
| TC-03 | FR-03 | UC-03 | Notice visible to all residents within 5 s | Automated + design | notices.test.js, 7 tests; the notices page re-fetches every 5 s (D-5) | Pass |
| TC-04 | FR-04 | UC-04 | Request saved as "Open", confirmation shown | Automated | maintenanceRequests.test.js, POST suite | Pass |
| TC-05 | FR-05 | UC-05 | Status change reflected in DB and resident view within 3 s | Automated + manual | maintenanceRequests.test.js, PATCH suite; manual check: change reached the resident page in 1.65 s (D-5) | Pass |
| TC-06 | FR-06 | UC-06 | Payment record correct; tenant marked paid | Automated | payments.test.js, 21 tests, including paid/unpaid status | Pass |
| TC-07 | FR-07 | UC-07 | Reminder triggered at least 3 days before due date | Automated | reminders.test.js (32) + reminderScheduler.test.js (4) | Pass |
| TC-08 | FR-08 | UC-08 | Entry appears in admin dashboard with timestamp | Automated | visitors.test.js, 8 tests | Pass |
| TC-09 | FR-09 | UC-09 | Kanban board loads; dragged card's status updated in DB | Automated (API) + manual (UI) | maintenanceRequests.test.js (admin move, status filter); drag and drop checked by hand in the browser and shown in the Sprint-2 demo video | Pass |
| TC-10 | FR-10 | UC-10 | Rent collected, dues and occupancy match DB aggregation | Automated | reports.test.js, includes a test that compares the totals with a separate DB aggregation | Pass |
| TC-11 | FR-11 | UC-11 | PDF/JPEG up to 5 MB accepted, stored and retrievable | Automated | documents.test.js, 17 tests | Pass |
| TC-12 | FR-12 | UC-12 | Add/edit/deactivate works; deactivated flat not assignable | Automated | flats.test.js (20) + tenants.test.js "does not assign a deactivated flat" | Pass |
| TC-13 | FR-13 | UC-13 | Complaint logged; status changes visible | Automated | complaints.test.js, 12 tests | Pass |
| TC-14 | FR-14 | UC-14 | Out-of-role API call rejected with 403 | Automated | rbac.test.js: every protected route is called by every role it should refuse | Pass |
| TC-15 | FR-15 | UC-15 | Receipt PDF has tenant name, flat, amount and date | Automated | receipts.test.js, 15 tests | Pass |

## 3. Non-functional test cases

| TC | Req | Expected result (from plan) | Method | Evidence | Result |
|---|---|---|---|---|---|
| TC-NFR-01 | NFR-01 | 95th percentile ≤ 3 s at 200 concurrent users | Load (k6) | 27 Oct 2026: 17,118 requests, 0% failed, p95 = 647 ms, 200 virtual users for 2 min (`7-Testing-Tools/load-test/results/report.md`) | Pass |
| TC-NFR-02 | NFR-02 | Uptime ≥ 99.5% between 8 AM and 10 PM over 30 days | Uptime monitor | UptimeRobot + `.github/workflows/uptime.yml`. **TO FILL:** uptime %, period monitored, screenshot path | Not yet executed |
| TC-NFR-03 | NFR-03, SEC-01 | Password stored as bcrypt hash, cost ≥ 12 | Automated | auth.test.js "stores the password as a bcrypt hash with cost 12, never as plain text" | Pass |
| TC-NFR-04 | NFR-04, SEC-02 | TLS 1.2+ only; plain HTTP rejected or redirected | Automated + scan | https.test.js, 10 tests: HTTP GET → 308 to HTTPS, HTTP POST → 426, HSTS header sent. **TO FILL:** SSL Labs grade or `npm run check-tls` output showing TLS 1.0/1.1 refused | Pass in part |
| TC-NFR-05 | NFR-05, SEC-04 | Session idle for 30+ min is rejected | Automated | rbac.test.js: expired token → 401 SESSION_EXPIRED; 30-minute sliding session | Pass |
| TC-NFR-06 | NFR-06 | Key screens usable at 375 px, no clipped controls | Manual | Checked by hand at 375 px in browser dev tools after the responsive UI change (PR #55) | Pass |
| TC-NFR-07 | NFR-07 | First-time admin adds a tenant unaided in ≤ 10 min | Manual (timed) | Pre-test walkthrough done 30 Oct (one blocker found and fixed); scripted run took 51 s. Sessions with first-time users not yet run (D-9) | Not yet executed |
| TC-NFR-08 | NFR-08 | With 500 tenants seeded, responses ≤ 3 s | Automated + load | scale.test.js (17 tests, slowest list endpoint 97 ms); the k6 run above also used 500 tenants | Pass |
| TC-NFR-09 | NFR-09 | Coverage ≥ 60%; MVC layering confirmed | Automated | Statements 93.33%, branches 83.26% (`Code_Coverage_Report.md`, `Branch_Coverage_Report.md`); architecture.test.js, 57 tests | Pass |
| TC-NFR-10 | NFR-10, SEC-05 | Each admin login/edit/delete creates a log entry with actor ID and timestamp | Automated | auditLogs.test.js, plus audit checks in the tenants, flats, payments, complaints, visitors, documents, receipts and auth suites | Pass |

## 4. Security validation (Test Plan §5.1)

| Control | Requirement | How it was validated | Result |
|---|---|---|---|
| Password storage | SEC-01 | Test reads the stored hash and checks the `$2b$12$` prefix and that the password is never returned by queries or JSON | Pass |
| Transport encryption | SEC-02 | HTTP redirect / 426 / HSTS tested automatically. TLS version scan: **TO FILL** | Pass in part |
| RBAC enforcement | SEC-03 | Every protected route called by every refused role → 403; role is read from the database, not from the token | Pass |
| Session timeout | SEC-04 | Expired token rejected with 401 SESSION_EXPIRED and not refreshed | Pass |
| Audit logging | SEC-05 | Admin actions create entries with actor ID and timestamp, without personal details; only admins can read them | Pass |
| File-upload validation | SEC-06 | Files over 5 MB → 413, wrong types → 415, file contents checked rather than the name; nothing stored on rejection | Pass |

## 5. Defects

No open defects. Defects found during the sprints were fixed before the code freeze:

| Defect | Found in | Fix |
|---|---|---|
| Maintenance staff and owners could not read notices, against the SAD | Sprint 2 | PR #54 (D-3) |
| README did not explain how to create the first admin, which blocked onboarding | TC-NFR-07 pre-test, 30 Oct | README updated (TC-NFR-07 doc, section 1) |

## 6. Conclusion

All 15 functional test cases pass, and so do 7 of the 10 non-functional ones. All six security controls pass, with SEC-02 still needing its TLS scan evidence. The system meets the SRS requirements apart from the evidence still to be added for TC-NFR-02, TC-NFR-04 and TC-NFR-07, listed above.
