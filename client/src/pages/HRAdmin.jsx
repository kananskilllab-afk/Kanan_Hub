import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck, AlertTriangle, CalendarDays, Users, CheckCircle2, XCircle, SunMoon, AlarmClock, DoorOpen, Hourglass,
  FileEdit, Inbox, X, Wrench, Ticket
} from 'lucide-react';
import api from '../api/client';
import { toDateKey } from '../components/AttendanceRow';

const PRIMARY_TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'directory', label: 'Employee Directory' },
  { key: 'approvals', label: 'Approval Center' },
  { key: 'calendar', label: 'HR Calendar' }
];
const PRIMARY_TAB_KEYS = new Set(PRIMARY_TABS.map((t) => t.key));

export default function HRAdmin() {
  // Deep-linkable via ?tab= (the header's Calendar button lands directly on the HR Calendar tab
  // instead of just opening the dashboard tab and making the user click over to it).
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [primary, setPrimary] = useState(PRIMARY_TAB_KEYS.has(requestedTab) ? requestedTab : 'dashboard');

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1><ShieldCheck size={19} /> HR Admin</h1>
          <p>Org-wide attendance summary, employee directory, and pending approvals</p>
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

      {primary === 'dashboard' && <DashboardTab onNavigate={setPrimary} />}
      {primary === 'directory' && <DirectoryTab />}
      {primary === 'approvals' && <ApprovalsTab />}
      {primary === 'calendar' && <CalendarTab />}
    </div>
  );
}

function DashboardTab({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/hrm/dashboard-summary');
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the HR dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="empty-state">Loading…</div>;
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

  const { totalEmployees, isHoliday, isWeeklyOff, today, pending } = data;

  return (
    <div>
      {(isHoliday || isWeeklyOff) && (
        <div className="chip gold" style={{ marginBottom: 14 }}>
          <CalendarDays size={12} /> {isHoliday ? 'Today is a holiday' : 'Today is a weekly off'} — attendance not tallied.
        </div>
      )}

      <div style={{ marginBottom: 7 }}>
        <span style={{ fontFamily: 'Sora,sans-serif', fontSize: 12.5, fontWeight: 700, color: 'var(--text-dark)' }}>
          Today's Summary
        </span>
      </div>
      <div className="grid g-4" style={{ marginBottom: 16 }}>
        <Stat icon={Users} bg="var(--blue-pale)" color="var(--blue-mid)" val={totalEmployees} lbl="Total Employees" />
        <Stat icon={CheckCircle2} bg="var(--green-light)" color="var(--green)" val={today.PRESENT} lbl="Present" />
        <Stat icon={XCircle} bg="var(--red-light)" color="var(--red)" val={today.ABSENT} lbl="Absent" />
        <Stat icon={SunMoon} bg="var(--blue-pale)" color="var(--blue-mid)" val={today.HALF_DAY} lbl="Half Day" />
        <Stat icon={AlarmClock} bg="var(--gold-light)" color="var(--gold)" val={today.LATE} lbl="Late" />
        <Stat icon={DoorOpen} bg="var(--red-light)" color="var(--red)" val={today.MISSING_CHECKOUT} lbl="Missing Checkout" />
        <Stat icon={Hourglass} bg="#F0F2F5" color="#5A6A8A" val={today.notYetCheckedIn} lbl="Not Yet Checked In" />
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 20 }}>
        On Leave / WFH / On Duty aren't shown — those aren't wired to daily attendance yet, so I'm not going to fake numbers for them.
      </p>

      <div style={{ marginBottom: 7 }}>
        <span style={{ fontFamily: 'Sora,sans-serif', fontSize: 12.5, fontWeight: 700, color: 'var(--text-dark)' }}>
          Pending HR Actions
        </span>
      </div>
      <div className="grid g-4">
        <div className="stat-card" onClick={() => onNavigate('approvals')}>
          <div className="stat-icon" style={{ background: 'var(--gold-light)', color: 'var(--gold)' }}><FileEdit size={19} /></div>
          <div className="stat-info"><div className="val">{pending.halfDayLeave}</div><div className="lbl">Pending Half-Day Leave</div></div>
        </div>
        <div className="stat-card" onClick={() => onNavigate('directory')}>
          <div className="stat-icon" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}><Inbox size={19} /></div>
          <div className="stat-info"><div className="val">{pending.onboarding}</div><div className="lbl">Pending Onboarding / Verification</div></div>
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10 }}>
        WFH, Regularization, Overtime, Document Expiry, Probation, and Exit requests aren't built yet — those tiles are intentionally left out rather than shown as fake zeros.
      </p>

      <JoiningListCard />
    </div>
  );
}

