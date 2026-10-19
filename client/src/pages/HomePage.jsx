import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api/client.js';

export default function HomePage() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/health')
      .then((res) => setHealth(res.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  return (
    <section>
      <h1>Welcome to ResiTrack</h1>
      <p>
        One place for tenant registration, rent tracking, maintenance requests, complaints,
        visitor logs and notices.
      </p>

      <h2>System status</h2>
      {error && <p className="status status-bad">API unreachable: {error}</p>}
      {!error && !health && <p className="status">Checking…</p>}
      {health && (
        <ul className="status-list">
          <li>
            API: <strong className="status-good">{health.status}</strong>
          </li>
          <li>
            Database:{' '}
            <strong className={health.database === 'connected' ? 'status-good' : 'status-bad'}>
              {health.database}
            </strong>
          </li>
        </ul>
      )}
    </section>
  );
}
