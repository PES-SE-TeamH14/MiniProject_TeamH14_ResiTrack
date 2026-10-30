import { useCallback, useEffect, useRef, useState } from 'react';
import api, { getErrorMessage } from '../../api/client.js';

// FR-09 (#24): Kanban board of maintenance requests. Cards are dragged between
// columns (or moved with the "Move to" menu on touch screens and keyboards),
// and each move is saved with PATCH /api/maintenance-requests/:id (FR-05).
const COLUMNS = ['Open', 'In Progress', 'Resolved'];
const REFRESH_MS = 5000;

function priorityClass(priority) {
  if (priority === 'Urgent' || priority === 'High') return 'badge badge-red';
  if (priority === 'Medium') return 'badge badge-blue';
  return 'badge badge-grey';
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN');
}

export default function MaintenanceBoardPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dragOver, setDragOver] = useState(null);
  const [savingId, setSavingId] = useState(null);
  // Skip background refreshes while a card is being dragged or saved, so it does not jump back
  const busy = useRef(false);

  const loadRequests = useCallback(async (showLoading = false) => {
    if (busy.current) return;
    if (showLoading) setLoading(true);
    try {
      const response = await api.get('/maintenance-requests');
      setRequests(response.data.requests || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests(true);
    const timer = window.setInterval(() => loadRequests(false), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadRequests]);

  async function moveRequest(id, status) {
    const request = requests.find((item) => item._id === id);
    if (!request || request.status === status) return;

    setError('');
    setMessage('');
    setSavingId(id);
    busy.current = true;
    // Move the card straight away; put it back if the server refuses
    setRequests((current) => current.map((item) => (item._id === id ? { ...item, status } : item)));
    try {
      await api.patch(`/maintenance-requests/${id}`, { status });
      setMessage(`${request.category} request moved to ${status}.`);
    } catch (err) {
      setRequests((current) => current.map((item) => (item._id === id ? { ...item, status: request.status } : item)));
      setError(getErrorMessage(err));
    } finally {
      setSavingId(null);
      busy.current = false;
    }
  }

  function handleDragStart(event, id) {
    busy.current = true;
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    if (!savingId) busy.current = false;
    setDragOver(null);
  }

  function handleDrop(event, status) {
    event.preventDefault();
    setDragOver(null);
    const id = event.dataTransfer.getData('text/plain');
    if (id) moveRequest(id, status);
    else busy.current = false;
  }

  return (
    <section>
      <h1>Maintenance Board</h1>
      <p className="muted">Drag a card to another column to change its status.</p>

      {message && <p className="alert alert-success" role="status">{message}</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {loading ? <p>Loading maintenance requests...</p> : (
        <div className="kanban">
          {COLUMNS.map((column) => {
            const cards = requests.filter((request) => request.status === column);
            return (
              <div
                key={column}
                className={dragOver === column ? 'kanban-column drag-over' : 'kanban-column'}
                data-status={column}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  if (dragOver !== column) setDragOver(column);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setDragOver(null);
                }}
                onDrop={(event) => handleDrop(event, column)}
              >
                <h2 className="kanban-title">
                  {column} <span className="badge badge-outline">{cards.length}</span>
                </h2>
                {cards.length === 0 && <p className="muted kanban-empty">No requests</p>}
                {cards.map((request) => (
                  <article
                    key={request._id}
                    className={savingId === request._id ? 'kanban-card saving' : 'kanban-card'}
                    draggable={savingId !== request._id}
                    onDragStart={(event) => handleDragStart(event, request._id)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="kanban-card-head">
                      <strong>{request.category}</strong>
                      <span className={priorityClass(request.priority)}>{request.priority}</span>
                    </div>
                    <p className="kanban-desc">{request.description}</p>
                    <p className="muted kanban-meta">
                      {request.resident?.name || 'Resident'} · {formatDate(request.createdAt)}
                    </p>
                    <label className="kanban-move">
                      Move to
                      <select
                        value={request.status}
                        disabled={savingId === request._id}
                        onChange={(event) => moveRequest(request._id, event.target.value)}
                      >
                        {COLUMNS.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </label>
                  </article>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
