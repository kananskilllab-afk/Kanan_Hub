import { useEffect, useState } from 'react';
import { ListChecks, ClipboardList, CheckCircle2, AlertTriangle, Inbox, X } from 'lucide-react';
import api from '../api/client';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/tasks');
      setTasks(res.data.tasks);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load tasks.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addTask(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/tasks', { title: title.trim() });
      setTasks((prev) => [res.data.task, ...prev]);
      setTitle('');
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(id) {
    await api.patch(`/tasks/${id}/toggle`);
    setTasks((prev) => prev.map((t) => (t._id === id ? { ...t, done: !t.done } : t)));
  }

  async function removeTask(id) {
    await api.delete(`/tasks/${id}`);
    setTasks((prev) => prev.filter((t) => t._id !== id));
  }

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1><ListChecks size={19} /> My Tasks</h1>
          <p>Track and manage your day-to-day work</p>
        </div>
      </div>

      <div className="grid g-3" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-mid)' }}><ClipboardList size={19} /></div>
          <div className="stat-info"><div className="val">{tasks.length}</div><div className="lbl">Total Tasks</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--gold-light)', color: 'var(--gold)' }}>⏳</div>
          <div className="stat-info"><div className="val">{pending.length}</div><div className="lbl">Pending</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--green-light)', color: 'var(--green)' }}><CheckCircle2 size={19} /></div>
          <div className="stat-info"><div className="val">{done.length}</div><div className="lbl">Completed</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Task List</span></div>
        <div className="card-body">
          <form className="task-add-row" onSubmit={addTask}>
            <input
              className="form-input"
              placeholder="Add a new task…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button className="btn btn-primary" disabled={saving}>+ Add</button>
          </form>

          <div style={{ marginTop: 16 }}>
            {loading && <div className="empty-state">Loading tasks…</div>}
            {!loading && error && (
              <div className="empty-state">
                <div className="es-icon"><AlertTriangle size={30} /></div>
                {error}
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-primary btn-sm" onClick={load}>Retry</button>
                </div>
              </div>
            )}
            {!loading && !error && tasks.length === 0 && (
              <div className="empty-state">
                <div className="es-icon"><Inbox size={30} /></div>
                No tasks yet — add your first one above.
              </div>
            )}
            {!error && tasks.map((t) => (
              <div className="task-item" key={t._id}>
                <div className={'task-check' + (t.done ? ' done' : '')} onClick={() => toggleTask(t._id)}>
                  {t.done ? '✓' : ''}
                </div>
                <div className={'task-text' + (t.done ? ' done' : '')}>{t.title}</div>
                {t.dueLabel && <div className={'task-due' + (t.dueLabel === 'Overdue' ? ' overdue' : '')}>{t.dueLabel}</div>}
                <button className="task-remove" onClick={() => removeTask(t._id)} title="Delete task"><X size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
