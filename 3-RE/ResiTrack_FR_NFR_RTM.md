# ResiTrack – Functional, Non-Functional Requirements and RTM

Source: SRS (`1-SRS-WBS/1_ResiTrack_SRS.pdf`), sections 3, 5 and 6. Test case IDs refer to the Test Plan (`2-Test-Planning/2_ResiTrack_TestPlan.pdf`, rev. 1.1). Backlog items are the GitHub issues on the project board.

## 1. Functional Requirements

| ID | Requirement | Priority | Verification Criterion |
|---|---|---|---|
| FR-01 | Admin shall register a new tenant with flat number, contact details, and lease start/end dates. | High | Record appears in DB with all fields populated. |
| FR-02 | Tenants shall log in using registered email and password. | High | Valid credentials succeed; invalid credentials are rejected. |
| FR-03 | Admin shall post community notices visible to all residents. | High | Notice visible to all logged-in residents within 5s of posting. |
| FR-04 | Residents shall raise maintenance requests with category, description, and priority. | High | Request saved with status “Open”; confirmation shown. |
| FR-05 | Maintenance staff shall update request status (Open / In Progress / Resolved). | High | Status change reflected in DB and resident view within 3s. |
| FR-06 | Admin shall record and track monthly rent payments per tenant. | High | Payment record stores amount, date, flat ID; tenant marked paid. |
| FR-07 | System shall send automated rent reminders for upcoming/overdue payments. | Medium | Reminder triggered ≥3 days before due date. |
| FR-08 | Residents shall log visitor entries (name, contact, purpose, flat number). | Medium | Entry appears in admin dashboard with timestamp. |
| FR-09 | Admin shall view a Kanban-style dashboard of open maintenance requests. | Medium | Board loads; cards draggable across status columns. |
| FR-10 | Owners shall view financial summaries (rent collected, dues, occupancy rate). | Medium | Dashboard totals match DB aggregation. |
| FR-11 | System shall support document upload for lease agreements and ID proofs. | Medium | PDF/JPEG ≤5 MB accepted, stored, retrievable. |
| FR-12 | Admin shall manage flat inventory (add / edit / deactivate units). | High | Change reflected immediately in tenant assignment. |
| FR-13 | Tenants shall file complaints and track resolution status. | Medium | Complaint logged; status transitions visible to resident. |
| FR-14 | System shall enforce role-based access control (Admin, Resident, Maintenance, Owner). | High | Out-of-role request returns HTTP 403. |
| FR-15 | System shall generate printable monthly rent receipts (PDF). | Low | PDF contains tenant name, flat, amount, date. |

## 2. Non-Functional Requirements

| ID | Requirement | Category | Verification Criterion |
|---|---|---|---|
| NFR-01 | Respond to any user action within 3s under normal load (≤200 concurrent users). | Performance | Load test: 95th-percentile ≤3s at 200 vUsers. |
| NFR-02 | 99.5% availability during peak hours (8 AM–10 PM). | Availability | 30-day uptime monitor ≥99.5%. |
| NFR-03 | Passwords stored as bcrypt hashes (cost factor ≥12). | Security | DB shows hash prefix `$2b$12$`, never plaintext. |
| NFR-04 | All data in transit encrypted (TLS 1.2+). | Security | SSL scan grade A; plaintext HTTP rejected. |
| NFR-05 | Session times out after 30 minutes of inactivity. | Security | Idle session token rejected; redirect to login. |
| NFR-06 | UI usable on mobile browsers (responsive). | Usability | Renders correctly at 375px viewport. |
| NFR-07 | New admin completes onboarding + adds a tenant in ≤10 minutes unaided. | Usability | Timed usability test. |
| NFR-08 | Scales to 500 tenant records without response-time degradation. | Scalability | Perf test at 500 records: ≤3s response. |
| NFR-09 | Codebase follows MVC; ≥60% unit test coverage. | Maintainability | Coverage report + architecture review. |
| NFR-10 | All admin actions (login, edit, delete) are logged for audit. | Auditability | Log entry created and retrievable per action. |

## 3. Security Requirements

| ID | Requirement | Security Objective |
|---|---|---|
| SEC-01 | Passwords stored as bcrypt hashes, cost factor ≥12 (= NFR-03). | SO-01, SO-04 |
| SEC-02 | All data in transit encrypted via TLS 1.2+ (= NFR-04). | SO-01 |
| SEC-03 | RBAC middleware returns HTTP 403 for any out-of-role request (= FR-14). | SO-03 |
| SEC-04 | Sessions expire after 30 minutes of inactivity (= NFR-05). | SO-01, SO-03 |
| SEC-05 | Admin actions logged immutably with actor ID and timestamp (= NFR-10). | SO-02, SO-04 |
| SEC-06 | Uploaded documents restricted to PDF/JPEG, ≤5 MB (= FR-11). | SO-01, SO-03 |

Security objectives: SO-01 Confidentiality, SO-02 Integrity, SO-03 Availability of role-appropriate access, SO-04 Accountability.

## 4. Requirements Traceability Matrix (RTM)

| Req ID | Use Case | Test Case ID | Backlog Item |
|---|---|---|---|
| FR-01 | UC-01 | TC-01 | [#8](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/8) |
| FR-02 | UC-02 | TC-02 | [#3](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/3) |
| FR-03 | UC-03 | TC-03 | [#10](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/10) |
| FR-04 | UC-04 | TC-04 | [#11](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/11) |
| FR-05 | UC-05 | TC-05 | [#12](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/12) |
| FR-06 | UC-06 | TC-06 | [#9](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/9) |
| FR-07 | UC-07 | TC-07 | [#17](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/17) |
| FR-08 | UC-08 | TC-08 | [#13](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/13) |
| FR-09 | UC-09 | TC-09 | [#24](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/24) |
| FR-10 | UC-10 | TC-10 | [#28](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/28) |
| FR-11 | UC-11 | TC-11 | [#21](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/21) |
| FR-12 | UC-12 | TC-12 | [#7](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/7) |
| FR-13 | UC-13 | TC-13 | [#14](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/14) |
| FR-14 | UC-14 | TC-14 | [#4](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/4) |
| FR-15 | UC-15 | TC-15 | [#18](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/18) |
| NFR-01 | — | TC-NFR-01 | [#22](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/22) |
| NFR-02 | — | TC-NFR-02 | [#20](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/20) |
| NFR-03 | UC-02 | TC-NFR-03 | [#5](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/5) |
| NFR-04 | — | TC-NFR-04 | [#19](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/19) |
| NFR-05 | UC-02 | TC-NFR-05 | [#6](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/6) |
| NFR-06 | All UCs | TC-NFR-06 | [#25](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/25) |
| NFR-07 | UC-01, UC-02 | TC-NFR-07 | [#26](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/26) |
| NFR-08 | — | TC-NFR-08 | [#23](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/23) |
| NFR-09 | — | TC-NFR-09 | [#29](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/29) |
| NFR-10 | All Admin UCs | TC-NFR-10 | [#15](https://github.com/switchblade-kratos/ResiTrack-SE-Miniproject/issues/15) |
