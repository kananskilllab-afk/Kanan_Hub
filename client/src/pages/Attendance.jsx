import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Ticket, FileEdit, CalendarDays, CheckCircle2, SunMoon, XCircle, Wrench, X } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import AttendanceRow, { toDateKey, sundayOf, addDays, fmtRangeDate, fmtMinutes, REASON_LABEL } from '../components/AttendanceRow';

export default function Attendance() {
  const { user } = useAuth();

  const [weekStart, setWeekStart] = useState(() => sundayOf(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkoutMsg, setCheckoutMsg] = useState('');

  const [showHalfDayForm, setShowHalfDayForm] = useState(false);
  const [showPermissionForm, setShowPermissionForm] = useState(false);
  const [regularizeDay, setRegularizeDay] = useState(null);
  const [myHalfDayRequests, setMyHalfDayRequests] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [myRegularizations, setMyRegularizations] = useState([]);
  const [pendingRegularizations, setPendingRegularizations] = useState([]);
  const [myPermissions, setMyPermissions] = useState([]);
  const [pendingPermissions, setPendingPermissions] = useState([]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/hrm/attendance', {
        params: { from: toDateKey(weekStart), to: toDateKey(addDays(weekStart, 6)) }
      });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load attendance.');
    } finally {
      setLoading(false);
    }
  }

  async function loadHalfDayLists() {
    const mine = await api.get('/hrm/half-day-leave');
    setMyHalfDayRequests(mine.data.requests);
    const all = await api.get('/hrm/half-day-leave', { params: { all: true } });
    setPendingApprovals(all.data.requests.filter((r) => r.status === 'Pending' && r.user._id !== user?.id));
  }

  async function loadRegularizations() {
    const mine = await api.get('/hrm/regularization');
    setMyRegularizations(mine.data.requests);
    const all = await api.get('/hrm/regularization', { params: { all: true } });
    setPendingRegularizations(all.data.requests.filter((r) => r.status === 'Pending' && r.user._id !== user?.id));
  }

  async function loadPermissions() {
    const mine = await api.get('/hrm/permission');
    setMyPermissions(mine.data.requests);
    const all = await api.get('/hrm/permission', { params: { all: true } });
    setPendingPermissions(all.data.requests.filter((r) => r.status === 'Pending' && r.user._id !== user?.id));
  }

  useEffect(() => {
    load();
  }, [weekStart]);

  useEffect(() => {
    loadHalfDayLists();
    loadRegularizations();
    loadPermissions();
  }, []);

  async function checkIn() {
    setBusy(true);
    setCheckoutMsg('');
    try {
      await api.post('/hrm/attendance/checkin');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function checkOut() {
    setBusy(true);
    try {
      const res = await api.post('/hrm/attendance/checkout');
      const ev = res.data.evaluation;
      setCheckoutMsg(
        ev.status === 'PRESENT'
          ? `✓ ${fmtMinutes(ev.minutesWorked)} worked — marked Present.`
          : ev.status === 'HALF_DAY'
          ? `✓ ${fmtMinutes(ev.minutesWorked)} worked — marked Half Day (${REASON_LABEL[ev.reason]}).`
          : `⚠️ ${fmtMinutes(ev.minutesWorked)} worked — marked Absent (${REASON_LABEL[ev.reason]}).`
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="empty-state">Loading attendance…</div>;
  if (error) {
    return (
      <div className="empty-state">
        <div className="es-icon"><AlertTriangle size={30} /></div>
        {error}
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={load}>Retry</button>
        </div>
      </div>
    );
  }

  const { summary, today, days, shift, halfDayMinutes } = data;
  const weekEnd = addDays(weekStart, 6);
  const isCurrentWeek = toDateKey(weekStart) === toDateKey(sundayOf(new Date()));

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1><Clock size={19} /> Attendance</h1>
          <p>Required {fmtMinutes(shift.requiredMinutes)} · Half-day {fmtMinutes(halfDayMinutes)} · {shift.startTime}–{shift.endTime}</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-outline btn-sm" onClick={() => setShowPermissionForm(true)}><Ticket size={13} /> Apply Permission</button>
          <button className="btn btn-outline btn-sm" onClick={() => setShowHalfDayForm(true)}><FileEdit size={13} /> Apply Half-Day Leave</button>
        </div>
      </div>

      <div className="week-nav">
        <button className="week-nav-arrow" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
        <span className="week-nav-icon"><CalendarDays size={14} /></span>
        <span className="week-nav-range">{fmtRangeDate(weekStart)} - {fmtRangeDate(weekEnd)}</span>
        <button className="week-nav-arrow" onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
        {!isCurrentWeek && (
          <button className="text-link" style={{ fontSize: 11.5, marginLeft: 8 }} onClick={() => setWeekStart(sundayOf(new Date()))}>
            This Week
          </button>
        )}
      </div>

      {isCurrentWeek && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 700, fontSize: 14 }}>Today</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {today.status === 'PENDING' && 'You have not checked in today.'}
                {today.status === 'IN_PROGRESS' && `Checked in at ${new Date(today.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — still working.`}
                {!['PENDING', 'IN_PROGRESS'].includes(today.status) && (
                  <>
                    {today.status} {REASON_LABEL[today.reason] && `— ${REASON_LABEL[today.reason]}`} · {fmtMinutes(today.minutesWorked)} worked
                  </>
                )}
              </div>
              {checkoutMsg && <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600 }}>{checkoutMsg}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {today.status === 'PENDING' && <button className="btn btn-primary" disabled={busy} onClick={checkIn}>Check In</button>}
              {today.status === 'IN_PROGRESS' && <button className="btn btn-outline" disabled={busy} onClick={checkOut}>Check Out</button>}
              {!['PENDING', 'IN_PROGRESS'].includes(today.status) && (
                <span className={`chip ${today.status === 'PRESENT' || today.status === 'HALF_DAY' ? 'green' : 'red'}`}>✓ Day Complete</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid g-4" style={{ marginBottom: 16 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-icon" style={{ background: 'var(--green-light)', color: 'var(--green)' }}><CheckCircle2 size={19} /></div>
          <div className="stat-info"><div className="val">{summary.PRESENT}</div><div className="lbl">Present</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-mid)' }}><SunMoon size={19} /></div>
          <div className="stat-info"><div className="val">{summary.HALF_DAY}</div><div className="lbl">Half Day</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-icon" style={{ background: 'var(--red-light)', color: 'var(--red)' }}><XCircle size={19} /></div>
          <div className="stat-info"><div className="val">{summary.ABSENT}</div><div className="lbl">Absent</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-icon" style={{ background: 'var(--gold-light)', color: 'var(--gold)' }}><CalendarDays size={19} /></div>
          <div className="stat-info"><div className="val">{summary.WEEKLY_OFF + summary.HOLIDAY}</div><div className="lbl">Weekend / Holiday</div></div>
        </div>
      </div>

      {(myHalfDayRequests.length > 0 || pendingApprovals.length > 0) && (
        <div className="grid g-2" style={{ marginBottom: 16 }}>
          {myHalfDayRequests.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title"><FileEdit size={15} /> My Half-Day Leave Requests</span></div>
              <div className="card-body" style={{ padding: '4px 18px' }}>
                {myHalfDayRequests.slice(0, 5).map((r) => (
                  <div key={r._id} className="task-item">
                    <div className="task-text">{r.date} · {r.half === 'FIRST_HALF' ? 'First Half' : 'Second Half'}</div>
                    <span className={`chip ${r.status === 'Approved' ? 'green' : r.status === 'Rejected' ? 'red' : 'gold'}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pendingApprovals.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title"><CheckCircle2 size={15} /> Pending Half-Day Approvals</span></div>
              <div className="card-body" style={{ padding: '4px 18px' }}>
                {pendingApprovals.map((r) => (
                  <div className="task-item" key={r._id}>
                    <div style={{ flex: 1 }}>
                      <div className="task-text" style={{ fontWeight: 600 }}>{r.user.name} · {r.date}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.half === 'FIRST_HALF' ? 'First Half' : 'Second Half'}{r.reason && ` — ${r.reason}`}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={async () => { await api.patch(`/hrm/half-day-leave/${r._id}/approve`); loadHalfDayLists(); load(); }}>Approve</button>
                      <button className="btn btn-outline btn-sm" onClick={async () => { await api.patch(`/hrm/half-day-leave/${r._id}/reject`); loadHalfDayLists(); }}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(myRegularizations.length > 0 || pendingRegularizations.length > 0) && (
        <div className="grid g-2" style={{ marginBottom: 16 }}>
          {myRegularizations.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title"><Wrench size={15} /> My Regularization Requests</span></div>
              <div className="card-body" style={{ padding: '4px 18px' }}>
                {myRegularizations.slice(0, 5).map((r) => (
                  <div key={r._id} className="task-item">
                    <div className="task-text">{r.date} · {reqSummary(r)}</div>
                    <span className={`chip ${r.status === 'Approved' ? 'green' : r.status === 'Rejected' ? 'red' : 'gold'}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pendingRegularizations.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title"><CheckCircle2 size={15} /> Pending Regularization Approvals</span></div>
              <div className="card-body" style={{ padding: '4px 18px' }}>
                {pendingRegularizations.map((r) => (
                  <div className="task-item" key={r._id}>
                    <div style={{ flex: 1 }}>
                      <div className="task-text" style={{ fontWeight: 600 }}>{r.user.name} · {r.date}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{reqSummary(r)}{r.reason && ` — ${r.reason}`}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={async () => { await api.patch(`/hrm/regularization/${r._id}/approve`); loadRegularizations(); load(); }}>Approve</button>
                      <button className="btn btn-outline btn-sm" onClick={async () => { await api.patch(`/hrm/regularization/${r._id}/reject`); loadRegularizations(); }}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(myPermissions.length > 0 || pendingPermissions.length > 0) && (
        <div className="grid g-2" style={{ marginBottom: 16 }}>
          {myPermissions.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title"><Ticket size={15} /> My Permission Requests</span></div>
              <div className="card-body" style={{ padding: '4px 18px' }}>
                {myPermissions.slice(0, 5).map((r) => (
                  <div key={r._id} className="task-item">
                    <div className="task-text">{r.date} · {PERMISSION_TYPE_LABEL[r.type]} · {permSummary(r)}</div>
                    <span className={`chip ${r.status === 'Approved' ? 'green' : r.status === 'Rejected' ? 'red' : 'gold'}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pendingPermissions.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title"><CheckCircle2 size={15} /> Pending Permission Approvals</span></div>
              <div className="card-body" style={{ padding: '4px 18px' }}>
                {pendingPermissions.map((r) => (
                  <div className="task-item" key={r._id}>
                    <div style={{ flex: 1 }}>
                      <div className="task-text" style={{ fontWeight: 600 }}>{r.user.name} · {r.date}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{PERMISSION_TYPE_LABEL[r.type]} · {permSummary(r)}{r.reason && ` — ${r.reason}`}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={async () => { await api.patch(`/hrm/permission/${r._id}/approve`); loadPermissions(); load(); }}>Approve</button>
                      <button className="btn btn-outline btn-sm" onClick={async () => { await api.patch(`/hrm/permission/${r._id}/reject`); loadPermissions(); }}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {days.length === 0 ? (
        <div className="empty-state">No attendance records for this week.</div>
      ) : (
        <div className="attend-timeline-list">
          {days.map((d) => <AttendanceRow key={d.date} day={d} onRegularize={setRegularizeDay} />)}
        </div>
      )}

      {showHalfDayForm && (
        <HalfDayLeaveModal
          shift={shift}
          onClose={() => setShowHalfDayForm(false)}
          onSubmitted={() => { setShowHalfDayForm(false); loadHalfDayLists(); }}
        />
      )}
      {regularizeDay && (
        <RegularizationModal
          day={regularizeDay}
          onClose={() => setRegularizeDay(null)}
          onSubmitted={() => { setRegularizeDay(null); loadRegularizations(); }}
        />
      )}
      {showPermissionForm && (
        <PermissionRequestModal
          shift={shift}
          onClose={() => setShowPermissionForm(false)}
          onSubmitted={() => { setShowPermissionForm(false); loadPermissions(); }}
        />
      )}
    </div>
  );
}

function reqSummary(r) {
  const fmt = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null);
  const parts = [];
  if (r.requestedCheckIn) parts.push(`In ${fmt(r.requestedCheckIn)}`);
  if (r.requestedCheckOut) parts.push(`Out ${fmt(r.requestedCheckOut)}`);
  return parts.join(' · ');
}

const PERMISSION_TYPE_LABEL = { SHORT: 'Short Permission', LATE: 'Late Check-In', EARLY_EXIT: 'Early Check-Out' };

function fmtDurationMin(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

function permSummary(r) {
  const fmt = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null);
  if (r.type === 'SHORT') return `${fmt(r.outTime)} – ${fmt(r.returnTime)} (${fmtDurationMin(r.durationMinutes)})`;
  if (r.type === 'LATE') return `Arriving ${fmt(r.requestedTime)} (${fmtDurationMin(r.durationMinutes)} late)`;
  return `Leaving ${fmt(r.requestedTime)} (${fmtDurationMin(r.durationMinutes)} early)`;
}

function Modal({ title, children, onClose }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,27,61,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div className="card" style={{ width: 440, maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <span className="card-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}

function HalfDayLeaveModal({ shift, onClose, onSubmitted }) {
  const [date, setDate] = useState('');
  const [half, setHalf] = useState('FIRST_HALF');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/hrm/half-day-leave', { date, half, reason });
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit request.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={<><FileEdit size={15} /> Apply Half-Day Leave</>} onClose={onClose}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        You must complete at least {fmtMinutes(Math.round(shift.requiredMinutes / 2))} of working time in the remaining half for it to count. Requires manager/HR approval.
      </p>
      {error && <div className="form-error">{error}</div>}
      <form onSubmit={submit}>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">Half</label>
          <select className="form-input" value={half} onChange={(e) => setHalf(e.target.value)}>
            {shift.firstHalfEnabled && <option value="FIRST_HALF">First Half (leave morning, work afternoon)</option>}
            {shift.secondHalfEnabled && <option value="SECOND_HALF">Second Half (work morning, leave afternoon)</option>}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Reason</label>
          <input className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
        </div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving}>
          {saving ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>
    </Modal>
  );
}

function RegularizationModal({ day, onClose, onSubmitted }) {
  const toTimeInput = (iso) => (iso ? new Date(iso).toTimeString().slice(0, 5) : '');
  const [checkIn, setCheckIn] = useState(toTimeInput(day.rawCheckIn ?? day.checkIn));
  const [checkOut, setCheckOut] = useState(toTimeInput(day.rawCheckOut ?? day.checkOut));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/hrm/regularization', {
        date: day.date,
        requestedCheckIn: checkIn || null,
        requestedCheckOut: checkOut || null,
        reason
      });
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit request.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={<><Wrench size={15} /> Regularize Attendance</>} onClose={onClose}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        Correct your check-in / check-out for <strong>{day.date}</strong>. This goes to your manager or HR for approval — your original punch record is kept as-is until then.
      </p>
      {error && <div className="form-error">{error}</div>}
      <form onSubmit={submit}>
        <div className="grid g-2">
          <div className="form-group">
            <label className="form-label">Check-In</label>
            <input type="time" className="form-input" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Check-Out</label>
            <input type="time" className="form-input" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Reason</label>
          <input className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Forgot to check out" required />
        </div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving}>
          {saving ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>
    </Modal>
  );
}

function PermissionRequestModal({ shift, onClose, onSubmitted }) {
  const [type, setType] = useState('SHORT');
  const [date, setDate] = useState('');
  const [outTime, setOutTime] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [requestedTime, setRequestedTime] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { type, date, reason };
      if (type === 'SHORT') {
        payload.outTime = outTime;
        payload.returnTime = returnTime;
      } else {
        payload.requestedTime = requestedTime;
      }
      await api.post('/hrm/permission', payload);
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit request.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={<><Ticket size={15} /> Apply Permission</>} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-group">
          <label className="form-label">Permission Type</label>
          <select className="form-input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="SHORT">Short Permission</option>
            <option value="LATE">Late Check-In</option>
            <option value="EARLY_EXIT">Early Check-Out</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        {type === 'SHORT' && (
          <div className="grid g-2">
            <div className="form-group">
              <label className="form-label">Out Time</label>
              <input type="time" className="form-input" value={outTime} onChange={(e) => setOutTime(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Expected Return</label>
              <input type="time" className="form-input" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} required />
            </div>
          </div>
        )}
        {type === 'LATE' && (
          <div className="form-group">
            <label className="form-label">Expected Arrival (Shift starts {shift.startTime})</label>
            <input type="time" className="form-input" value={requestedTime} onChange={(e) => setRequestedTime(e.target.value)} required />
          </div>
        )}
        {type === 'EARLY_EXIT' && (
          <div className="form-group">
            <label className="form-label">Expected Exit (Shift ends {shift.endTime})</label>
            <input type="time" className="form-input" value={requestedTime} onChange={(e) => setRequestedTime(e.target.value)} required />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Reason</label>
          <input className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} required />
        </div>
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving}>
          {saving ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>
    </Modal>
  );
}
