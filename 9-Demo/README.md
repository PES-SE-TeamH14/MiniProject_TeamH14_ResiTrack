# Sprint-1 demo (#16)

**Video:** [Sprint1_Demo.mp4](Sprint1_Demo.mp4) (about 1 minute)

A walkthrough of the working product at the end of Sprint 1 (19–23 Oct 2026), recorded from the `master` branch running locally with the demo data from `npm run seed-demo`.

## What it shows

| Step | Feature | Backlog item |
|---|---|---|
| Opening an admin page while logged out redirects to the login page | Role-based access (pages) | #4 (FR-14) |
| Admin logs in and lands on the Flats page | Login with JWT, role-based redirect | #3 (FR-02), #5 (NFR-03) |
| Admin adds flat D-401 | Flat inventory | #7 (FR-12) |
| Tenants page | Tenant registration | #8 (FR-01) |
| Rent page: 2 of 3 tenants paid this month | Rent payments | #9 (FR-06) |
| Visitors page | Visitor log | #13 (FR-08) |
| Complaints page | Complaints | #14 (FR-13) |
| Logout, then the resident logs in: only Home and Complaints are shown | Role-based navigation | #3, #4 |
| Resident files the complaint "Lift not working" | Complaints | #14 (FR-13) |
| Resident opening an admin page is sent back to Complaints | Role-based access | #4 (FR-14) |

Also delivered in Sprint 1 but not visible in the UI: GitHub Actions CI (#2), sliding 30-minute session (#6, NFR-05) and the admin audit log API (#15, NFR-10).

## Not completed in Sprint 1

Community notices (#10, FR-03) and maintenance requests (#11, FR-04 and #12, FR-05) were not started in Sprint 1 and move to Sprint 2.

## Run the demo yourself

```bash
cd server
npm run seed-demo   # needs MONGODB_URI in server/.env
npm run dev
# in another terminal
cd client
npm run dev
```

Log in at http://localhost:5173/login with `admin@resitrack.local` or `resident@resitrack.local` (password `Demo@12345`, demo data only).

The video was recorded with an automated browser script (Playwright) driving the real app, so every click and request in it is genuine.

---

# Sprint-2 demo, documentation and code freeze (#27, DEL-02)

**Video:** [Sprint2_Demo.mp4](Sprint2_Demo.mp4) (1 min 51 s)

Recorded on 30 Oct 2026 from `master` after PRs #52–#59 were merged, running locally with the `npm run seed-demo` data plus two maintenance requests raised by the demo resident. As with the Sprint-1 video, an automated browser script (Playwright) drove the real app, so every click and request is genuine; the captions name the backlog item shown. It follows the shot list below, in a slightly different order.

## Before recording

Merge the open Sprint-2 pull requests first, so the video shows the final product. Then, from an up-to-date `master`:

```bash
cd server
npm run seed-demo   # demo logins, flats, tenants, payments, visitors, complaints
npm run dev
# in another terminal
cd client
npm run dev
```

Raise two or three maintenance requests as the resident before you start recording, so the board has cards.

## Shot list (about 2 minutes)

| # | Login | What to show | Backlog item |
|---|---|---|---|
| 1 | admin | Flats, then Tenants: register a tenant in a vacant flat | FR-12 #7, FR-01 #8, NFR-07 #26 |
| 2 | admin | Rent page; download a PDF receipt | FR-06 #9, FR-15 #18 |
| 3 | admin | Publish a community notice | FR-03 #10 |
| 4 | admin | Maintenance board: drag a card from Open to In Progress | FR-09 #24 |
| 5 | admin | Documents: upload a lease agreement | FR-11 #21 |
| 6 | resident | Notices page shows the new notice | FR-03 #10 |
| 7 | resident | Maintenance: raise a request and see the "Status: Open" confirmation | FR-04 #11 |
| 8 | maintenance | Maintenance: change that request to Resolved | FR-05 #12 |
| 9 | resident | Within 3 s the request shows Resolved without reloading | FR-05 #12 |
| 10 | resident | Browser narrowed to 375px (DevTools device mode): menus and tables still usable | NFR-06 #25 |
| 11 | owner | Financial summary, if FR-10 is merged | FR-10 #28 |


## Documentation checklist

- [ ] `3-RE/Deviations_from_SRS_SAD_TestPlan.md`: every module owner has added their deviations
- [ ] `2-Test-Planning/TC-NFR-07_Onboarding_Usability_Test.md`: results table filled in
- [ ] README "Getting Started" checked against a fresh clone

## Code freeze

When every Sprint-2 pull request is merged and CI on `master` is green, the team lead tags the final version and creates a GitHub release from it:

```bash
git switch master
git pull
git tag -a v2.0 -m "Sprint-2 final release (code freeze)"
git push origin v2.0
```

After the tag, `master` only takes fixes the whole team agrees on.
