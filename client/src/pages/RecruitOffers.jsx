import { useEffect, useState } from 'react';
import { AlertTriangle, Mail } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { isModuleAdmin } from '../utils/roles';

const EMPTY_FORM = {
  requisition: '', candidateName: '', email: '', mobile: '', department: '', designation: '',
  branch: '', joiningDate: '', ctc: '', offerExpiryDate: ''
};

const STATUS_CHIP = { Draft: 'gray', Sent: 'gold', Accepted: 'green', Rejected: 'red', Expired: 'red' };
const HIRE_RECOMMENDATIONS = ['Hire', 'Strong Hire'];

export default function RecruitOffers() {
  const { user } = useAuth();
  const canManage = isModuleAdmin(user, 'recruit');
  const [offers, setOffers] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [hiredCandidates, setHiredCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [sendResult, setSendResult] = useState(null);

  function load() {
    setLoading(true);
    setError('');
    Promise.all([api.get('/recruit/offers'), api.get('/recruit/requisitions'), api.get('/recruit/interviews')])
      .then(([o, req, interviews]) => {
        setOffers(o.data.offers);
        setRequisitions(req.data.requisitions.filter((r) => r.status === 'Open'));

        // "Candidate Name" is a dropdown of people an interviewer has actually recommended for
        // hire (feedback.recommendation is Hire/Strong Hire) — not free text, so an offer can't
        // be typed up for someone who was never interviewed or wasn't recommended. Interviews are
        // per-round (spec §7-8: no separate candidate record), so the same person can have several
        // rows here; dedupe by email (falling back to name) and keep whichever hired round is most
        // recent for the auto-fill data. Already-offered candidates (any offer not Rejected/Expired)
        // are left out — they don't need to be offered again.
        const alreadyOffered = new Set(
          o.data.offers.filter((of) => !['Rejected', 'Expired'].includes(of.status)).map((of) => (of.email || '').toLowerCase())
        );
        const byCandidate = new Map();
        interviews.data.interviews
          .filter((iv) => HIRE_RECOMMENDATIONS.includes(iv.feedback?.recommendation))
          .forEach((iv) => {
            const key = (iv.email || iv.candidateName).toLowerCase();
            if (alreadyOffered.has(key)) return;
            const existing = byCandidate.get(key);
            if (!existing || new Date(iv.feedback.submittedAt) > new Date(existing.feedback.submittedAt)) {
              byCandidate.set(key, iv);
            }
          });
        setHiredCandidates([...byCandidate.values()].sort((a, b) => a.candidateName.localeCompare(b.candidateName)));
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load offers.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function pickCandidate(interviewId) {
    const iv = hiredCandidates.find((c) => c._id === interviewId);
    if (!iv) {
      setForm((f) => ({ ...f, candidateName: '' }));
      return;
    }
    setForm((f) => ({
      ...f,
      candidateName: iv.candidateName,
      email: iv.email || '',
      mobile: iv.mobile || '',
      requisition: iv.requisition?._id || f.requisition,
      department: iv.requisition?.department || f.department,
      designation: iv.requisition?.designation || iv.position || f.designation
    }));
  }

  async function create(e) {
    e.preventDefault();
    setSaveError('');
    setSaving(true);
    try {
      await api.post('/recruit/offers', { ...form, requisition: form.requisition || null });
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Could not create offer.');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id, status) {
    await api.patch(`/recruit/offers/${id}`, { status });
    load();
  }

  async function sendOffer(id) {
    setSendingId(id);
    setSendResult(null);
    try {
      const res = await api.post(`/recruit/offers/${id}/send`);
      setSendResult({ channel: res.data.channel, candidateName: res.data.offer.candidateName });
      load();
    } catch (err) {
      setSendResult({ error: err.response?.data?.message || 'Could not send the offer email.' });
    } finally {
      setSendingId(null);
    }
  }

  if (loading) return <div className="empty-state">Loading offers…</div>;
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
          <h1><Mail size={19} /> Offers</h1>
          <p>Accepting an offer automatically creates a Joining Record on the HR Admin dashboard.</p>
        </div>
        {canManage && (
          <div className="page-header-right">
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ New Offer</button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">New Offer</span></div>
          <div className="card-body">
            {saveError && <div className="form-error">{saveError}</div>}
            <form onSubmit={create}>
              <div className="grid g-2">
                <div className="form-group">
                  <label className="form-label">Candidate Name</label>
                  <select
                    className="form-input"
                    value={hiredCandidates.find((c) => c.candidateName === form.candidateName && c.email === form.email)?._id || ''}
                    onChange={(e) => pickCandidate(e.target.value)}
                    required
                    disabled={hiredCandidates.length === 0}
                  >
                    <option value="">{hiredCandidates.length === 0 ? 'No hired candidates yet' : 'Select a hired candidate'}</option>
                    {hiredCandidates.map((c) => (
                      <option key={c._id} value={c._id}>{c.candidateName}{c.requisition ? ` · ${c.requisition.jobId}` : ''}</option>
                    ))}
                  </select>
                  {hiredCandidates.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      No interview has been marked "Hire" or "Strong Hire" yet — submit interview feedback first.
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={form.email} readOnly required />
                </div>
              </div>
              <div className="grid g-2">
                <div className="form-group">
                  <label className="form-label">Mobile</label>
                  <input className="form-input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Job Requisition</label>
                  <select className="form-input" value={form.requisition} onChange={(e) => setForm({ ...form, requisition: e.target.value })}>
                    <option value="">— None —</option>
                    {requisitions.map((r) => <option key={r._id} value={r._id}>{r.jobId} · {r.designation}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid g-3">
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input className="form-input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Designation</label>
                  <input className="form-input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Branch</label>
                  <input className="form-input" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
                </div>
              </div>
              <div className="grid g-3">
                <div className="form-group">
                  <label className="form-label">Joining Date</label>
                  <input type="date" className="form-input" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">CTC</label>
                  <input className="form-input" value={form.ctc} onChange={(e) => setForm({ ...form, ctc: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Offer Expiry</label>
                  <input type="date" className="form-input" value={form.offerExpiryDate} onChange={(e) => setForm({ ...form, offerExpiryDate: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Offer'}</button>
                <button className="btn btn-outline" type="button" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sendResult && (
        sendResult.error ? (
          <div className="form-error" style={{ marginBottom: 14 }}>{sendResult.error}</div>
        ) : (
          <div style={{ background: 'var(--green-light)', color: 'var(--green)', borderRadius: 7, padding: '8px 12px', fontSize: 12.5, marginBottom: 14, fontWeight: 500 }}>
            {sendResult.channel === 'smtp'
              ? `✓ Offer email delivered to ${sendResult.candidateName}.`
              : `✓ No SMTP provider configured — the offer to ${sendResult.candidateName} was logged to the server console instead of actually emailed.`}
          </div>
        )
      )}

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Offer ID</th><th>Candidate</th><th>Designation</th><th>Joining Date</th><th>CTC</th><th>Status</th></tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o._id}>
                    <td>{o.offerId}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.candidateName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.email}</div>
                    </td>
                    <td>{o.designation}</td>
                    <td>{new Date(o.joiningDate).toLocaleDateString()}</td>
                    <td>{o.ctc || '—'}</td>
                    <td>
                      {canManage && !['Accepted', 'Rejected', 'Expired'].includes(o.status) ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            className={o.status === 'Draft' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                            disabled={sendingId === o._id}
                            onClick={() => sendOffer(o._id)}
                          >
                            {sendingId === o._id ? 'Sending…' : o.status === 'Draft' ? 'Send Offer' : 'Resend'}
                          </button>
                          <select className="form-input" style={{ width: 108 }} value={o.status} onChange={(e) => setStatus(o._id, e.target.value)}>
                            <option value="Draft" disabled={o.status !== 'Draft'}>Draft</option>
                            <option value="Sent" disabled>Sent</option>
                            <option value="Accepted">Accepted</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Expired">Expired</option>
                          </select>
                        </div>
                      ) : (
                        <span className={`chip ${STATUS_CHIP[o.status]}`}>{o.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {offers.length === 0 && (
                  <tr><td colSpan={6}><div className="empty-state">No offers yet.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
