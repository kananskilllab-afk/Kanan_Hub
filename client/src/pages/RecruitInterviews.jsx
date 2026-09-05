import { useEffect, useState } from 'react';
import { AlertTriangle, Mic, X } from 'lucide-react';
import api from '../api/client';

const EMPTY_FORM = {
  requisition: '', candidateName: '', mobile: '', email: '', position: '',
  interviewType: 'Online', round: 'HR', scheduledAt: ''
};

const EMPTY_FEEDBACK = {
  communication: 3, technicalKnowledge: 3, confidence: 3, experienceMatch: 3, culturalFit: 3,
  recommendation: 'Hire', remarks: ''
};

export default function RecruitInterviews() {
  const [interviews, setInterviews] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedbackFor, setFeedbackFor] = useState(null);
  const [feedback, setFeedback] = useState(EMPTY_FEEDBACK);

  function load() {
    setLoading(true);
    setError('');
    Promise.all([api.get('/recruit/interviews'), api.get('/recruit/requisitions')])
      .then(([iv, req]) => {
        setInterviews(iv.data.interviews);
        setRequisitions(req.data.requisitions.filter((r) => r.status === 'Open'));
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load interviews.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function schedule(e) {
    e.preventDefault();
    setSaveError('');
    setSaving(true);
    try {
      await api.post('/recruit/interviews', { ...form, requisition: form.requisition || null });
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Could not schedule interview.');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id, status) {
    await api.patch(`/recruit/interviews/${id}`, { status });
    load();
  }

  function openFeedback(iv) {
    setFeedbackFor(iv);
    setFeedback(iv.feedback?.recommendation ? {
      communication: iv.feedback.communication || 3, technicalKnowledge: iv.feedback.technicalKnowledge || 3,
      confidence: iv.feedback.confidence || 3, experienceMatch: iv.feedback.experienceMatch || 3,
      culturalFit: iv.feedback.culturalFit || 3, recommendation: iv.feedback.recommendation, remarks: iv.feedback.remarks || ''
    } : EMPTY_FEEDBACK);
  }

  async function submitFeedback(e) {
    e.preventDefault();
    await api.post(`/recruit/interviews/${feedbackFor._id}/feedback`, feedback);
    setFeedbackFor(null);
    load();
  }

  if (loading) return <div className="empty-state">Loading interviews…</div>;
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
          <h1><Mic size={19} /> Interviews</h1>
          <p>Schedule interviews and submit feedback after each round.</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Schedule Interview</button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">Schedule Interview</span></div>
          <div className="card-body">
            {saveError && <div className="form-error">{saveError}</div>}
            <form onSubmit={schedule}>
              <div className="grid g-2">
                <div className="form-group">
                  <label className="form-label">Candidate Name</label>
                  <input className="form-input" value={form.candidateName} onChange={(e) => setForm({ ...form, candidateName: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Position</label>
                  <input className="form-input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
                </div>
              </div>
              <div className="grid g-2">
                <div className="form-group">
                  <label className="form-label">Mobile</label>
                  <input className="form-input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="grid g-3">
                <div className="form-group">
                  <label className="form-label">Job Requisition</label>
                  <select className="form-input" value={form.requisition} onChange={(e) => setForm({ ...form, requisition: e.target.value })}>
                    <option value="">— None —</option>
                    {requisitions.map((r) => <option key={r._id} value={r._id}>{r.jobId} · {r.designation}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-input" value={form.interviewType} onChange={(e) => setForm({ ...form, interviewType: e.target.value })}>
                    <option>Online</option><option>Offline</option><option>Phone</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Round</label>
                  <select className="form-input" value={form.round} onChange={(e) => setForm({ ...form, round: e.target.value })}>
                    <option>HR</option><option>Technical</option><option>Manager</option><option>Final</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Date & Time</label>
                <input type="datetime-local" className="form-input" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} required />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" disabled={saving}>{saving ? 'Scheduling…' : 'Schedule'}</button>
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
                <tr><th>Candidate</th><th>Position</th><th>Round</th><th>Date & Time</th><th>Interviewer</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {interviews.map((iv) => (
                  <tr key={iv._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{iv.candidateName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{iv.mobile}</div>
                    </td>
                    <td>{iv.position || '—'}</td>
                    <td>{iv.round}</td>
                    <td>{new Date(iv.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td>{iv.interviewer?.name || '—'}</td>
                    <td>
                      <select className="form-input" style={{ width: 110 }} value={iv.status} onChange={(e) => setStatus(iv._id, e.target.value)}>
                        <option>Scheduled</option><option>Completed</option><option>No Show</option><option>Rescheduled</option>
                      </select>
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => openFeedback(iv)}>
                        {iv.feedback?.recommendation ? 'Edit Feedback' : 'Add Feedback'}
                      </button>
                    </td>
                  </tr>
                ))}
                {interviews.length === 0 && (
                  <tr><td colSpan={7}><div className="empty-state">No interviews scheduled yet.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {feedbackFor && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,27,61,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setFeedbackFor(null)}
        >
          <div className="card" style={{ width: 440, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <span className="card-title">Feedback — {feedbackFor.candidateName}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setFeedbackFor(null)}><X size={14} /></button>
            </div>
            <div className="card-body">
              <form onSubmit={submitFeedback}>
                {['communication', 'technicalKnowledge', 'confidence', 'experienceMatch', 'culturalFit'].map((key) => (
                  <div className="form-group" key={key}>
                    <label className="form-label" style={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</label>
                    <input
                      type="range" min="1" max="5" value={feedback[key]}
                      onChange={(e) => setFeedback({ ...feedback, [key]: Number(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{'⭐'.repeat(feedback[key])}</div>
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label">Recommendation</label>
                  <select className="form-input" value={feedback.recommendation} onChange={(e) => setFeedback({ ...feedback, recommendation: e.target.value })}>
                    <option>Strong Hire</option><option>Hire</option><option>Hold</option><option>Reject</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Remarks</label>
                  <textarea className="form-input" rows={3} value={feedback.remarks} onChange={(e) => setFeedback({ ...feedback, remarks: e.target.value })} />
                </div>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Save Feedback</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
