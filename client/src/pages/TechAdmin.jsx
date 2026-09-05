import { useEffect, useState } from 'react';
import { Monitor, User, Tag, Puzzle, AlertTriangle } from 'lucide-react';
import api from '../api/client';

const STATUS_LABEL = {
  ACTIVE: 'Active',
  ONBOARDING_PENDING: 'Onboarding Pending',
  EMAIL_SENT: 'Email Sent',
  VERIFICATION_PENDING: 'Verification Pending',
  EMAIL_VERIFIED: 'Email Verified',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled'
};

const ROLE_LABEL = { Employee: 'Employee', HR: 'HR', SuperAdmin: 'Super Admin', TechAdmin: 'Tech Admin' };
const MODULE_LABEL = { mykanan: 'Kanan HRM', workhub: 'Work Hub', growthhub: 'Growth Hub', helpdesk: 'Help Desk' };

const HEALTH_DOT = { HEALTHY: '🟢', CONNECTED: '🟢', WARNING: '🟡', STUB_MODE: '🟡', CRITICAL: '🔴' };

function timeAgo(iso) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr > 1 ? 's' : ''} ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export default function TechAdmin() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    api.get('/hrm/tech-dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load the Tech Admin Dashboard.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) return <div className="empty-state">Loading system dashboard…</div>;
  if (error) {
    return (
      <div className="empty-state">
        <div className="es-icon"><AlertTriangle size={30} /></div>
        {error}
        <div style={{ marginTop: 12 }}><button className="btn btn-primary btn-sm" onClick={load}>Retry</button></div>
      </div>
    );
  }

  const { users, roles, moduleAccess, systemHealth, workflow, configAlerts, recentActivity } = data;
  const totalRoles = Object.values(roles).reduce((a, b) => a + b, 0);
  const totalModuleGrants = Object.values(moduleAccess).reduce((a, b) => a + b, 0);
  const totalPending = workflow.pendingHalfDayLeave + workflow.pendingRegularization + workflow.pendingPermission;
  const totalAlerts = configAlerts.noReportingManager + configAlerts.stuckOnboarding;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1><Monitor size={19} /> Tech Admin Dashboard</h1>
          <p>System health, access, and configuration — not HR/attendance metrics (see the HR Admin dashboard for those).</p>
        </div>
      </div>

      <div className="grid g-4" style={{ marginBottom: 16 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-mid)' }}><User size={19} /></div>
          <div className="stat-info"><div className="val">{users.total}</div><div className="lbl">Total Users</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-icon" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}><Tag size={19} /></div>
          <div className="stat-info"><div className="val">{totalRoles}</div><div className="lbl">Role Assignments</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-icon" style={{ background: 'var(--gold-light)', color: 'var(--gold)' }}><Puzzle size={19} /></div>
          <div className="stat-info"><div className="val">{totalModuleGrants}</div><div className="lbl">Module Grants</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-icon" style={{ background: totalAlerts > 0 ? 'var(--red-light)' : 'var(--green-light)', color: totalAlerts > 0 ? 'var(--red)' : 'var(--green)' }}><AlertTriangle size={19} /></div>
          <div className="stat-info"><div className="val">{totalAlerts}</div><div className="lbl">Configuration Alerts</div></div>
        </div>
      </div>

      <div className="grid g-2" style={{ marginBottom: 16, alignItems: 'start', gap: 16 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">System Health</span></div>
          <div className="card-body" style={{ padding: '4px 18px' }}>
            <div className="task-item">
              <div className="task-text">Database</div>
              <span>{HEALTH_DOT[systemHealth.database.status]} {systemHealth.database.status === 'HEALTHY' ? `Healthy · ${systemHealth.database.responseMs}ms` : 'Critical'}</span>
            </div>
            <div className="task-item">
              <div className="task-text">Application Server</div>
              <span>{HEALTH_DOT[systemHealth.applicationServer.status]} {systemHealth.applicationServer.detail}</span>
            </div>
            <div className="task-item">
              <div className="task-text">Email Delivery</div>
              <span>{HEALTH_DOT[systemHealth.email.status]} {systemHealth.email.detail}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Users by Status</span></div>
          <div className="card-body" style={{ padding: '4px 18px' }}>
            {Object.entries(users.byStatus).map(([status, count]) => (
              <div className="task-item" key={status}>
                <div className="task-text">{STATUS_LABEL[status] || status}</div>
                <span className={`chip ${status === 'ACTIVE' ? 'green' : status === 'EXPIRED' || status === 'CANCELLED' ? 'red' : 'gold'}`}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid g-2" style={{ marginBottom: 16, alignItems: 'start', gap: 16 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Role Distribution</span></div>
          <div className="card-body" style={{ padding: '4px 18px' }}>
            {Object.entries(ROLE_LABEL).map(([role, label]) => (
              <div className="task-item" key={role}>
                <div className="task-text">{label}</div>
                <span className="chip blue">{roles[role] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Module Access Grants</span></div>
          <div className="card-body" style={{ padding: '4px 18px' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 10px' }}>
              Explicit grants on Employee-role accounts. HR/Super Admin/Tech Admin see every hub regardless of a grant, so they aren't counted here.
            </p>
            {Object.entries(MODULE_LABEL).map(([key, label]) => (
              <div className="task-item" key={key}>
                <div className="task-text">{label}</div>
                <span className="chip blue">{moduleAccess[key] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid g-2" style={{ marginBottom: 16, alignItems: 'start', gap: 16 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Workflow Overview</span></div>
          <div className="card-body" style={{ padding: '4px 18px' }}>
            <div className="task-item">
              <div className="task-text">Pending Half-Day Leave</div>
              <span className={`chip ${workflow.pendingHalfDayLeave > 0 ? 'gold' : 'green'}`}>{workflow.pendingHalfDayLeave}</span>
            </div>
            <div className="task-item">
              <div className="task-text">Pending Regularization</div>
              <span className={`chip ${workflow.pendingRegularization > 0 ? 'gold' : 'green'}`}>{workflow.pendingRegularization}</span>
            </div>
            <div className="task-item">
              <div className="task-text">Pending Permission</div>
              <span className={`chip ${workflow.pendingPermission > 0 ? 'gold' : 'green'}`}>{workflow.pendingPermission}</span>
            </div>
            {totalPending === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Nothing pending across any approval queue.</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Configuration Alerts</span></div>
          <div className="card-body" style={{ padding: '4px 18px' }}>
            <div className="task-item">
              <div className="task-text">Active employees with no reporting manager</div>
              <span className={`chip ${configAlerts.noReportingManager > 0 ? 'red' : 'green'}`}>{configAlerts.noReportingManager}</span>
            </div>
            <div className="task-item">
              <div className="task-text">Onboarding stuck &gt; 3 days (email/verification pending)</div>
              <span className={`chip ${configAlerts.stuckOnboarding > 0 ? 'red' : 'green'}`}>{configAlerts.stuckOnboarding}</span>
            </div>
            {totalAlerts === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No configuration issues detected.</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Recent System Activity</span></div>
        <div className="card-body" style={{ padding: recentActivity.length ? '4px 18px' : 18 }}>
          {recentActivity.length === 0 && <div className="empty-state">No recent activity.</div>}
          {recentActivity.map((a) => (
            <div className="task-item" key={a.id}>
              <div style={{ flex: 1 }}>
                <div className="task-text">{a.text}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(a.at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
