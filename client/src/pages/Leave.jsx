import { useEffect, useState } from 'react';
import { AlertTriangle, Palmtree, Stethoscope, Star, ClipboardList } from 'lucide-react';
import api from '../api/client';

export default function Leave() {
  const [balance, setBalance] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ type: 'Casual', fromDate: '', toDate: '', reason: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const [balRes, reqRes] = await Promise.all([api.get('/leave/balance'), api.get('/leave/requests')]);
      setBalance(balRes.data.leaveBalance);
      setRequests(reqRes.data.requests);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load leave data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function applyLeave(e) {
    e.preventDefault();
    setError('');
    if (!form.fromDate || !form.toDate) {
      setError('Please choose both from and to dates.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/leave/requests', form);
      setRequests((prev) => [res.data.request, ...prev]);
      setBalance(res.data.leaveBalance);
      setForm({ type: 'Casual', fromDate: '', toDate: '', reason: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit leave request.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="empty-state">Loading leave data…</div>;
  if (loadError) {
    return (
      <div className="empty-state">
        <div className="es-icon"><AlertTriangle size={30} /></div>
        {loadError}
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={load}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1><Palmtree size={19} /> Leave Management</h1>
          <p>Apply for leave and track your balance</p>
        </div>
      </div>

      <div className="grid g-3" style={{ marginBottom: 16 }}>
        <BalanceCard label="Casual Leave" used={balance.casualUsed} total={balance.casual} color="var(--blue-mid)" bg="var(--blue-pale)" icon={Palmtree} />
        <BalanceCard label="Sick Leave" used={balance.sickUsed} total={balance.sick} color="var(--green)" bg="var(--green-light)" icon={Stethoscope} />
        <BalanceCard label="Earned Leave" used={balance.earnedUsed} total={balance.earned} color="var(--gold)" bg="var(--gold-light)" icon={Star} />
      </div>

      <div className="grid g-2-1">
        <div className="card">
          <div className="card-header"><span className="card-title"><ClipboardList size={15} /> Leave History</span></div>
          <div className="card-body" style={{ padding: 0 }}>
            {requests.length === 0 ? (
              <div className="empty-state">No leave requests yet.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r._id}>
                        <td>{r.type}</td>
                        <td>{new Date(r.fromDate).toLocaleDateString()}</td>
                        <td>{new Date(r.toDate).toLocaleDateString()}</td>
                        <td>{r.days}</td>
                        <td><span className={'chip ' + (r.status === 'Approved' ? 'green' : r.status === 'Rejected' ? 'red' : 'gold')}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">+ Apply Leave</span></div>
          <div className="card-body">
            {error && <div className="form-error">{error}</div>}
            <form onSubmit={applyLeave}>
              <div className="form-group">
                <label className="form-label">Leave Type</label>
                <select className="form-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option>Casual</option>
                  <option>Sick</option>
                  <option>Earned</option>
                  <option>WFH</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">From</label>
                <input type="date" className="form-input" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">To</label>
                <input type="date" className="form-input" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <input type="text" className="form-input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Optional" />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving}>
                {saving ? 'Submitting…' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function BalanceCard({ label, used, total, color, bg, icon: Icon }) {
  const remaining = total - used;
  return (
    <div className="stat-card" style={{ cursor: 'default' }}>
      <div className="stat-icon" style={{ background: bg, color }}><Icon size={19} /></div>
      <div className="stat-info">
        <div className="val">{remaining}</div>
        <div className="lbl">{label} remaining</div>
        <div className="chg up">{used}/{total} used</div>
      </div>
    </div>
  );
}
