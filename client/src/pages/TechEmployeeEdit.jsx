import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, ClipboardList, Puzzle, IdCard, Pencil, X } from 'lucide-react';
import api from '../api/client';
import { ASSIGNABLE_MODULES } from '../moduleData';

const STATUS_CHIP = {
  ONBOARDING_PENDING: 'gray', EMAIL_SENT: 'blue', VERIFICATION_PENDING: 'gold',
  EMAIL_VERIFIED: 'blue', ACTIVE: 'green', EXPIRED: 'red', CANCELLED: 'red'
};

const TABS = [
  { key: 'basic', icon: ClipboardList, label: 'Basic Details' },
  { key: 'modules', icon: Puzzle, label: 'Module Mapping' }
];

export default function TechEmployeeEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('basic');

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
        <div style={{ marginTop: 12 }}><button className="btn btn-primary btn-sm" onClick={load}>Retry</button></div>
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
          {TABS.map((t) => (
            <button
              key={t.key}
              className={'hrm-tab-primary' + (tab === t.key ? ' active' : '')}
              onClick={() => setTab(t.key)}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'basic' && <BasicDetailsTab employee={employee} onSaved={load} />}
      {tab === 'modules' && <ModuleMappingTab employee={employee} onSaved={load} />}
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

function BasicDetailsTab({ employee, onSaved }) {
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

  useEffect(() => {
    api.get('/employees/managers').then((res) => setManagers(res.data.managers));
  }, []);

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
        <div className="card-header"><span className="card-title"><IdCard size={15} /> Identity</span></div>
        <div className="card-body">
          <table>
            <tbody>
              <Row label="Employee ID" value={employee.employeeId} />
              <Row label="Name" value={employee.name} />
              <Row label="Company Email" value={employee.email} />
              <Row label="Personal Email" value={employee.personalEmail || '—'} />
              <Row label="Mobile" value={employee.mobile} />
              <Row label="Role" value={employee.role} />
              <Row label="Joining Date" value={employee.joinDate ? new Date(employee.joinDate).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' }) : '—'} />
              <Row label="Account Status" value={employee.accountStatus} />
            </tbody>
          </table>
        </div>
      </div>

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
    </div>
  );
}

const MODULE_LABEL = ASSIGNABLE_MODULES.reduce((map, m) => ({ ...map, [m.key]: m.label }), {});

function ModuleMappingTab({ employee, onSaved }) {
  const [access, setAccess] = useState(() => {
    const map = {};
    (employee.moduleAccess || []).forEach((m) => { map[m.module] = m.accessRole; });
    return map;
  });
  const [addModule, setAddModule] = useState('');
  const [addRole, setAddRole] = useState('User');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isActive = employee.employeeStatus === 'ACTIVE';

  const assignedKeys = Object.keys(access);
  const availableModules = ASSIGNABLE_MODULES.filter((m) => !assignedKeys.includes(m.key));

  function addMapping() {
    if (!addModule) return;
    setAccess((prev) => ({ ...prev, [addModule]: addRole }));
    setAddModule('');
    setAddRole('User');
    setSaved(false);
  }

  function setRole(key, role) {
    setAccess((prev) => ({ ...prev, [key]: role }));
    setSaved(false);
  }

  function remove(key) {
    setAccess((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const moduleAccess = Object.entries(access).map(([module, accessRole]) => ({ module, accessRole }));
      await api.patch(`/employees/${employee.id}/module-access`, { moduleAccess });
      setSaved(true);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header"><span className="card-title"><Puzzle size={15} /> Module Mapping</span></div>
      <div className="card-body">
        {!isActive && (
          <div className="empty-state" style={{ marginBottom: 14 }}>
            <div className="es-icon"><AlertTriangle size={30} /></div>
            Only active employees can be granted module access. This employee is {employee.employeeStatus.replace(/_/g, ' ')}.
          </div>
        )}
        {saved && <div className="chip green" style={{ marginBottom: 12 }}>✓ Saved</div>}

        <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Add Module</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <select className="form-input" style={{ flex: 1 }} value={addModule} disabled={!isActive} onChange={(e) => setAddModule(e.target.value)}>
            <option value="">Select Module</option>
            {availableModules.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <select className="form-input" style={{ width: 110 }} value={addRole} disabled={!isActive} onChange={(e) => setAddRole(e.target.value)}>
            <option>User</option>
            <option>Admin</option>
          </select>
          <button type="button" className="btn btn-outline" disabled={!addModule || !isActive} onClick={addMapping}>+ Add</button>
        </div>

        <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Assigned Modules</div>
        {assignedKeys.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>No modules assigned yet.</div>}
        {assignedKeys.map((key) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--green)' }}>●</span>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{MODULE_LABEL[key] || key}</div>
            <select
              className="form-input"
              style={{ width: 110 }}
              value={access[key]}
              disabled={!isActive}
              onChange={(e) => setRole(key, e.target.value)}
            >
              <option>User</option>
              <option>Admin</option>
            </select>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!isActive} onClick={() => remove(key)}><X size={13} /></button>
          </div>
        ))}

        <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={saving || !isActive} onClick={save}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
