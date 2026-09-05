import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Puzzle } from 'lucide-react';
import api from '../api/client';
import { ASSIGNABLE_MODULES } from '../moduleData';

const ROLE_LABEL = { Employee: 'Employee', HR: 'HR', SuperAdmin: 'Super Admin', TechAdmin: 'Tech Admin' };
const STATUS_LABEL = {
  ACTIVE: 'Active',
  ONBOARDING_PENDING: 'Onboarding Pending',
  EMAIL_SENT: 'Email Sent',
  VERIFICATION_PENDING: 'Verification Pending',
  EMAIL_VERIFIED: 'Email Verified',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled'
};
const HUB_TITLE = ASSIGNABLE_MODULES.reduce((map, m) => ({ ...map, [m.key]: m.label }), {});

const EMPTY_FILTER = { name: '', email: '', mobile: '', role: '', status: '' };

export default function ModuleConfig() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterForm, setFilterForm] = useState(EMPTY_FILTER);
  const [appliedFilter, setAppliedFilter] = useState(EMPTY_FILTER);

  function load() {
    setLoading(true);
    setError('');
    api.get('/employees')
      .then((res) => setEmployees(res.data.employees))
      .catch((err) => setError(err.response?.data?.message || 'Could not load employees.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) return <div className="empty-state">Loading module configuration…</div>;
  if (error) {
    return (
      <div className="empty-state">
        <div className="es-icon"><AlertTriangle size={30} /></div>
        {error}
        <div style={{ marginTop: 12 }}><button className="btn btn-primary btn-sm" onClick={load}>Retry</button></div>
      </div>
    );
  }

  const filtered = employees
    .filter((e) => !appliedFilter.name || e.name.toLowerCase().includes(appliedFilter.name.toLowerCase()))
    .filter((e) => !appliedFilter.email || (e.email || '').toLowerCase().includes(appliedFilter.email.toLowerCase()))
    .filter((e) => !appliedFilter.mobile || (e.mobile || '').includes(appliedFilter.mobile))
    .filter((e) => !appliedFilter.role || e.role === appliedFilter.role)
    .filter((e) => !appliedFilter.status || e.employeeStatus === appliedFilter.status)
    .sort((a, b) => a.name.localeCompare(b.name));

  function applyFilter(e) {
    e.preventDefault();
    setAppliedFilter(filterForm);
  }

  function resetFilter() {
    setFilterForm(EMPTY_FILTER);
    setAppliedFilter(EMPTY_FILTER);
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1><Puzzle size={19} /> Module Configuration</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <form onSubmit={applyFilter}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Filter</div>
            <div className="grid g-3" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Admin Name</label>
                <input className="form-input" placeholder="Enter Admin Name" value={filterForm.name} onChange={(e) => setFilterForm({ ...filterForm, name: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email ID</label>
                <input className="form-input" placeholder="Enter Email" value={filterForm.email} onChange={(e) => setFilterForm({ ...filterForm, email: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Mobile No</label>
                <input className="form-input" placeholder="Enter Mobile" value={filterForm.mobile} onChange={(e) => setFilterForm({ ...filterForm, mobile: e.target.value })} />
              </div>
            </div>
            <div className="grid g-3" style={{ marginBottom: 14, alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Admin Role</label>
                <select className="form-input" value={filterForm.role} onChange={(e) => setFilterForm({ ...filterForm, role: e.target.value })}>
                  <option value="">Select Admin Role</option>
                  {Object.entries(ROLE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Status</label>
                <select className="form-input" value={filterForm.status} onChange={(e) => setFilterForm({ ...filterForm, status: e.target.value })}>
                  <option value="">All</option>
                  {Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" type="submit">Filter</button>
                <button className="btn btn-outline" type="button" onClick={resetFilter}>Reset</button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Employee Access</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{filtered.length} employee{filtered.length === 1 ? '' : 's'}</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Admin Name</th>
                  <th>Email ID</th>
                  <th>Mobile No</th>
                  <th>Department</th>
                  <th>Admin Role</th>
                  <th>Status</th>
                  <th>Module Access</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{emp.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.employeeId}</div>
                    </td>
                    <td>{emp.email}</td>
                    <td>{emp.mobile || '—'}</td>
                    <td>{emp.department || '—'}</td>
                    <td>{ROLE_LABEL[emp.role] || emp.role}</td>
                    <td><span className={`chip ${emp.employeeStatus === 'ACTIVE' ? 'green' : emp.employeeStatus === 'EXPIRED' || emp.employeeStatus === 'CANCELLED' ? 'red' : 'gold'}`}>{STATUS_LABEL[emp.employeeStatus] || emp.employeeStatus}</span></td>
                    <td>
                      {(emp.moduleAccess || []).length === 0 ? (
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>No Access</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {emp.moduleAccess.map((m) => (
                            <span key={m.module} className="chip blue" style={{ fontSize: 10.5 }}>
                              {HUB_TITLE[m.module] || m.module} · {m.accessRole}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => navigate(`/module-config/employee/${emp.id}`)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8}><div className="empty-state">No employees match this filter.</div></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
