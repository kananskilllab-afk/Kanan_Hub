import { useEffect, useState } from 'react';
import { AlertTriangle, Users, Copy, X } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ASSIGNABLE_MODULES } from '../moduleData';
import { isTechAdminRole } from '../utils/roles';

const STATUS_CHIP = {
  ONBOARDING_PENDING: 'gray',
  EMAIL_SENT: 'blue',
  VERIFICATION_PENDING: 'gold',
  EMAIL_VERIFIED: 'blue',
  ACTIVE: 'green',
  EXPIRED: 'red',
  CANCELLED: 'red'
};

const EMPTY_FORM = {
  firstName: '', lastName: '', mobile: '', personalEmail: '', companyEmail: '',
  department: '', designation: '', branch: '', joiningDate: '', reportingManager: '', employmentType: 'Full-time'
};

export default function Employees() {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [linkModal, setLinkModal] = useState(null);
  const [accessEmployee, setAccessEmployee] = useState(null);
  const [auditEmployee, setAuditEmployee] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);

  const isAdmin = isTechAdminRole(currentUser?.role);

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const [empRes, mgrRes] = await Promise.all([api.get('/employees'), api.get('/employees/managers')]);
      setEmployees(empRes.data.employees);
      setManagers(mgrRes.data.managers);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load employees. You may not have HR/Admin access.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createEmployee(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await api.post('/employees', form);
      setEmployees((prev) => [res.data.employee, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create employee.');
    } finally {
      setSaving(false);
    }
  }

  async function sendWelcomeEmail(id) {
    const res = await api.post(`/employees/${id}/send-welcome-email`);
    setEmployees((prev) => prev.map((e) => (e.id === id ? res.data.employee : e)));
    setLinkModal({ url: res.data.verificationUrl, channel: res.data.emailChannel });
  }

  async function resendVerification(id) {
    const res = await api.post(`/employees/${id}/resend-verification`);
    setEmployees((prev) => prev.map((e) => (e.id === id ? res.data.employee : e)));
    setLinkModal({ url: res.data.verificationUrl, channel: res.data.emailChannel });
  }

  async function openAudit(emp) {
    setAuditEmployee(emp);
    const res = await api.get(`/employees/${emp.id}/audit`);
    setAuditLogs(res.data.logs);
  }

  async function saveModuleAccess(id, moduleAccess) {
    const res = await api.patch(`/employees/${id}/module-access`, { moduleAccess });
    setEmployees((prev) => prev.map((e) => (e.id === id ? res.data.employee : e)));
    setAccessEmployee(null);
  }

  if (loading) return <div className="empty-state">Loading employees…</div>;
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
          <h1><Users size={19} /> Employee Onboarding</h1>
          <p>Create employees, send verification emails, and track activation status</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '+ Add New Employee'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">New Employee Onboarding Record</span></div>
          <div className="card-body">
            {error && <div className="form-error">{error}</div>}
            <form onSubmit={createEmployee}>
              <div className="grid g-3">
                <Field label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} required />
                <Field label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} required />
                <Field label="Mobile Number" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} required />
                <Field label="Personal Email" value={form.personalEmail} onChange={(v) => setForm({ ...form, personalEmail: v })} />
                <Field label="Company Email ID" type="email" value={form.companyEmail} onChange={(v) => setForm({ ...form, companyEmail: v })} required />
                <Field label="Department" value={form.department} onChange={(v) => setForm({ ...form, department: v })} required />
                <Field label="Designation" value={form.designation} onChange={(v) => setForm({ ...form, designation: v })} required />
                <Field label="Branch" value={form.branch} onChange={(v) => setForm({ ...form, branch: v })} required />
                <Field label="Joining Date" type="date" value={form.joiningDate} onChange={(v) => setForm({ ...form, joiningDate: v })} required />
                <div className="form-group">
                  <label className="form-label">Reporting Manager</label>
                  <select className="form-input" value={form.reportingManager} onChange={(e) => setForm({ ...form, reportingManager: e.target.value })}>
                    <option value="">— None —</option>
                    {managers.map((m) => <option key={m._id} value={m._id}>{m.name} ({m.employeeId})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Employment Type</label>
                  <select className="form-input" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                    <option>Full-time</option><option>Part-time</option><option>Contract</option><option>Intern</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={saving}>
                {saving ? 'Saving…' : 'Save Onboarding Record'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><span className="card-title">Onboarding Status</span></div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Employee</th><th>Department</th><th>Email</th><th>Joining Date</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{emp.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.employeeId} · {emp.designation}</div>
                    </td>
                    <td>{emp.department}</td>
                    <td>{emp.email}</td>
                    <td>{emp.joinDate ? new Date(emp.joinDate).toLocaleDateString() : '—'}</td>
                    <td><span className={`chip ${STATUS_CHIP[emp.employeeStatus] || 'gray'}`}>{emp.employeeStatus.replace(/_/g, ' ')}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {emp.employeeStatus === 'ONBOARDING_PENDING' && (
                          <button className="btn btn-primary btn-sm" onClick={() => sendWelcomeEmail(emp.id)}>Send Welcome Email</button>
                        )}
                        {['EMAIL_SENT', 'VERIFICATION_PENDING', 'EXPIRED'].includes(emp.employeeStatus) && (
                          <button className="btn btn-outline btn-sm" onClick={() => resendVerification(emp.id)}>Resend</button>
                        )}
                        {emp.employeeStatus === 'ACTIVE' && isAdmin && (
                          <button className="btn btn-outline btn-sm" onClick={() => setAccessEmployee(emp)}>Manage Access</button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => openAudit(emp)}>Audit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {linkModal && (
        <Modal title={linkModal.channel === 'smtp' ? 'Welcome Email Sent ✓' : 'Welcome Email Sent (stub)'} onClose={() => setLinkModal(null)}>
          <p style={{ fontSize: 12.5, color: 'var(--text-mid)', marginBottom: 10 }}>
            {linkModal.channel === 'smtp'
              ? 'A real email was delivered to the employee\'s inbox with this verification link. You can also copy it directly if needed:'
              : 'No SMTP provider is configured, so the email was only logged to the server console. Use this link to complete verification for testing:'}
          </p>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, fontSize: 11.5, wordBreak: 'break-all', fontFamily: 'JetBrains Mono,monospace' }}>
            {linkModal.url}
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => { navigator.clipboard?.writeText(linkModal.url); }}>
<Copy size={13} /> Copy Link
          </button>
        </Modal>
      )}

      {accessEmployee && (
        <ModuleAccessModal
          employee={accessEmployee}
          onClose={() => setAccessEmployee(null)}
          onSave={saveModuleAccess}
        />
      )}

      {auditEmployee && (
        <Modal title={`Audit Trail — ${auditEmployee.name}`} onClose={() => { setAuditEmployee(null); setAuditLogs([]); }}>
          {auditLogs.length === 0 ? (
            <div className="empty-state">No audit entries yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Action</th><th>By</th><th>Date/Time</th></tr></thead>
                <tbody>
                  {auditLogs.map((l) => (
                    <tr key={l._id}>
                      <td>{l.action}</td>
                      <td>{l.performedBy}</td>
                      <td>{new Date(l.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required && ' *'}</label>
      <input className="form-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,27,61,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 480, maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-header">
          <span className="card-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}

function ModuleAccessModal({ employee, onClose, onSave }) {
  const [access, setAccess] = useState(() => {
    const map = {};
    (employee.moduleAccess || []).forEach((m) => { map[m.module] = m.accessRole; });
    return map;
  });

  function toggle(key, checked) {
    setAccess((prev) => {
      const next = { ...prev };
      if (checked) next[key] = next[key] || 'User';
      else delete next[key];
      return next;
    });
  }

  function setRole(key, role) {
    setAccess((prev) => ({ ...prev, [key]: role }));
  }

  function handleSave() {
    const moduleAccess = Object.entries(access).map(([module, accessRole]) => ({ module, accessRole }));
    onSave(employee.id, moduleAccess);
  }

  return (
    <Modal title={`Manage Module Access — ${employee.name}`} onClose={onClose}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        Grant access to hubs and choose whether the employee is a User or Admin within each.
      </p>
      {ASSIGNABLE_MODULES.map((m) => (
        <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
          <input type="checkbox" checked={m.key in access} onChange={(e) => toggle(m.key, e.target.checked)} />
          <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{m.label}</div>
          {m.key in access && (
            <select className="form-input" style={{ width: 110 }} value={access[m.key]} onChange={(e) => setRole(m.key, e.target.value)}>
              <option>User</option>
              <option>Admin</option>
            </select>
          )}
        </div>
      ))}
      <button className="btn btn-primary" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={handleSave}>
        Save Access
      </button>
    </Modal>
  );
}
