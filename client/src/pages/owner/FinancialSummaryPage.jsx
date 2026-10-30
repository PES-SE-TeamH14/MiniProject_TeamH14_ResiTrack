import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../../api/client.js';

// Local month as YYYY-MM (toISOString would give the UTC month)
function thisMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const monthLabel = (month, style = 'long') =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: style, year: 'numeric' });

function Stat({ label, value, hint }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

function Meter({ label, percent }) {
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <strong>{percent}%</strong>
      </div>
      <div className="meter-track" role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="meter-fill" style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

function Trend({ trend }) {
  const max = Math.max(...trend.map((t) => t.collected), 1);
  return (
    <div className="trend" aria-label="Rent collected, last 6 months">
      {trend.map((t) => (
        <div key={t.month} className="trend-col" title={`${monthLabel(t.month)}: ${rupees(t.collected)}`}>
          <span className="trend-value">{t.collected ? rupees(t.collected) : '—'}</span>
          <div className="trend-bar-wrap">
            <div className="trend-bar" style={{ height: `${(t.collected / max) * 100}%` }} />
          </div>
          <span className="trend-label">{monthLabel(t.month, 'short')}</span>
        </div>
      ))}
    </div>
  );
}

// Owner (read-only): rent collected, dues and occupancy for a month (FR-10, UC-10)
export default function FinancialSummaryPage() {
  const [month, setMonth] = useState(thisMonth());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!month) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .get('/reports/financial-summary', { params: { month } })
      .then((res) => !cancelled && setSummary(res.data))
      .catch((err) => !cancelled && setError(getErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [month]);

  const rent = summary?.rent;
  const occupancy = summary?.occupancy;

  return (
    <section>
      <h1>Financial summary</h1>
      <p className="muted">Read-only overview of rent and occupancy for the complex.</p>

      <div className="toolbar">
        <label>
          Month <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>

      {error && <p className="alert alert-error">{error}</p>}

      {loading && !summary ? (
        <p>Loading…</p>
      ) : (
        summary && (
          <div className={loading ? 'is-loading' : undefined}>
            <h2 className="section-title">Rent · {monthLabel(summary.month)}</h2>
            <div className="stats">
              <Stat label="Expected" value={rupees(rent.expected)} hint={`${rent.billableTenants} tenants billed`} />
              <Stat label="Collected" value={rupees(rent.collected)} hint={`${rent.payments} payments`} />
              <Stat label="Dues" value={rupees(rent.dues)} hint={`${rent.unpaidTenants} unpaid`} />
              <Stat label="Paid tenants" value={`${rent.paidTenants} / ${rent.billableTenants}`} />
            </div>
            <Meter label="Collection rate (tenants paid)" percent={rent.collectionRate} />

            <h2 className="section-title">Occupancy</h2>
            <div className="stats">
              <Stat label="Active flats" value={occupancy.totalFlats} />
              <Stat label="Occupied" value={occupancy.occupiedFlats} />
              <Stat label="Vacant" value={occupancy.vacantFlats} />
            </div>
            <Meter label="Occupancy rate" percent={occupancy.occupancyRate} />

            <h2 className="section-title">Rent collected · last 6 months</h2>
            <div className="card">
              <Trend trend={summary.trend} />
            </div>
          </div>
        )
      )}
    </section>
  );
}
