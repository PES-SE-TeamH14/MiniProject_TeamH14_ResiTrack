Deployment, HTTPS and availability (NFR-02 #20, NFR-04 #19)

ResiTrack runs as two services on Render's free tier, with the database on MongoDB Atlas:

| Part | Where | Notes |
|---|---|---|
| React client | Render static site `resitrack-client` | built with `npm run build`, served from `client/dist` |
| Express API | Render web service `resitrack-api` | `server/`, started with `npm start` |
| Database | MongoDB Atlas free cluster (M0) | |

The whole setup is described in `render.yaml` at the repository root, so Render can create both services from it.

1. MongoDB Atlas

1. Create a free M0 cluster.
2. Database Access: add a database user with a long random password.
3. Network Access: add `0.0.0.0/0`. Render's free tier has no fixed outgoing IP address, so Atlas cannot be limited to one address. The database user's password is what protects it, so do not reuse a password.
4. Connect > Drivers: copy the connection string and put the database name before the `?`, for example
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/resitrack?retryWrites=true&w=majority`

2. Deploy on Render

1. Render dashboard: New > Blueprint, choose the GitHub repository `PES-SE-TeamH14/MiniProject_TeamH14_ResiTrack`, branch `master`.
2. Render reads `render.yaml` and asks for the values marked `sync: false`. Deploy once with placeholders if the URLs are not known yet, then fix them (step 3).
3. After the first deploy, note the two URLs, then set:

| Service | Variable | Value |
|---|---|---|
| resitrack-api | `MONGODB_URI` | the Atlas connection string |
| resitrack-api | `CLIENT_ORIGIN` | the client URL, no trailing slash, e.g. `https://resitrack-client.onrender.com` |
| resitrack-client | `VITE_API_URL` | the API URL plus `/api`, e.g. `https://resitrack-api.onrender.com/api` |

`VITE_API_URL` is read when the client is built, so trigger a manual deploy of the client after changing it.

4. Open `https://<api-url>/api/health`. It should show `"status":"ok"` and `"database":"connected"`.
5. Create the first administrator. Render's free tier has no shell, so run this from your own computer, pointing at Atlas:

```
cd server
cp .env.example .env        # Windows: copy .env.example .env
# put the Atlas MONGODB_URI and ADMIN_* values in .env
npm ci
npm run create-admin
```

Optional demo data: `npm run seed-demo` in the same way.

Settings that matter for HTTPS (already set in `render.yaml`): `FORCE_HTTPS=true` and `TRUST_PROXY=1`.

3. HTTPS only (NFR-04)

- Render issues and renews the certificate and only offers TLS 1.2 and 1.3. HTTP requests that reach the API are handled by `server/src/middleware/enforceHttps.js`: GET and HEAD are redirected to HTTPS (308), other methods get `426 HTTPS_REQUIRED`. `GET /api/health` stays open over HTTP because platform health checks use it and it returns no user data.
- Every response from the API carries `Strict-Transport-Security: max-age=31536000; includeSubDomains`, so browsers stay on HTTPS after the first visit.
- `server/src/server.js` can also serve HTTPS itself when `TLS_KEY_PATH` and `TLS_CERT_PATH` are set. It accepts TLS 1.2 and newer only.

How to verify (TC-NFR-04):

1. Scan the API host at https://www.ssllabs.com/ssltest/ and keep a screenshot of the result. Target: grade A, no TLS 1.0 or 1.1.
2. Run the quick check from `server/`:
   `npm run check-tls -- resitrack-api.onrender.com`
   TLS 1.0 and 1.1 must show `refused`, TLS 1.2 must show `accepted`.
3. Plain HTTP:
   `curl -i http://resitrack-api.onrender.com/api/tenants` should return a 301 or 308 redirect to `https://...`.
   `curl -i -X POST http://resitrack-api.onrender.com/api/auth/login` should be a redirect or an error, never a login response.
4. Automated: `server/tests/https.test.js` runs with `npm test` and in CI.

Testing HTTPS locally

```
cd server
mkdir certs
openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=localhost" \
  -keyout certs/key.pem -out certs/cert.pem
TLS_KEY_PATH=certs/key.pem TLS_CERT_PATH=certs/cert.pem PORT=5443 npm start
# in a second terminal
npm run check-tls -- localhost 5443
curl -k https://localhost:5443/api/health
```

On Windows PowerShell set the variables with `$env:TLS_KEY_PATH="certs/key.pem"` and so on before `npm start`. The `certs/` folder is ignored by Git. Never commit a private key.

4. Availability monitoring (NFR-02)

Target: at least 99.5 % availability over the monitored period (the requirement is 99.5 % during 8 AM to 10 PM).

External monitor (official evidence), UptimeRobot free plan:

1. Add a monitor, type "Keyword".
2. URL: `https://<api-url>/api/health`. Keyword: `connected`, alert when the keyword does not exist. Interval: 5 minutes.
3. Add a second HTTP(s) monitor for the client URL.
4. Add an alert contact (e-mail) for every team member.
5. Optional: a public status page showing the uptime percentage.

Why 5 minute pings matter: Render's free web services stop after about 15 minutes without traffic and need roughly 30 to 60 seconds to start again. Those cold starts would count as downtime. The monitor's 5 minute requests keep the API awake. One always-on free service fits inside Render's monthly free instance hours; if the free hours run out the service is suspended until the next month, which would show up as downtime.

Second check inside the repository: `.github/workflows/uptime.yml` calls the API and the client every 15 minutes and checks that plain HTTP is not served. It needs two repository variables, `API_URL` and `CLIENT_URL` (Settings > Secrets and variables > Actions > Variables). GitHub can delay scheduled runs, so this is a safety net and not the uptime number.

How to report the result (TC-NFR-02):

- Take a screenshot of the UptimeRobot dashboard showing the uptime percentage and the monitoring period, and the response-time graph.
- The requirement says 30 days. If the project ends sooner, state the period actually monitored next to the percentage. UptimeRobot counts all 24 hours, which is stricter than the 8 AM to 10 PM requirement, so a figure of 99.5 % or more over 24 hours also satisfies it.
- Uptime % = (monitored minutes − minutes down) / monitored minutes × 100. 99.5 % over 30 days allows at most about 3 hours 36 minutes of downtime.

Known limits of the free tier

- Cold start after a redeploy or restart takes up to a minute.
- Render's free web services have no persistent disk. This is fine here because uploaded documents are held in memory by multer and nothing is written to disk.
- Atlas M0 has 512 MB of storage and shared CPU.
- `WEB_CONCURRENCY` stays at 1 because the free instance has a fraction of one CPU core. Set it to the number of cores on a larger plan (see `7-Testing-Tools/load-test/README.md`).

Updating a deployment

Pushing to `master` redeploys both services automatically (`autoDeployTrigger: commit`). Merge pull requests only after the CI run is green.
