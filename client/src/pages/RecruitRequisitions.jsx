import { useEffect, useState } from 'react';
import { AlertTriangle, ClipboardList } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { isModuleAdmin } from '../utils/roles';

const EMPTY_FORM = { department: '', designation: '', branch: '', openings: 1, salaryRange: '', employmentType: 'Full-time' };

export default function RecruitRequisitions() {
  const { user } = useAuth();
  const canManage = isModuleAdmin(user, 'recruit');
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    api.get('/recruit/requisitions')
      .then((res) => setRequisitions(res.data.requisitions))
      .catch((err) => setError(err.response?.data?.message || 'Could not load job requisitions.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function create(e) {
    e.preventDefault();
    setSaveError('');
    setSaving(true);
    try {
      await api.post('/recruit/requisitions', form);
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Could not create requisition.');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id, status) {
    await api.patch(`/recruit/requisitions/${id}`, { status });
    load();
  }

  if (loading) return <div className="empty-state">Loading job requisitions…</div>;
  if (error) {
    return (
      <div className="empty-state">
        <div className="es-icon"><AlertTriangle size={30} /></div>
        {error}
        <div style={{ marginTop: 12 }}><button className="btn btn-primary btn-sm" onClick={load}>Retry</button></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1><ClipboardList size={19} /> Job Requisitions</h1>
          <p>Hiring requirements — Job ID, department, designation, and status.</p>
        </div>
        {canManage && (
          <div className="page-header-right">
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ New Requisition</button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">New Job Requisition</span></div>
          <div className="card-body">
            {saveError && <div className="form-error">{saveError}</div>}
            <form onSubmit={create}>
              <div className="grid g-2">
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input className="form-input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Designation</label>
                  <input className="form-input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} required />
                </div>
              </div>
              <div className="grid g-3">
                <div className="form-group">
                  <label className="form-label">Branch</label>
                  <input className="form-input" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Openings</label>
                  <input type="number" min="1" className="form-input" value={form.openings} onChange={(e) => setForm({ ...form, openings: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Employment Type</label>
                  <select className="form-input" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                    <option>Full-time</option><option>Part-time</option><option>Contract</option><option>Intern</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Salary Range</label>
                <input className="form-input" placeholder="Internal / confidential" value={form.salaryRange} onChange={(e) => setForm({ ...form, salaryRange: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Requisition'}</button>
                <button className="btn btn-outline" type="button" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Job ID</th><th>Department</th><th>Designation</th><th>Branch</th>
                  <th>Openings</th><th>Type</th><th>Recruiter</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.map((r) => (
                  <tr key={r._id}>
                    <td>{r.jobId}</td>
                    <td>{r.department}</td>
                    <td>{r.designation}</td>
                    <td>{r.branch || '—'}</td>
                    <td>{r.openings}</td>
                    <td>{r.employmentType}</td>
                    <td>{r.assignedRecruiter?.name || '—'}</td>
                    <td>
                      {canManage ? (
                        <select className="form-input" style={{ width: 110 }} value={r.status} onChange={(e) => setStatus(r._id, e.target.value)}>
                          <option>Open</option><option>Hold</option><option>Closed</option>
                        </select>
                      ) : (
                        <span className={`chip ${r.status === 'Open' ? 'green' : r.status === 'Closed' ? 'red' : 'gold'}`}>{r.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {requisitions.length === 0 && (
                  <tr><td colSpan={8}><div className="empty-state">No job requisitions yet.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
