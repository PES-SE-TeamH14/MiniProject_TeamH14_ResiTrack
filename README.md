# ResiTrack

Apartment / Residencies Organizer — a web-based platform that centralizes tenant registration, rent tracking, maintenance requests, complaints, visitor management and notices for a residential apartment complex.

## Description

Apartment complexes usually manage tenants, rent, maintenance, complaints, visitor logs and notices through phone calls, paper registers and separate spreadsheets, which causes communication gaps and poor visibility. ResiTrack brings these operations into one browser-based system with role-specific dashboards for four users:

- **Administrator** — registers tenants, manages flats, records rent, posts notices, oversees maintenance on a Kanban board, uploads documents.
- **Resident (Tenant)** — logs in, raises maintenance requests, files complaints, logs visitors, reads notices, downloads rent receipts.
- **Maintenance Staff** — views assigned requests and updates their status.
- **Owner** — read-only financial and occupancy summaries.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, React Router, Axios |
| Backend | Node.js, Express.js (MVC) |
| Database | MongoDB (Atlas), Mongoose |
| Auth | JWT, bcrypt |
| Scheduling | node-cron (rent reminders) |
| PDF generation | pdfkit / puppeteer (rent receipts) |
| Testing | Jest/Mocha, Supertest, Cypress/Playwright |

## Getting Started

### Dependencies

- Node.js (LTS) and npm
- A MongoDB Atlas cluster (free tier) or a local MongoDB instance
- A modern browser (desktop or mobile)

### Installing and running

The app has two parts, each with its own `package.json`: `server/` (Express API) and `client/` (React app). Run them in two terminals.

**1. API server**

```bash
cd server
cp .env.example .env      # Windows: copy .env.example .env
# edit .env and set MONGODB_URI to your local MongoDB or Atlas connection string
npm install
npm run dev               # http://localhost:5000/api/health
```

**2. React client**

```bash
cd client
npm install
npm run dev               # http://localhost:5173
```

The home page shows whether the API and the database are reachable.

### Useful scripts

| Folder | Command | What it does |
|---|---|---|
| `server` | `npm run dev` | Start the API with auto-reload |
| `server` | `npm test` | Run unit/API tests with coverage (Jest + Supertest); fails below 60% (NFR-09) |
| `server` | `npm run lint` | Check code style (ESLint) |
| `client` | `npm run dev` | Start the React app |
| `client` | `npm run build` | Production build into `client/dist` |
| `client` | `npm run lint` | Check code style (ESLint) |

GitHub Actions runs lint, tests and build for both folders on every pull request.

### Code layout (MVC)

```
server/src/
  app.js            Express app: security headers, CORS, JSON parsing, routes, error handling
  server.js         Connects to MongoDB and starts the server
  config/           Database connection
  models/           Mongoose schemas (one per collection)
  controllers/      Request handlers (business logic per module)
  routes/           URL → controller mapping, all under /api
  middleware/       Auth/RBAC (added in #3/#4), 404 and central error handler
  utils/            ApiError, asyncHandler
client/src/
  api/client.js     Shared Axios instance
  components/       Layout and shared UI
  pages/            One component per screen
```

All API errors use one JSON shape: `{ "error": { "code", "message", "field?" } }`.

## Deployment

The API and the client are deployed on Render's free tier with MongoDB Atlas; `render.yaml` describes both services. All traffic is HTTPS (TLS 1.2+); plain HTTP is redirected or rejected. Availability is watched by an external uptime monitor. Steps, environment variables and how to verify NFR-02 and NFR-04 are in [8-Deployment/DEPLOYMENT.md](8-Deployment/DEPLOYMENT.md).

## Repository Structure

| Folder | Contents |
|---|---|
| `1-SRS-WBS` | Software Requirements Specification (IEEE 830) and Work Breakdown Structure |
| `2-Test-Planning` | Test Plan (IEEE 829) with 25 test cases |
| `3-RE` | Functional / non-functional requirements, RTM, requirements process and change management |
| `4-Architecture` | Architecture & Design Specification (component, sequence, API design) and use case diagram |
| `5-Project-Screenshots` | GitHub Project creation, backlog and sprint screenshots |
| `6-Copilot` | AI-assisted (Copilot) code screenshots and links |
| `7-Testing-Tools` | Testing tools used and test results |
| `8-Deployment` | Deployment steps, infrastructure and environment setup |
| `9-Demo` | Sprint demo videos |

## Project Board

Backlog and sprint planning: https://github.com/orgs/PES-SE-TeamH14/projects/1

- Sprint 1: 19 Oct – 23 Oct 2026
- Sprint 2: 26 Oct – 30 Oct 2026

## Team H14

| Name | SRN |
|---|---|
| Shreesh Athreya | PES1UG24CS441 |
| Shree Krishna | PES1UG24CS440 |
| Swaroop Venkateshwar | PES1UG24CS923 |
| Sushanth S Rao | PES1UG24CS485 |

## Version History

- 0.2 — Backlog, sprint plan, WBS, updated SRS diagram and Test Plan (13 Oct 2026)
- 0.1 — SRS, Test Plan and Architecture & Design Specification (28 Sept 2026)

## Acknowledgments

Software Engineering course, PES University.
