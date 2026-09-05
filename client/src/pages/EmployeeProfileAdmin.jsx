import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, IdCard, Pencil, History, CalendarDays, ClipboardList, Palmtree } from 'lucide-react';
import api from '../api/client';
import AttendanceRow, { toDateKey, sundayOf, addDays, fmtRangeDate } from '../components/AttendanceRow';

const STATUS_CHIP = {
  ONBOARDING_PENDING: 'gray', EMAIL_SENT: 'blue', VERIFICATION_PENDING: 'gold',
  EMAIL_VERIFIED: 'blue', ACTIVE: 'green', EXPIRED: 'red', CANCELLED: 'red'
};

const PRIMARY_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'employment', label: 'Employment' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'leave', label: 'Leave' }
];

export default function EmployeeProfileAdmin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [primary, setPrimary] = useState('overview');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/employees/${id}`);
      setEmployee(res.data.employee);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load this employee.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <div className="empty-state">Loading employee…</div>;
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

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 8 }} onClick={() => navigate(-1)}>← Back</button>
          <h1>{employee.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 15 }}>· {employee.employeeId}</span></h1>
          <p>{employee.department} · {employee.designation}</p>
        </div>
        <div className="page-header-right">
          <span className={`chip ${STATUS_CHIP[employee.employeeStatus] || 'gray'}`}>{employee.employeeStatus.replace(/_/g, ' ')}</span>
        </div>
      </div>

      <div className="hrm-shell">
        <div className="hrm-tabbar-primary">
          {PRIMARY_TABS.map((t) => (
            <button
              key={t.key}
              className={'hrm-tab-primary' + (primary === t.key ? ' active' : '')}
              onClick={() => setPrimary(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {primary === 'overview' && <OverviewTab employee={employee} />}
      {primary === 'employment' && <EmploymentTab employee={employee} onSaved={load} />}
      {primary === 'attendance' && <AttendanceTab employeeId={id} />}
      {primary === 'leave' && <LeaveTab employeeId={id} />}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <tr>
      <td style={{ color: 'var(--text-muted)', width: 160, padding: '8px 0' }}>{label}</td>
      <td>{value ?? '—'}</td>
    </tr>
  );
}

function OverviewTab({ employee: e }) {
  return (
    <div className="card">
      <div className="card-header"><span className="card-title"><IdCard size={15} /> Overview</span></div>
      <div className="card-body">
        <table>
          <tbody>
            <Row label="Employee ID" value={e.employeeId} />
            <Row label="Name" value={e.name} />
            <Row label="Company Email" value={e.email} />
            <Row label="Personal Email" value={e.personalEmail || '—'} />
            <Row label="Mobile" value={e.mobile} />
            <Row label="Department" value={e.department} />
            <Row label="Designation" value={e.designation} />
            <Row label="Branch" value={e.branch} />
            <Row label="Reporting Manager" value={e.reportingManager?.name || '—'} />
            <Row label="Joining Date" value={e.joinDate ? new Date(e.joinDate).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' }) : '—'} />
            <Row label="Employment Type" value={e.employmentType} />
            <Row label="Employee Status" value={e.employeeStatus.replace(/_/g, ' ')} />
            <Row label="Account Status" value={e.accountStatus} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmploymentTab({ employee, onSaved }) {
  const [managers, setManagers] = useState([]);
  const [form, setForm] = useState({
    department: employee.department,
    designation: employee.designation,
    branch: employee.branch,
    employmentType: employee.employmentType,
    reportingManager: employee.reportingManager?._id || employee.reportingManager || ''
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    api.get('/employees/managers').then((res) => setManagers(res.data.managers));
    api.get(`/employees/${employee.id}/audit`).then((res) => {
      setHistory(res.data.logs.filter((l) => l.action.includes('Changed')));
      setHistoryLoading(false);
    });
  }, [employee.id]);

  async function save(e) {
    e.preventDefault();
    setSaveError('');
    setSaved(false);
    setSaving(true);
    try {
      await api.patch(`/employees/${employee.id}`, form);
      setSaved(true);
      onSaved();
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid g-2">
      <div className="card">
        <div className="card-header"><span className="card-title"><Pencil size={14} /> Edit Employment Info</span></div>
        <div className="card-body">
          {saveError && <div className="form-error">{saveError}</div>}
          {saved && <div className="chip green" style={{ marginBottom: 12 }}>✓ Saved</div>}
          <form onSubmit={save}>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input className="form-input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Designation</label>
              <input className="form-input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Branch</label>
              <input className="form-input" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Employment Type</label>
              <select className="form-input" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                <option>Full-time</option><option>Part-time</option><option>Contract</option><option>Intern</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reporting Manager</label>
              <select className="form-input" value={form.reportingManager || ''} onChange={(e) => setForm({ ...form, reportingManager: e.target.value })}>
                <option value="">— None —</option>
                {managers.filter((m) => m._id !== employee.id).map((m) => <option key={m._id} value={m._id}>{m.name} ({m.employeeId})</option>)}
              </select>
            </div>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title"><History size={15} /> Employee History</span></div>
        <div className="card-body" style={{ padding: history.length ? '4px 18px' : 18 }}>
          {historyLoading && <div className="empty-state">Loading…</div>}
          {!historyLoading && history.length === 0 && <div className="empty-state">No employment changes recorded yet.</div>}
          {history.map((h) => (
            <div className="task-item" key={h._id}>
              <div style={{ flex: 1 }}>
                <div className="task-text" style={{ fontWeight: 600 }}>{h.action}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {h.meta?.from || '—'} → {h.meta?.to || '—'} · {new Date(h.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AttendanceTab({ employeeId }) {
  const [weekStart, setWeekStart] = useState(() => sundayOf(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/hrm/attendance', {
        params: { employeeId, from: toDateKey(weekStart), to: toDateKey(addDays(weekStart, 6)) }
      });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load attendance.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [weekStart, employeeId]);

  if (loading) return <div className="empty-state">Loading attendance…</div>;
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
      <div className="week-nav">
        <button className="week-nav-arrow" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
        <span className="week-nav-icon"><CalendarDays size={14} /></span>
        <span className="week-nav-range">{fmtRangeDate(weekStart)} - {fmtRangeDate(addDays(weekStart, 6))}</span>
        <button className="week-nav-arrow" onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
        <button className="text-link" style={{ fontSize: 11.5, marginLeft: 8 }} onClick={() => setWeekStart(sundayOf(new Date()))}>This Week</button>
      </div>
      <div className="attend-timeline-list">
        {data.days.map((d) => <AttendanceRow key={d.date} day={d} />)}
      </div>
    </div>
  );
}

function LeaveTab({ employeeId }) {
  const [balance, setBalance] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [balRes, reqRes] = await Promise.all([
        api.get('/leave/balance', { params: { employeeId } }),
        api.get('/leave/requests', { params: { employeeId } })
      ]);
      setBalance(balRes.data.leaveBalance);
      setRequests(reqRes.data.requests);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load leave data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [employeeId]);

  if (loading) return <div className="empty-state">Loading leave data…</div>;
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
      <div className="grid g-3" style={{ marginBottom: 16 }}>
        <BalanceCard label="Casual" used={balance.casualUsed} total={balance.casual} color="var(--blue-mid)" bg="var(--blue-pale)" />
        <BalanceCard label="Sick" used={balance.sickUsed} total={balance.sick} color="var(--green)" bg="var(--green-light)" />
        <BalanceCard label="Earned" used={balance.earnedUsed} total={balance.earned} color="var(--gold)" bg="var(--gold-light)" />
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title"><ClipboardList size={15} /> Leave History</span></div>
        <div className="card-body" style={{ padding: 0 }}>
          {requests.length === 0 ? (
            <div className="empty-state">No leave requests yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th></tr></thead>
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
    </div>
  );
}

function BalanceCard({ label, used, total, color, bg }) {
  const remaining = total - used;
  return (
    <div className="stat-card" style={{ cursor: 'default' }}>
      <div className="stat-icon" style={{ background: bg, color }}><Palmtree size={19} /></div>
      <div className="stat-info">
        <div className="val">{remaining}</div>
        <div className="lbl">{label} remaining</div>
        <div className="chg up">{used}/{total} used</div>
      </div>
    </div>
  );
}
