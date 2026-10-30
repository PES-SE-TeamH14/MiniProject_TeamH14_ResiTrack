# TC-NFR-07: New admin onboarding usability test

**Requirement:** NFR-07, a new admin completes onboarding and adds a tenant in ≤ 10 minutes, unaided.
**Use cases:** UC-01 (register tenant), UC-02 (login). **Issue:** #26. **Priority:** Medium.

## 1. Pre-test review (30 Oct 2026)

Before running sessions with people, the team walked the onboarding path on an empty database to find blockers.

| Step | Screen | Result |
|---|---|---|
| Create the first admin | README → `npm run create-admin` | **Blocker found:** the README setup steps never said how to create the first admin, so a new admin had no login. **Fixed:** the README now has a "First administrator" step and a "First steps for a new admin" guide. |
| Log in | `/login` | OK. The admin lands on **Flats**, which is the first thing they need. |
| Open Tenants with no flats | `/admin/tenants` | OK. The page says "No vacant flats available" and links to Flats. |
| Add a flat | `/admin/flats` | OK. "Flat A-101 added." is shown and the flat is listed as Vacant. |
| Register a tenant | `/admin/tenants` | OK. "Ravi Kumar registered in flat A-101." is shown and the tenant is listed. |

A scripted run of login → add flat → register tenant took 51 seconds. That shows the flow has no dead ends, but it is **not** the NFR-07 measurement, which needs first-time human users (section 2).

Noted but not a blocker: if an account is deleted while someone is logged in, pages show "Your login is not valid. Please log in again." without returning to the login page.

## 2. Timed test protocol

**Participants:** at least 2 people who have never used ResiTrack and are not on the team.
**Setup:** an empty database containing only an admin account created with `npm run create-admin`. Give the participant the login URL, the admin email and password, and the README section "First steps for a new admin".
**Task card given to the participant:**

> You are the new administrator. Log in, add flat B-201 (Block B, floor 2, 2BHK, ₹19,000/month), and register a tenant called Priya Shah in that flat with a one-year lease starting on the 1st of next month.

**Rules:** start the timer when the login page is shown and stop it when the "registered in flat" message appears. The observer does not help. If the participant is stuck for more than 2 minutes, note it as a blocker and then help.
**Pass:** every participant finishes unaided in ≤ 10 minutes.

## 3. Results

| # | Participant (initials) | Date | Time (mm:ss) | Unaided? | Where they hesitated / comments |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |

**Outcome:** _to be filled in after the sessions_ (Pass / Fail). Raise any blocker found as an issue and link it here.
