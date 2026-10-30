# NFR-09 — MVC Architecture Review and Unit Test Coverage

**Requirement:** NFR-09 — MVC codebase with ≥ 60% unit test coverage ([#29](https://github.com/PES-SE-TeamH14/MiniProject_TeamH14_ResiTrack/issues/29))
**Test case:** TC-NFR-09
**Sprint:** Sprint-2

## 1. Acceptance criteria and evidence

| Criterion | Status | Evidence |
|---|---|---|
| Jest + Supertest tests for controllers and routes | Met | `server/tests/*.test.js` — every route module has an API test file that calls it through Supertest |
| Coverage report ≥ 60%, run in CI | Met | `coverageThreshold` (60% for statements, branches, functions, lines) in `server/package.json`; CI fails below it, posts the numbers to the run summary and uploads the `server-coverage` report |
| Architecture review confirms MVC layering | Met | Review below, enforced on every PR by `server/tests/architecture.test.js` |

## 2. Coverage

Coverage is measured over **every file in `server/src/`** (`collectCoverageFrom: ["src/**/*.js"]`), not only the files the tests happen to load, so untested files count against the total.

| Metric | Coverage | Threshold |
|---|---|---|
| Statements | ~92% | 60% |
| Branches | ~83% | 60% |
| Functions | ~91% | 60% |
| Lines | ~93% | 60% |

Figures from a local run on 30 Oct 2026; the CI run summary on each PR shows the exact current numbers.

The main uncovered file is `src/server.js` (process start-up: clustering, HTTPS server creation). It only runs when the API is launched and is exercised by the deployment and load-test workflows rather than unit tests.

Run locally:

```bash
cd server
npm test            # runs all tests and prints the coverage table; fails if any metric < 60%
# HTML report: server/coverage/lcov-report/index.html
```

## 3. MVC layering review

| Layer | Folder | Responsibility | May depend on | Must not depend on |
|---|---|---|---|---|
| Model | `models/` | Mongoose schemas, validation, indexes | `mongoose`, `bcryptjs` | controllers, routes, services, middleware, Express |
| Controller | `controllers/` | Handle one request: validate input, query models, build the response | models, services, utils | routes, other controllers, Express |
| Routes (view boundary of the REST API) | `routes/` | Map URL + method to a controller; declare allowed roles | controllers, middleware, utils | models, services |
| Middleware | `middleware/` | Cross-cutting checks: auth/RBAC, HTTPS, upload limits, errors | models, utils | controllers, routes |
| Services | `services/` | Background and reusable jobs: reminders, receipts, notifications | models, utils | controllers, routes |
| Utils / config | `utils/`, `config/` | Small helpers, DB connection | models (audit logger) | controllers, routes |

The React client (`client/`) is the presentation layer and talks to the API only through `client/src/api/client.js`.

### Findings

- **No layering violations.** No route queries a model directly; no controller imports another controller or a route; models import nothing but Mongoose and bcrypt.
- **One controller per route module.** Every `xRoutes.js` has a matching `xController.js`, and every route module is mounted in `routes/index.js`.
- **Deny by default.** `routes/index.js` puts `protect` in front of every non-public router, and each router declares its roles with `authorize(...)` (FR-14).
- **Shared logic is out of controllers.** PDF receipts and rent reminders live in `services/`; audit logging and error shapes live in `utils/`.

### Keeping it that way

`server/tests/architecture.test.js` reads the `require()` calls in every source file and fails if a file depends on a layer it should not, if a route module has no matching controller, or if a route module is not mounted. Because it runs with the rest of the suite, a layering break fails CI on the pull request.
