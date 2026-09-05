import {
  Home, Clock, Palmtree, Building2, Users, ShieldCheck,
  Monitor, Settings, Puzzle,
  LayoutDashboard, ClipboardList, Mic, Mail,
  Megaphone, Target, GraduationCap, Plane, ConciergeBell, PartyPopper, BookOpen, ListChecks, NotebookPen, BarChart3,
  Sprout, Heart, Trophy, Coins, Award,
  LifeBuoy, Briefcase, Landmark, PackagePlus,
  IdCard, UserSearch
} from 'lucide-react';

export const HUB_GROUPS = [
  {
    key: 'mykanan',
    title: 'Kanan HRM',
    items: [
      { path: '/home', icon: Home, label: 'Home' },
      { path: '/attendance', icon: Clock, label: 'Attendance' },
      { path: '/leave', icon: Palmtree, label: 'Leave Tracker', badge: 2 },
      { path: '/organization', icon: Building2, label: 'Organization' },
      { path: '/employees', icon: Users, label: 'Employee Onboarding', adminOnly: true },
      { path: '/hr-admin', icon: ShieldCheck, label: 'HR Admin', adminOnly: true }
    ]
  },
  {
    // Tech Admin sits above Super Admin (Revised HRM Role Hierarchy) — it's system/technical
    // authority, not a Kanan HRM business feature, so it gets its own top-level sidebar section
    // rather than being nested under "Kanan HRM". Every item here is techOnly, so this whole group
    // only ever renders for a TechAdmin user (see Sidebar.jsx's empty-group filtering).
    key: 'techadmin',
    title: 'Tech Admin',
    assignable: false, // not a real hub employees get granted into — techOnly items handle its own gating
    items: [
      { path: '/tech-admin', icon: Monitor, label: 'Dashboard', techOnly: true },
      { path: '/hr-settings', icon: Settings, label: 'HR Settings', techOnly: true },
      { path: '/module-config', icon: Puzzle, label: 'Module Configuration', techOnly: true }
    ]
  },
  {
    // Kanan Recruit spec §1/§15: "not visible to normal employees... only Recruit Team gets Recruit
    // module access." Its own hub (not nested under Kanan HRM) so visibility is purely grant-based
    // (grantedHubs.has('recruit')) — same mechanism as Work Hub/Growth Hub/Help Desk, no special-
    // casing needed. Admin-vs-User within Recruit (e.g. who can create requisitions/offers) is
    // enforced page-by-page against isModuleAdmin(user, 'recruit') — see client/src/utils/roles.js.
    key: 'recruit',
    title: 'Kanan Recruit',
    items: [
      { path: '/recruitment', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/recruitment/requisitions', icon: ClipboardList, label: 'Job Requisitions' },
      { path: '/recruitment/interviews', icon: Mic, label: 'Interviews' },
      { path: '/recruitment/offers', icon: Mail, label: 'Offers' }
    ]
  },
  {
    key: 'workhub',
    title: 'Work Hub',
    items: [
      { path: '/news', icon: Megaphone, label: 'News & Announcements', badge: 3 },
      { path: '/crm', icon: Target, label: 'CRM – Lead Management', moduleKey: 'crm' },
      { path: '/coaching', icon: GraduationCap, label: 'Coaching Module', moduleKey: 'coaching' },
      { path: '/kapply', icon: Plane, label: 'K Apply – Admissions', moduleKey: 'kapply' },
      { path: '/vas', icon: ConciergeBell, label: 'VAS – Services', moduleKey: 'vas' },
      { path: '/events', icon: PartyPopper, label: 'Events', moduleKey: 'events' },
      { path: '/kb', icon: BookOpen, label: 'Knowledgebase' },
      { path: '/tasks', icon: ListChecks, label: 'My Tasks', badge: 5, moduleKey: 'tasks' },
      { path: '/mom', icon: NotebookPen, label: 'MOM – Meetings' },
      { path: '/reports', icon: BarChart3, label: 'Reports & Performance' }
    ]
  },
  {
    key: 'growthhub',
    title: 'Growth Hub',
    items: [
      { path: '/training', icon: Sprout, label: 'Training & Development' },
      { path: '/culture', icon: Heart, label: 'Culture & Engagement' },
      { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
      { path: '/kpoints', icon: Coins, label: 'K Points – Rewards' },
      { path: '/badges', icon: Award, label: 'K Badge System' }
    ]
  },
  {
    key: 'helpdesk',
    title: 'Help Desk',
    items: [
      { path: '/helpdesk', icon: LifeBuoy, label: 'Support / Help Desk', badge: 1 },
      { path: '/assets', icon: Briefcase, label: 'Asset & Resources' },
      { path: '/rooms', icon: Landmark, label: 'Room / Auditorium Booking' },
      { path: '/requests', icon: PackagePlus, label: 'Request / Submit Asset' }
    ]
  }
];

// Module Mapping spec (2026-08-25): the flat list Tech Admin picks from when mapping an employee.
// K Apply/Coaching/CRM/VAS/Events/Task Management are independently grantable (split out of the
// old "Work Hub" bundle); 'workhub' remains as a catch-all for the Work Hub pages NOT named in the
// spec's dropdown (News, Knowledgebase, MOM, Reports), and 'growthhub' likewise isn't in the
// spec's own list but is kept selectable so its 5 pages (Training/Culture/Leaderboard/K Points/
// Badges) stay reachable — otherwise granting nothing else would make them permanently invisible.
export const ASSIGNABLE_MODULES = [
  { key: 'mykanan', label: 'Kanan HRM' },
  { key: 'kapply', label: 'K Apply — Admissions' },
  { key: 'coaching', label: 'Coaching Module' },
  { key: 'crm', label: 'CRM — Lead Management' },
  { key: 'vas', label: 'VAS Services' },
  { key: 'events', label: 'Events' },
  { key: 'tasks', label: 'Task Management' },
  { key: 'workhub', label: 'Work Hub — Other (News, Knowledgebase, MOM, Reports)' },
  { key: 'growthhub', label: 'Growth Hub (Training, Culture, Leaderboard, K Points, Badges)' },
  { key: 'helpdesk', label: 'Helpdesk (Support, Assets, Rooms, Requests)' },
  { key: 'recruit', label: 'Kanan Recruit' }
];

// Route -> hub key, used to scope the sidebar to only the relevant group.
// Console ('/console') is intentionally excluded so it shows the full sidebar.
export const PAGE_HUB = HUB_GROUPS.reduce((map, group) => {
  group.items.forEach((item) => {
    map[item.path] = group.key;
  });
  return map;
}, {});

// PAGE_HUB is an exact-path lookup, so a nested/dynamic route with no sidebar entry of its own
// (e.g. /module-config/employee/:id, /hr-admin/employee/:id) resolves to nothing and the sidebar
// falls back to showing every hub. This matches the current path against the nearest registered
// parent path instead, so sub-routes stay scoped to their parent's hub.
export function resolveHub(pathname) {
  if (PAGE_HUB[pathname]) return PAGE_HUB[pathname];
  const match = Object.keys(PAGE_HUB)
    .filter((p) => pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_HUB[match] : undefined;
}

export const CATEGORY_CARDS = [
  {
    path: '/home',
    moduleKey: 'mykanan',
    icon: IdCard,
    bg: 'var(--blue-pale)',
    color: 'var(--blue-mid)',
    title: 'Kanan HRM',
    sub: 'Employee Self-Service',
    desc: 'Your profile, team, attendance, leave tracker and company organization — all in one place.'
  },
  {
    path: '/kapply',
    moduleKey: 'kapply',
    icon: Plane,
    bg: 'var(--red-light)',
    color: 'var(--red)',
    title: 'K Apply — Admissions',
    sub: '600+ Partner Institutions',
    desc: 'Process student applications across partner institutions in Canada, USA, UK, Germany and Dubai.'
  },
  {
    path: '/coaching',
    moduleKey: 'coaching',
    icon: GraduationCap,
    bg: 'var(--blue-pale)',
    color: 'var(--blue-mid)',
    title: 'Coaching Module',
    sub: 'eLearning Platform',
    desc: 'Deliver live classes, mock tests, lessons and practice exams for study-abroad success.'
  },
  {
    path: '/crm',
    moduleKey: 'crm',
    icon: Target,
    bg: 'var(--orange-light)',
    color: 'var(--orange)',
    title: 'CRM — Lead Management',
    sub: 'Sales & Leads',
    desc: 'Track, assign and convert leads across all branches and counsellors.'
  },
  {
    path: '/vas',
    moduleKey: 'vas',
    icon: ConciergeBell,
    bg: 'var(--purple-light)',
    color: 'var(--purple)',
    title: 'VAS Services',
    sub: 'Holistic Student Services',
    desc: 'Provide loans, SOP support, remittance, tickets, insurance and other essential student services.'
  },
  {
    path: '/events',
    moduleKey: 'events',
    icon: PartyPopper,
    bg: 'var(--gold-light)',
    color: 'var(--gold)',
    title: 'Events',
    sub: 'Virtual Education Fairs',
    desc: 'Conduct study-abroad fairs that help nurture your existing leads and build traction.'
  },
  {
    path: '/training',
    moduleKey: 'growthhub',
    icon: Sprout,
    bg: 'var(--green-light)',
    color: 'var(--green)',
    title: 'Growth Hub',
    sub: 'Train the Team',
    desc: 'Training & development, culture, leaderboards, K Points and badge achievements.'
  },
  {
    path: '/tasks',
    moduleKey: 'tasks',
    icon: ListChecks,
    bg: 'var(--blue-pale)',
    color: 'var(--blue-mid)',
    title: 'Task Management',
    sub: 'Productivity Tracker',
    desc: 'A smart task manager for seamless tracking, collaboration and MOM logging.'
  },
  {
    path: '/helpdesk',
    moduleKey: 'helpdesk',
    icon: LifeBuoy,
    bg: 'var(--red-light)',
    color: 'var(--red)',
    title: 'Helpdesk',
    sub: 'Support Hub',
    desc: 'Submit queries online and track resolution progress seamlessly.'
  },
  {
    path: '/recruitment',
    moduleKey: 'recruit',
    icon: UserSearch,
    bg: 'var(--blue-pale)',
    color: 'var(--blue-mid)',
    title: 'Kanan Recruit',
    sub: 'Hiring & Recruitment',
    desc: 'Post openings, track candidates through the pipeline, and manage interviews and offers.'
    // No adminOnly here — visibility is purely grant-based (hub 'recruit'), matching the sidebar.
  }
];

// Tech Admin's Console shows this instead of CATEGORY_CARDS (see CategoryGrid.jsx) — business-app
// launcher cards (CRM, K Apply, etc.) aren't relevant to a system/technical role. Only real,
// actionable configuration surfaces are listed here — nothing that points at an unbuilt feature.
export const TECH_CONFIG_CARDS = [
  {
    path: '/tech-admin',
    icon: Monitor,
    bg: 'var(--blue-pale)',
    color: 'var(--blue-mid)',
    title: 'Tech Admin Dashboard',
    sub: 'System Overview',
    desc: 'Users, roles, module access, system health, pending workflows and configuration alerts.'
  },
  {
    path: '/hr-settings',
    icon: Settings,
    bg: 'var(--purple-light)',
    color: 'var(--purple)',
    title: 'HR Settings',
    sub: 'Policy Configuration',
    desc: 'Configure the Attendance/Shift Policy and Permission Policy — every change is versioned and dated.'
  },
  {
    path: '/module-config',
    icon: Puzzle,
    bg: 'var(--gold-light)',
    color: 'var(--gold)',
    title: 'Module Configuration',
    sub: 'Access Matrix',
    desc: 'Grant or revoke which hubs every active employee can access, one module at a time.'
  }
];
