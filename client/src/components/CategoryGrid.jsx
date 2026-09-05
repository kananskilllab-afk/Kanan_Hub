import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { CATEGORY_CARDS, TECH_CONFIG_CARDS, PAGE_HUB } from '../moduleData';
import { useAuth } from '../context/AuthContext';
import { isAdminRole, isHRMAdmin, isTechAdminRole } from '../utils/roles';

export default function CategoryGrid({ style }) {
  const { user } = useAuth();
  // Blanket bypass (sees every card) is SuperAdmin/TechAdmin only. An HRM Admin grant unlocks
  // HRM's own admin-only cards (K Recruit) but doesn't bypass grants for other hubs' cards — same
  // rule as Sidebar.jsx (Final Role & Module Access Logic §3/§13).
  const isBlanketAdmin = isAdminRole(user?.role);
  const isHRMAdminUser = isHRMAdmin(user);
  const grantedHubs = new Set((user?.moduleAccess || []).map((m) => m.module));

  // Tech Admin is a system/technical role — the business-app launcher (CRM, K Apply, ...) isn't
  // relevant to it, so it gets a small set of real configuration destinations instead.
  const cards = isTechAdminRole(user?.role)
    ? TECH_CONFIG_CARDS
    : isBlanketAdmin
      ? CATEGORY_CARDS
      : CATEGORY_CARDS.filter((c) => grantedHubs.has(c.moduleKey || PAGE_HUB[c.path]) && (!c.adminOnly || isHRMAdminUser));

  if (cards.length === 0) {
    return (
      <div className="empty-state" style={style}>
        <div className="es-icon"><Lock size={30} /></div>
        You don't have access to any modules yet. Ask your Admin to grant access from Employee Onboarding → Manage Access.
      </div>
    );
  }

  return (
    <div className="category-grid" style={style}>
      {cards.map((c) => (
        <Link className="category-card" to={c.path} key={c.path}>
          <div className="category-icon" style={{ background: c.bg, color: c.color }}><c.icon size={20} strokeWidth={1.9} /></div>
          <div className="category-title">{c.title}</div>
          <div className="category-sub">{c.sub}</div>
          <div className="category-desc">{c.desc}</div>
          <div className="category-arrow">→</div>
        </Link>
      ))}
    </div>
  );
}
