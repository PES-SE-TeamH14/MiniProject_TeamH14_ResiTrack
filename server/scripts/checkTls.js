// NFR-04 / TC-NFR-04 (#19): checks which TLS versions a server accepts, and what plain HTTP does.
//
//   npm run check-tls -- <host> [port]            e.g. npm run check-tls -- resitrack-api.onrender.com
//   npm run check-tls -- localhost 5443           (local server started with TLS_KEY_PATH / TLS_CERT_PATH)
//
// Expected: TLS 1.0 and 1.1 refused, TLS 1.2 and 1.3 accepted, and (when a plain HTTP port is given as
// the third argument) HTTP requests redirected to https or rejected. For the public A-grade scan use
// https://www.ssllabs.com/ssltest/ as well; this script is the quick local check.
const tls = require('tls');
const http = require('http');

const [host, portArg, httpPortArg] = process.argv.slice(2);
if (!host) {
  console.error('Usage: npm run check-tls -- <host> [https-port] [http-port]');
  process.exit(2);
}
const port = Number(portArg) || 443;

function tryVersion(version) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        minVersion: version,
        maxVersion: version,
        // Lets this client attempt the old protocols at all; the point is to see the SERVER refuse them.
        ciphers: 'ALL:@SECLEVEL=0',
        // The protocol test does not need a trusted certificate (local certs are self-signed).
        rejectUnauthorized: false,
      },
      () => {
        const negotiated = socket.getProtocol();
        socket.end();
        resolve({ version, accepted: true, negotiated });
      },
    );
    socket.setTimeout(8000, () => {
      socket.destroy();
      resolve({ version, accepted: false, note: 'timeout' });
    });
    socket.on('error', (err) => resolve({ version, accepted: false, note: err.code || err.message }));
  });
}

function checkPlainHttp(httpPort) {
  return new Promise((resolve) => {
    const req = http.request({ host, port: httpPort, path: '/api/tenants', method: 'GET', timeout: 8000 }, (res) => {
      res.resume();
      resolve({ status: res.statusCode, location: res.headers.location });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (err) => resolve({ error: err.code || err.message }));
    req.end();
  });
}

(async () => {
  let failed = false;
  console.log(`TLS check for ${host}:${port}`);

  for (const version of ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3']) {
    const result = await tryVersion(version);
    const mustBeRefused = version === 'TLSv1' || version === 'TLSv1.1';
    // TLS 1.0/1.1 must be refused, TLS 1.2 must work; a server may legitimately not offer TLS 1.3.
    const okFinal = mustBeRefused ? !result.accepted : version === 'TLSv1.3' || result.accepted;
    if (!okFinal) failed = true;
    const verdict = result.accepted ? `accepted (${result.negotiated})` : `refused (${result.note})`;
    console.log(`  ${version.padEnd(8)} ${verdict.padEnd(40)} ${okFinal ? 'OK' : 'FAIL'}`);
  }

  if (httpPortArg) {
    const result = await checkPlainHttp(Number(httpPortArg));
    const redirected = [301, 302, 307, 308].includes(result.status) && /^https:/i.test(result.location || '');
    const rejected = [400, 403, 426].includes(result.status) || Boolean(result.error);
    const ok = redirected || rejected;
    if (!ok) failed = true;
    const text = `plain HTTP on port ${httpPortArg}: ${result.error || `${result.status} ${result.location || ''}`}`;
    console.log(`  ${text.padEnd(58)} ${ok ? 'OK' : 'FAIL (plain HTTP is being served)'}`);
  }

  console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS');
  process.exit(failed ? 1 : 0);
})();
