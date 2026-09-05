import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { HUB_GROUPS, resolveHub } from '../moduleData';
import { useAuth } from '../context/AuthContext';
import { assetUrl } from '../utils/assetUrl';
import { isAdminRole, isHRMAdmin, isTechAdminRole } from '../utils/roles';

export default function Sidebar({ collapsed, mobileOpen }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isConsole = location.pathname === '/console';
  const activeHub = resolveHub(location.pathname);
  // Blanket bypass (sees every hub regardless of grants) is SuperAdmin/TechAdmin only. An HRM
  // Admin grant unlocks HRM's own admin-only items (Employee Onboarding, HR Admin, K Recruit) but
  // must NOT bypass grants for other hubs — "HR Admin does not automatically become Admin of other
  // modules" (Final Role & Module Access Logic §3/§13).
  const isBlanketAdmin = isAdminRole(user?.role);
  const isHRMAdminUser = isHRMAdmin(user);
  const isTechAdmin = isTechAdminRole(user?.role);
  const grantedHubs = new Set((user?.moduleAccess || []).map((m) => m.module));

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <nav id="sidebar" className={[collapsed ? 'collapsed' : '', mobileOpen ? 'mobile-open' : '', isConsole ? 'hidden-page' : ''].join(' ').trim()}>
      <div className="sidebar-logo">
        {collapsed ? (
          <div className="sidebar-logo-mark">K</div>
        ) : (
          <img src="/logo.jpeg" alt="Kanan.co" className="sidebar-logo-img" />
        )}
      </div>
      <div className="sidebar-nav">
        {HUB_GROUPS.map((group) => {
          // Per-item grant check (Module Mapping spec, 2026-08-25): an item can carry its own
          // moduleKey (e.g. 'crm') independent of its group's key ('workhub'), so granting CRM
          // specifically doesn't also reveal News/Knowledgebase/MOM/Reports, which still need the
          // coarser 'workhub' bucket grant. techOnly/adminOnly items ignore module grants entirely.
          const visibleItems = group.items.filter((item) => {
            if (item.techOnly) return isTechAdmin;
            if (item.adminOnly) return isHRMAdminUser; // implies the mykanan grant too
            if (isBlanketAdmin) return true;
            return grantedHubs.has(item.moduleKey || group.key);
          });
          if (visibleItems.length === 0) return null; // e.g. no modules in this hub granted at all

          const outOfFocus = activeHub && group.key !== activeHub;
          return (
            <div
              key={group.key}
              className={'hub-group' + (outOfFocus ? ' hub-hidden' : '')}
              data-hub={group.key}
            >
              <div className="hub-title">{group.title}</div>
              {visibleItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
                >
                  <span className="nav-icon"><item.icon size={16} strokeWidth={2} /></span>
                  <span className="nav-label">{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </NavLink>
              ))}
            </div>
          );
        })}
      </div>
      <div className="sidebar-user">
        <div className="user-avatar-sm">
          {user?.avatarUrl ? <img className="avatar-img" src={assetUrl(user.avatarUrl)} alt="" /> : user?.initials || '..'}
        </div>
        {!collapsed && (
          <>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div className="user-name-sm">{user?.name || 'Loading…'}</div>
              <div className="user-email-sm">{user?.email || ''}</div>
            </div>
            <button className="sidebar-logout-btn" onClick={handleLogout} title="Log Out"><LogOut size={14} /></button>
          </>
        )}
      </div>
    </nav>
  );
}
