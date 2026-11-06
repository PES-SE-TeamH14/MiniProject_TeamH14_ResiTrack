# Branch Coverage Report

Project: ResiTrack, Team H14
Report ID: RESITRACK-BCR-001
Requirement: NFR-09, test case TC-NFR-09
Date of run: 6 Nov 2026
Tool: Jest 29 built-in coverage (Istanbul), `npx jest --coverage`

A branch is one side of a decision in the code: each `if`/`else`, `? :`, `&&`/`||`, `??`, `?.` and default parameter value. Branch coverage counts how many of these sides the tests actually ran, so it is a stricter measure than line coverage.

## 1. Result

| Metric | Covered | Coverage | Required (NFR-09) | Result |
|---|---|---|---|---|
| Branches | 383 / 460 | **83.26%** | 60% | **Pass** |

The CI build fails if branch coverage drops below 60% (`coverageThreshold.global.branches` in `server/package.json`).

## 2. Branch coverage by layer

| Folder | Branches |
|---|---|
| src/config | 100% |
| src/routes | 100% |
| src/controllers | 93.10% |
| src/middleware | 89.88% |
| src/utils | 86.95% |
| src/models | 80.00% |
| src/services | 73.52% |
| src (app.js, server.js) | 19.44% |

## 3. Branch coverage by file

Files at 100%: config/db.js, every file in routes/, auditLogController.js, flatController.js, reminderController.js, enforceHttps.js, notFound.js, reminderScheduler.js, ApiError.js, asyncHandler.js, and the models AuditLog, Document, Flat, Notice, Payment, Reminder, Tenant, User and Visitor.

| File | Branches | Uncovered line(s) | Branch not taken, and why |
|---|---|---|---|
| server.js | 0% | 1-89 | Start-up file, not loaded by unit tests (see Code Coverage Report). |
| healthController.js | 50% | 13 | The `'unknown'` fallback for a database state that has no name. Mongoose only reports the named states. |
| Complaint.js | 50% | 62 | Default status history uses `this.status \|\| 'Open'`. The status is always set first, so the `'Open'` fallback never runs. |
| MaintenanceRequest.js | 50% | 48 | Same default-value fallback as Complaint.js. |
| notifier.js | 50% | 11 | The "not under test" side of the logging check. |
| receiptService.js | 50% | 8 | Shortening very long names on the receipt. Test data never has names over the limit. |
| app.js | 70% | 43 | Request logging is switched off under test. |
| visitorController.js | 75% | 23 | Only admins write a visitor audit entry. The tests log visitors as an admin, so the non-admin side (no audit entry) is not run. |
| token.js | 75% | 9 | Missing `JWT_SECRET` guard. |
| reminderService.js | 77.77% | 30-31, 46 | Fallback text when a tenant has no flat number or rent, and re-throwing database errors other than a duplicate key. |
| noticeController.js | 78.57% | 8, 14-15 | Empty request body, and titles over 120 / messages over 5000 characters. |
| auditLogger.js | 83.33% | 16 | Missing actor ID guard. |
| errorHandler.js | 83.33% | 39 | Writing a 500 error to the server log, which is switched off under test. |
| documentController.js | 84.21% | 11-14 | Cleaning control characters and slashes out of uploaded file names. |
| auth.js | 88.46% | 47, 83 | Unexpected token errors and a defensive "no user" check. |
| upload.js | 90% | 39 | The generic "upload exactly one file" error for upload problems other than size. |
| complaintController.js | 90.90% | 75 | Admin-only audit entry on a status change. The non-admin side is not run. |
| simplePdf.js | 90.90% | 21 | Default values for font size and bold. Every call in the code passes them. |
| maintenanceRequestController.js | 91.17% | 31 | Rejecting a description over 2000 characters. |
| authController.js | 94.44% | 13 | Fallback for a login request with no body at all. |
| reportController.js | 94.73% | 83 | Rent fallback of 0 when a tenant has no flat linked. |
| tenantController.js | 96.29% | 103 | One of the "tenant not found" (404) paths. |
| paymentController.js | 97.50% | 125 | Rent fallback of 0 when a tenant has no flat linked. |

## 4. Assessment

- Every decision that enforces a requirement is covered on both sides: role checks (403), login and token checks (401), file size and type limits (413, 415), validation errors (400), duplicates (409) and read-only reports (405). These are the branches the SRS security requirements SEC-01 to SEC-06 depend on.
- The branches left are fallback values, logging switches, defensive guards and input-length limits.
- Possible follow-up, not needed for NFR-09: add tests for over-length notice titles, messages and maintenance descriptions, long names on receipts, unsafe characters in uploaded file names, and non-admin visitor and complaint actions. These are cheap and would lift the controllers and services further.

## 5. Evidence

- HTML report with each missed branch highlighted in yellow: `docs/coverage/index.html`
- Console coverage table: `docs/unit-test-output.txt`
