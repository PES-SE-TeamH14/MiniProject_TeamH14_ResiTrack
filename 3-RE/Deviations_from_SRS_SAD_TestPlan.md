# Deviations from the SRS, SAD and Test Plan (DEL-02, #27)

Where the delivered product differs from `1-SRS-WBS/1_ResiTrack_SRS.pdf`, `4-Architecture/3_ResiTrack_ArchitectureDesign.pdf` (SAD) and `2-Test-Planning/2_ResiTrack_TestPlan.pdf`, and why.
Each row was checked against the code. The "Status" column says whether the change is on `master` or still in an open pull request.

## 1. Requirements and API (SAD §3.2)

| # | Document says | Delivered | Why | Req / issue | Status |
|---|---|---|---|---|---|
| D-1 | `PATCH /api/maintenance-requests/:id`: **Maintenance** role only. FR-05: "Only Maintenance role can change status (403 otherwise)". | Maintenance **and Admin** can change the status. Residents and owners get 403. Admin changes are written to the audit log. | FR-09 needs the admin to drag Kanban cards and have the new status saved, which is impossible if only Maintenance may change status. | FR-05 #12, FR-09 #24 | Open PR (`feature/maintenance-status`) |
| D-2 | `GET /api/maintenance-requests`: Admin, Maintenance. | Also allowed for Residents, who see **only their own** requests. | FR-04/FR-05 need the resident to see their request's status ("resident view within 3 s"). | FR-04 #11, FR-05 #12 | On `master` (resident access); filter in open PR |
| D-3 | `GET /api/notices`: **All** roles. | Was Resident and Admin only. Fixed so every logged-in role can read; publishing stays admin-only. | Bug against the SAD. | FR-03 #10 | Open PR (`fix/notices-all-roles`) |
| D-4 | FR-09: Kanban board of **open** maintenance requests. | The board shows all three columns (Open, In Progress, Resolved). | Its acceptance criterion needs cards to move across all three status columns. | FR-09 #24 | Open PR (`feature/maintenance-kanban`) |
| D-5 | FR-03 "visible within 5 s", FR-05 "resident view within 3 s". | Met by the page re-fetching every 5 s (notices) and 3 s (maintenance), not by server push. A status change reached the resident page in 1.65 s in a manual check. | Keeps the stack simple (no WebSocket server) and works behind Render's proxy. | FR-03, FR-05 | `master` / open PR |
| D-6 | GET `/api/reports/financial-summary` for Owners (FR-10). | Not on `master` as of 30 Oct 2026. | Issue #28 is still open. | FR-10 #28 | Open |

## 2. Schedule

| # | Plan | Actual |
|---|---|---|
| D-7 | FR-03 (#10), FR-04 (#11) and FR-05 (#12) were in the Sprint-1 milestone. | They were not started in Sprint 1 (see `9-Demo/README.md`) and were delivered in Sprint 2. |

## 3. Testing (Test Plan)

| # | Plan | Actual |
|---|---|---|
| D-8 | Tools: Jest/Mocha, Supertest, **Cypress/Playwright**. | API and unit tests use Jest + Supertest + mongodb-memory-server and run in CI. There are **no automated browser (Cypress/Playwright) tests** in the repository. UI test cases (e.g. TC-09 Kanban drag, TC-NFR-06 at 375px) were run manually in a browser. The Sprint-1 demo video was recorded with a Playwright script, which is not part of the test suite. |
| D-9 | TC-NFR-07: timed usability test with a first-time admin. | Protocol and pre-test walkthrough are in `2-Test-Planning/TC-NFR-07_Onboarding_Usability_Test.md` (added by the NFR-07 PR, branch `docs/nfr07-usability`). The sessions with first-time users still need to be run and recorded there. |

## 4. To be completed by the module owners

Team members: add any other deviation in your own modules (rent, reminders, receipts, documents, visitors, complaints, deployment, performance) as new rows above before the code freeze.