const JOIN_STATUS_CHIP = {
  'Joining Pending': 'gold',
  ONBOARDING_PENDING: 'gold',
  EMAIL_SENT: 'blue',
  VERIFICATION_PENDING: 'blue',
  EMAIL_VERIFIED: 'blue',
  ACTIVE: 'green',
  EXPIRED: 'red',
  CANCELLED: 'red'
};

// Kanan Recruit spec §10-13: populated automatically when a Recruit offer is accepted. "Start
// Onboarding" reuses the exact same POST /employees flow the rest of the Employee Directory uses —
// no shortcut that skips company-email assignment — then links the record so its status from then
// on is read live from the real employee, never duplicated.
function JoiningListCard() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onboarding, setOnboarding] = useState(null);

  function load() {
    setLoading(true);
    setError('');
    api.get('/hrm/joining-list')
      .then((res) => setRecords(res.data.records))
      .catch((err) => setError(err.response?.data?.message || 'Could not load the joining list.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function displayStatus(r) {
    if (!r.linkedEmployee) return 'Joining Pending';
    return r.linkedEmployee.employeeStatus;
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ marginBottom: 7 }}>
        <span style={{ fontFamily: 'Sora,sans-serif', fontSize: 12.5, fontWeight: 700, color: 'var(--text-dark)' }}>
          Joining List <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>— from accepted Kanan Recruit offers</span>
        </span>
      </div>
      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state"><div className="es-icon"><AlertTriangle size={30} /></div>{error}</div>}
      {!loading && !error && (
        <div className="card">
          <div className="card-body" style={{ padding: records.length ? '4px 18px' : 18 }}>
            {records.length === 0 && <div className="empty-state">No candidates waiting to be onboarded.</div>}
            {records.map((r) => (
              <div className="task-item" key={r._id}>
                <div style={{ flex: 1 }}>
                  <div className="task-text" style={{ fontWeight: 600 }}>{r.name} — {r.designation}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {r.department} · Joining {new Date(r.joiningDate).toLocaleDateString()}
                    {r.linkedEmployee && ` · ${r.linkedEmployee.employeeId}`}
                  </div>
                </div>
                <span className={`chip ${JOIN_STATUS_CHIP[displayStatus(r)] || 'gray'}`} style={{ marginRight: 10 }}>
                  {displayStatus(r).replace(/_/g, ' ')}
                </span>
                {!r.linkedEmployee && (
                  <button className="btn btn-primary btn-sm" onClick={() => setOnboarding(r)}>Start Onboarding</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {onboarding && (
        <StartOnboardingModal record={onboarding} onClose={() => setOnboarding(null)} onDone={() => { setOnboarding(null); load(); }} />
      )}
    </div>
  );
}

function StartOnboardingModal({ record, onClose, onDone }) {
  const [nameParts] = useState(() => {
    const parts = record.name.trim().split(/\s+/);
    return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || parts[0] || '' };
  });
  const [form, setForm] = useState({
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    mobile: record.mobile || '',
    personalEmail: record.email || '',
    companyEmail: '',
    department: record.department,
    designation: record.designation,
    branch: record.branch || '',
    joiningDate: new Date(record.joiningDate).toISOString().slice(0, 10),
    reportingManager: record.reportingManager?._id || record.reportingManager || '',
    employmentType: 'Full-time'
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await api.post('/employees', form);
      await api.patch(`/hrm/joining-list/${record._id}/link`, { employeeId: res.data.employee.id });
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start onboarding.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,27,61,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div className="card" style={{ width: 480, maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <span className="card-title">Start Onboarding — {record.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Pre-filled from the accepted offer. This creates a real onboarding record — same as Employee Directory → New Employee.
          </p>
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={submit}>
            <div className="grid g-2">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input className="form-input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input className="form-input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Company Email</label>
              <input type="email" className="form-input" placeholder="firstname.lastname@kanan.co" value={form.companyEmail} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} required />
            </div>
            <div className="grid g-2">
              <div className="form-group">
                <label className="form-label">Personal Email</label>
                <input className="form-input" value={form.personalEmail} onChange={(e) => setForm({ ...form, personalEmail: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile</label>
                <input className="form-input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} required />
              </div>
            </div>
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
            <div className="grid g-2">
              <div className="form-group">
                <label className="form-label">Branch</label>
                <input className="form-input" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Joining Date</label>
                <input type="date" className="form-input" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Employment Type</label>
              <select className="form-input" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                <option>Full-time</option><option>Part-time</option><option>Contract</option><option>Intern</option>
              </select>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving}>
              {saving ? 'Creating…' : 'Create Onboarding Record'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, bg, color, val, lbl }) {
  return (
    <div className="stat-card" style={{ cursor: 'default' }}>
      <div className="stat-icon" style={{ background: bg, color }}><Icon size={19} /></div>
      <div className="stat-info"><div className="val">{val}</div><div className="lbl">{lbl}</div></div>
    </div>
  );
}

const STATUS_CHIP = {
  ONBOARDING_PENDING: 'gray', EMAIL_SENT: 'blue', VERIFICATION_PENDING: 'gold',
  EMAIL_VERIFIED: 'blue', ACTIVE: 'green', EXPIRED: 'red', CANCELLED: 'red'
};

function DirectoryTab() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [options, setOptions] = useState({ departments: [], designations: [], branches: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ q: '', department: '', designation: '', branch: '', status: '', employmentType: '' });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const res = await api.get('/employees', { params });
      setEmployees(res.data.employees);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the directory.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.get('/employees/filter-options').then((res) => setOptions(res.data));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [filters]);

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div>
      <div className="filter-bar">
        <div className="filter-row" style={{ gridTemplateColumns: 'repeat(6,1fr)' }}>
          <input className="form-input" placeholder="Name, ID, or email…" value={filters.q} onChange={(e) => setFilter('q', e.target.value)} />
          <select className="form-input" value={filters.department} onChange={(e) => setFilter('department', e.target.value)}>
            <option value="">All Departments</option>
            {options.departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="form-input" value={filters.designation} onChange={(e) => setFilter('designation', e.target.value)}>
            <option value="">All Designations</option>
            {options.designations.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="form-input" value={filters.branch} onChange={(e) => setFilter('branch', e.target.value)}>
            <option value="">All Branches</option>
            {options.branches.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="form-input" value={filters.employmentType} onChange={(e) => setFilter('employmentType', e.target.value)}>
            <option value="">All Employment Types</option>
            <option>Full-time</option><option>Part-time</option><option>Contract</option><option>Intern</option>
          </select>
          <select className="form-input" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">All Statuses</option>
            {Object.keys(STATUS_CHIP).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="empty-state">Loading directory…</div>}
      {!loading && error && (
        <div className="empty-state">
          <div className="es-icon"><AlertTriangle size={30} /></div>
          {error}
          <div style={{ marginTop: 12 }}><button className="btn btn-primary btn-sm" onClick={load}>Retry</button></div>
        </div>
      )}
      {!loading && !error && (
        <div className="card">
          <div className="card-header"><span className="card-title">{employees.length} employee{employees.length === 1 ? '' : 's'}</span></div>
          <div className="card-body" style={{ padding: 0 }}>
            {employees.length === 0 ? (
              <div className="empty-state">No employees match these filters.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Employee ID</th><th>Name</th><th>Department</th><th>Designation</th><th>Branch</th><th>Type</th><th>Joining Date</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {employees.map((e) => (
                      <tr key={e.id} className="td-link" style={{ cursor: 'pointer' }} onClick={() => navigate(`/hr-admin/employee/${e.id}`)}>
                        <td>{e.employeeId}</td>
                        <td>{e.name}</td>
                        <td>{e.department}</td>
                        <td>{e.designation}</td>
                        <td>{e.branch}</td>
                        <td>{e.employmentType}</td>
                        <td>{e.joinDate ? new Date(e.joinDate).toLocaleDateString() : '—'}</td>
                        <td><span className={`chip ${STATUS_CHIP[e.employeeStatus] || 'gray'}`}>{e.employeeStatus.replace(/_/g, ' ')}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function regFmt(iso) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
}

function regSummary(r) {
  const parts = [];
  if (r.requestedCheckIn) parts.push(`In ${regFmt(r.requestedCheckIn)}`);
  if (r.requestedCheckOut) parts.push(`Out ${regFmt(r.requestedCheckOut)}`);
  return parts.join(' · ');
}

const PERMISSION_TYPE_LABEL = { SHORT: 'Short Permission', LATE: 'Late Check-In', EARLY_EXIT: 'Early Check-Out' };

function permFmtDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

function permSummary(r) {
  if (r.type === 'SHORT') return `${regFmt(r.outTime)} – ${regFmt(r.returnTime)} (${permFmtDuration(r.durationMinutes)})`;
  if (r.type === 'LATE') return `Arriving ${regFmt(r.requestedTime)} (${permFmtDuration(r.durationMinutes)} late)`;
  return `Leaving ${regFmt(r.requestedTime)} (${permFmtDuration(r.durationMinutes)} early)`;
}

function ApprovalsTab() {
  const [requests, setRequests] = useState([]);
  const [regRequests, setRegRequests] = useState([]);
  const [permRequests, setPermRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('Pending');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [halfDay, reg, perm] = await Promise.all([
        api.get('/hrm/half-day-leave', { params: { all: true } }),
        api.get('/hrm/regularization', { params: { all: true } }),
        api.get('/hrm/permission', { params: { all: true } })
      ]);
      setRequests(halfDay.data.requests);
      setRegRequests(reg.data.requests);
      setPermRequests(perm.data.requests);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load approval requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id, action) {
    await api.patch(`/hrm/half-day-leave/${id}/${action}`);
    load();
  }

  async function actReg(id, action) {
    await api.patch(`/hrm/regularization/${id}/${action}`);
    load();
  }

  async function actPerm(id, action) {
    await api.patch(`/hrm/permission/${id}/${action}`);
    load();
  }

  if (loading) return <div className="empty-state">Loading approvals…</div>;
  if (error) {
    return (
      <div className="empty-state">
        <div className="es-icon"><AlertTriangle size={30} /></div>
        {error}
        <div style={{ marginTop: 12 }}><button className="btn btn-primary btn-sm" onClick={load}>Retry</button></div>
      </div>
    );
  }

  const filtered = requests.filter((r) => filter === 'All' || r.status === filter);
  const filteredReg = regRequests.filter((r) => filter === 'All' || r.status === filter);
  const filteredPerm = permRequests.filter((r) => filter === 'All' || r.status === filter);

  return (
    <div>
      <div className="tab-strip" style={{ marginBottom: 14 }}>
        {['Pending', 'Approved', 'Rejected', 'All'].map((f) => (
          <button key={f} className={'tab-btn' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">Half-Day Leave Requests</span></div>
        <div className="card-body" style={{ padding: filtered.length ? '4px 18px' : 18 }}>
          {filtered.length === 0 && <div className="empty-state">No {filter.toLowerCase()} requests.</div>}
          {filtered.map((r) => (
            <div className="task-item" key={r._id}>
              <div style={{ flex: 1 }}>
                <div className="task-text" style={{ fontWeight: 600 }}>{r.user.name} ({r.user.employeeId}) · {r.date}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {r.half === 'FIRST_HALF' ? 'First Half' : 'Second Half'}{r.reason && ` — ${r.reason}`}
                </div>
              </div>
              {r.status === 'Pending' ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => act(r._id, 'approve')}>Approve</button>
                  <button className="btn btn-outline btn-sm" onClick={() => act(r._id, 'reject')}>Reject</button>
                </div>
              ) : (
                <span className={`chip ${r.status === 'Approved' ? 'green' : 'red'}`}>{r.status}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title"><Wrench size={15} /> Attendance Regularization Requests</span></div>
        <div className="card-body" style={{ padding: filteredReg.length ? '4px 18px' : 18 }}>
          {filteredReg.length === 0 && <div className="empty-state">No {filter.toLowerCase()} requests.</div>}
          {filteredReg.map((r) => (
            <div className="task-item" key={r._id}>
              <div style={{ flex: 1 }}>
                <div className="task-text" style={{ fontWeight: 600 }}>{r.user.name} ({r.user.employeeId}) · {r.date}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {regSummary(r)}{r.reason && ` — ${r.reason}`}
                </div>
              </div>
              {r.status === 'Pending' ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => actReg(r._id, 'approve')}>Approve</button>
                  <button className="btn btn-outline btn-sm" onClick={() => actReg(r._id, 'reject')}>Reject</button>
                </div>
              ) : (
                <span className={`chip ${r.status === 'Approved' ? 'green' : 'red'}`}>{r.status}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title"><Ticket size={15} /> Permission Requests</span></div>
        <div className="card-body" style={{ padding: filteredPerm.length ? '4px 18px' : 18 }}>
          {filteredPerm.length === 0 && <div className="empty-state">No {filter.toLowerCase()} requests.</div>}
          {filteredPerm.map((r) => (
            <div className="task-item" key={r._id}>
              <div style={{ flex: 1 }}>
                <div className="task-text" style={{ fontWeight: 600 }}>{r.user.name} ({r.user.employeeId}) · {r.date}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {PERMISSION_TYPE_LABEL[r.type]} · {permSummary(r)}{r.reason && ` — ${r.reason}`}
                </div>
              </div>
              {r.status === 'Pending' ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => actPerm(r._id, 'approve')}>Approve</button>
                  <button className="btn btn-outline btn-sm" onClick={() => actPerm(r._id, 'reject')}>Reject</button>
                </div>
              ) : (
                <span className={`chip ${r.status === 'Approved' ? 'green' : 'red'}`}>{r.status}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Aggregated view only — every event here is pulled live from GET /hrm/calendar (Holiday, LeaveRequest,
// HalfDayLeaveRequest, PermissionRequest, User), never duplicated/stored on the frontend either.
const CAL_TYPE_META = {
  HOLIDAY: { label: 'Holiday', color: 'var(--orange)', bg: 'var(--orange-light)' },
  LEAVE: { label: 'Leave', color: 'var(--blue-mid)', bg: 'var(--blue-pale)' },
  HALF_DAY_LEAVE: { label: 'Half-Day Leave', color: 'var(--blue-light)', bg: 'var(--blue-pale)' },
  WFH: { label: 'WFH', color: 'var(--purple)', bg: 'var(--purple-light)' },
  PERMISSION: { label: 'Permission', color: 'var(--gold)', bg: 'var(--gold-light)' },
  JOINING: { label: 'Joining', color: 'var(--green)', bg: 'var(--green-light)' },
  BIRTHDAY: { label: 'Birthday', color: 'var(--red)', bg: 'var(--red-light)' },
  ANNIVERSARY: { label: 'Work Anniversary', color: 'var(--gold)', bg: 'var(--gold-light)' }
};

function CalendarTab() {
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterOptions, setFilterOptions] = useState({ departments: [], branches: [] });
  const [department, setDepartment] = useState('');
  const [branch, setBranch] = useState('');
  const [activeTypes, setActiveTypes] = useState(() => new Set(Object.keys(CAL_TYPE_META)));
  const [selected, setSelected] = useState(null);
  const [dayOverflow, setDayOverflow] = useState(null);

  useEffect(() => {
    api.get('/employees/filter-options').then((res) => setFilterOptions(res.data));
  }, []);

  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const from = toDateKey(new Date(year, month, 1));
  const to = toDateKey(new Date(year, month + 1, 0));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = { from, to };
    if (department) params.department = department;
    if (branch) params.branch = branch;
    api.get('/hrm/calendar', { params })
      .then((res) => { if (!cancelled) setEvents(res.data.events); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Could not load the HR Calendar.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, department, branch]);

  const eventsByDate = {};
  events.forEach((e) => {
    if (!activeTypes.has(e.type)) return;
    (eventsByDate[e.date] = eventsByDate[e.date] || []).push(e);
  });

  const grid = [];
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-start week, per spec's month example
  const gridStart = new Date(year, month, 1 - startOffset);
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    grid.push(d);
  }
  while (grid.length > 35 && grid[grid.length - 7].getMonth() !== month) {
    grid.splice(grid.length - 7, 7);
  }

  const todayKey = toDateKey(new Date());
  const todayEvents = eventsByDate[todayKey] || [];

  function toggleType(type) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  return (
    <div>
      <div className="week-nav">
        <button className="week-nav-arrow" onClick={() => setAnchor(new Date(year, month - 1, 1))}>‹</button>
        <span className="week-nav-icon"><CalendarDays size={14} /></span>
        <span className="week-nav-range">{anchor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
        <button className="week-nav-arrow" onClick={() => setAnchor(new Date(year, month + 1, 1))}>›</button>
        <button
          className="text-link"
          style={{ fontSize: 11.5, marginLeft: 8 }}
          onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); setAnchor(d); }}
        >
          This Month
        </button>
      </div>

      <div className="grid g-2" style={{ marginBottom: 14 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <select className="form-input" value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All Departments</option>
            {filterOptions.departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <select className="form-input" value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">All Branches</option>
            {filterOptions.branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div className="cal-legend">
        {Object.entries(CAL_TYPE_META).map(([type, meta]) => (
          <div
            key={type}
            className="cal-legend-item"
            style={{ cursor: 'pointer', opacity: activeTypes.has(type) ? 1 : 0.35 }}
            onClick={() => toggleType(type)}
          >
            <span className="cal-legend-dot" style={{ background: meta.color }} />
            {meta.label}
          </div>
        ))}
      </div>

      {todayEvents.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header"><span className="card-title">Today</span></div>
          <div className="card-body" style={{ padding: '4px 18px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {todayEvents.map((e) => (
              <span
                key={e.id}
                className="cal-chip"
                style={{ background: CAL_TYPE_META[e.type].bg, color: CAL_TYPE_META[e.type].color }}
                onClick={() => setSelected(e)}
              >
                {e.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="empty-state">Loading calendar…</div>}
      {error && <div className="empty-state"><div className="es-icon"><AlertTriangle size={30} /></div>{error}</div>}

      {!loading && !error && (
        <div className="cal-scroll">
          <div className="cal-weekday-row">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="cal-grid">
            {grid.map((d) => {
              const dateKey = toDateKey(d);
              const dayEvents = eventsByDate[dateKey] || [];
              const shown = dayEvents.slice(0, 3);
              const extra = dayEvents.length - shown.length;
              return (
                <div
                  key={dateKey}
                  className={'cal-cell' + (d.getMonth() !== month ? ' out-of-month' : '') + (dateKey === todayKey ? ' is-today' : '')}
                >
                  <div className="cal-daynum">{d.getDate()}</div>
                  {shown.map((e) => (
                    <div
                      key={e.id}
                      className="cal-chip"
                      style={{ background: CAL_TYPE_META[e.type].bg, color: CAL_TYPE_META[e.type].color }}
                      onClick={() => setSelected(e)}
                      title={e.title}
                    >
                      {e.title}
                    </div>
                  ))}
                  {extra > 0 && (
                    <div className="cal-chip-more" onClick={() => setDayOverflow({ dateKey, events: dayEvents })}>
                      +{extra} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && <CalendarEventModal event={selected} onClose={() => setSelected(null)} />}
      {dayOverflow && (
        <CalModal title={dayOverflow.dateKey} onClose={() => setDayOverflow(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {dayOverflow.events.map((e) => (
              <div
                key={e.id}
                className="cal-chip"
                style={{ background: CAL_TYPE_META[e.type].bg, color: CAL_TYPE_META[e.type].color, whiteSpace: 'normal', cursor: 'pointer' }}
                onClick={() => { setSelected(e); setDayOverflow(null); }}
              >
                {e.title}
              </div>
            ))}
          </div>
        </CalModal>
      )}
    </div>
  );
}

function CalModal({ title, children, onClose }) {
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

function CalRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function CalendarEventModal({ event, onClose }) {
  const navigate = useNavigate();
  const meta = CAL_TYPE_META[event.type];
  const d = event.detail || {};

  return (
    <CalModal title={meta.label} onClose={onClose}>
      {event.employee && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{event.employee.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {event.employee.designation} · {event.employee.department} · {event.employee.branch}
          </div>
        </div>
      )}
      <div style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <CalRow label="Date" value={new Date(`${event.date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
        {event.type === 'LEAVE' && (
          <>
            <CalRow label="Leave Type" value={d.leaveType} />
            <CalRow label="Duration" value={`${d.days} day(s)`} />
            <CalRow label="Reason" value={d.reason || '—'} />
          </>
        )}
        {event.type === 'WFH' && <CalRow label="Reason" value={d.reason || '—'} />}
        {event.type === 'HALF_DAY_LEAVE' && (
          <>
            <CalRow label="Half" value={d.half === 'FIRST_HALF' ? 'First Half' : 'Second Half'} />
            <CalRow label="Reason" value={d.reason || '—'} />
          </>
        )}
        {event.type === 'PERMISSION' && (
          <>
            <CalRow label="Permission Type" value={PERMISSION_TYPE_LABEL[d.permissionType]} />
            <CalRow label="Duration" value={permFmtDuration(d.durationMinutes)} />
            <CalRow label="Reason" value={d.reason || '—'} />
          </>
        )}
        {event.type === 'JOINING' && <CalRow label="Joining Date" value={new Date(d.joinDate).toLocaleDateString('en-GB')} />}
        {event.type === 'ANNIVERSARY' && <CalRow label="Years Completed" value={d.years} />}
        {event.status && <CalRow label="Status" value={event.status} />}
      </div>
      {event.employee && (
        <button className="btn btn-outline btn-sm" style={{ marginTop: 14 }} onClick={() => navigate(`/hr-admin/employee/${event.employee.id}`)}>
          View Employee
        </button>
      )}
    </CalModal>
  );
}
