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
