import { useEffect, useState } from 'react';
import { Building2, Search, AlertTriangle, Minus, LayoutGrid, Megaphone, FileText, Cake, UserPlus, Users } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { assetUrl } from '../utils/assetUrl';

const AVATAR_COLORS = ['var(--blue-mid)', 'var(--green)', 'var(--gold)', 'var(--purple)', 'var(--orange)', 'var(--red)'];
function avatarColor(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

function PersonAvatar({ person, size = 28, fontSize = 10 }) {
  if (person?.avatarUrl) {
    return <img className="avatar-img" src={assetUrl(person.avatarUrl)} alt="" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }} />;
  }
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize, background: avatarColor(person?.id) }}>
      {person?.initials}
    </div>
  );
}

const PRIMARY_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'policies', label: 'Policies' },
  { key: 'tree', label: 'Employee Tree' },
  { key: 'deptTree', label: 'Department Tree' },
  { key: 'directory', label: 'Department Directory' },
  { key: 'birthdays', label: 'Birthday Folks' },
  { key: 'newHires', label: 'New Hires' }
];

export default function Organization() {
  const [primary, setPrimary] = useState('overview');

  // Directory tab's own state — the only one driven by the search box.
  const [departments, setDepartments] = useState({});
  const [total, setTotal] = useState(0);
  const [dirLoading, setDirLoading] = useState(true);
  const [dirError, setDirError] = useState('');
  const [query, setQuery] = useState('');

  // Always-unfiltered employee list, shared by Overview/Employee Tree/Department Tree/New Hires —
  // those need the complete graph (or a true company-wide count), so none of them can reuse
  // `departments` once that's been narrowed by a Directory search.
  const [treeEmployees, setTreeEmployees] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);

  // Lazily-loaded per-tab data — fetched only once the user actually opens that tab.
  const [announcements, setAnnouncements] = useState(null);
  const [birthdays, setBirthdays] = useState(null);

  async function loadDirectory(q) {
    setDirLoading(true);
    setDirError('');
    try {
      const res = await api.get('/hrm/organization', { params: q ? { q } : {} });
      setDepartments(res.data.departments);
      setTotal(res.data.total);
    } catch (err) {
      setDirError(err.response?.data?.message || 'Could not load the organization directory.');
    } finally {
      setDirLoading(false);
    }
  }

  useEffect(() => {
    loadDirectory();
    api.get('/hrm/organization')
      .then((res) => setTreeEmployees(Object.values(res.data.departments).flat()))
      .catch(() => {})
      .finally(() => setTreeLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadDirectory(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (primary === 'announcements' && announcements === null) {
      api.get('/announcements').then((res) => setAnnouncements(res.data.announcements)).catch(() => setAnnouncements([]));
    }
    if (primary === 'birthdays' && birthdays === null) {
      api.get('/hrm/birthdays').then((res) => setBirthdays(res.data.birthdays)).catch(() => setBirthdays([]));
    }
  }, [primary, announcements, birthdays]);

  const deptNames = Object.keys(departments).sort();

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1><Building2 size={19} /> Organization</h1>
          <p>{total} active employee{total === 1 ? '' : 's'} across {deptNames.length} department{deptNames.length === 1 ? '' : 's'}</p>
        </div>
        {primary === 'directory' && (
          <div className="page-header-right">
            <div className="search-bar" style={{ margin: 0, width: 260 }}>
              <span className="search-icon"><Search size={13} /></span>
              <input type="text" placeholder="Search name, department…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
        )}
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

      {primary === 'overview' && <OverviewTab employees={treeEmployees} loading={treeLoading} />}
      {primary === 'announcements' && <AnnouncementsTab announcements={announcements} />}
      {primary === 'policies' && <PoliciesTab />}
      {primary === 'tree' && (treeLoading ? <div className="empty-state">Loading employee tree…</div> : <EmployeeTree employees={treeEmployees} />)}
      {primary === 'deptTree' && (treeLoading ? <div className="empty-state">Loading department tree…</div> : <DepartmentTree employees={treeEmployees} />)}

      {primary === 'directory' && (
        <>
          {dirLoading && <div className="empty-state">Loading directory…</div>}
          {!dirLoading && dirError && (
            <div className="empty-state">
              <div className="es-icon"><AlertTriangle size={30} /></div>
              {dirError}
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={() => loadDirectory(query)}>Retry</button>
              </div>
            </div>
          )}
          {!dirLoading && !dirError && deptNames.length === 0 && (
            <div className="empty-state">
              <div className="es-icon"><Search size={30} /></div>
              No employees match your search.
            </div>
          )}
          {!dirLoading && !dirError && deptNames.map((dept) => (
            <div className="card" key={dept} style={{ marginBottom: 14 }}>
              <div className="card-header">
                <span className="card-title">{dept}</span>
                <span className="chip gray">{departments[dept].length}</span>
              </div>
              <div className="card-body" style={{ padding: '6px 18px' }}>
                {departments[dept].map((p) => (
                  <div className="task-item" key={p.id}>
                    <PersonAvatar person={p} />
                    <div style={{ flex: 1 }}>
                      <div className="task-text" style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {p.designation} · {p.employeeId} · {p.email}
                        {p.reportingManager && <> · reports to {p.reportingManager}</>}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.branch}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {primary === 'birthdays' && <BirthdayFolksTab birthdays={birthdays} />}
      {primary === 'newHires' && (treeLoading ? <div className="empty-state">Loading new hires…</div> : <NewHiresTab employees={treeEmployees} />)}
    </div>
  );
}

function OverviewTab({ employees, loading }) {
  if (loading) return <div className="empty-state">Loading overview…</div>;

  const deptCounts = {};
  employees.forEach((e) => {
    const d = e.department || 'Unassigned';
    deptCounts[d] = (deptCounts[d] || 0) + 1;
  });
  const deptEntries = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = deptEntries[0]?.[1] || 1;
  const rootsCount = employees.filter((e) => !e.reportingManagerId).length;

  return (
    <div>
      <div className="grid g-3" style={{ marginBottom: 16 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-mid)' }}><Users size={19} /></div>
          <div className="stat-info"><div className="val">{employees.length}</div><div className="lbl">Active Employees</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-icon" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}><Building2 size={19} /></div>
          <div className="stat-info"><div className="val">{deptEntries.length}</div><div className="lbl">Departments</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-icon" style={{ background: 'var(--gold-light)', color: 'var(--gold)' }}><LayoutGrid size={19} /></div>
          <div className="stat-info"><div className="val">{rootsCount}</div><div className="lbl">Top-Level (No Manager)</div></div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Headcount by Department</span></div>
        <div className="card-body">
          {deptEntries.length === 0 && <div className="empty-state">No employees yet.</div>}
          {deptEntries.map(([dept, count]) => (
            <div key={dept} className="progress-wrap">
              <div className="progress-label"><span>{dept}</span><span>{count}</span></div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${(count / maxCount) * 100}%`, background: 'var(--blue-mid)' }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnnouncementsTab({ announcements }) {
  if (announcements === null) return <div className="empty-state">Loading announcements…</div>;
  return (
    <div className="card">
      <div className="card-header"><span className="card-title"><Megaphone size={15} /> Company Announcements</span></div>
      <div className="card-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {announcements.length === 0 && <div className="empty-state">No announcements yet.</div>}
        {announcements.map((a, i) => (
          <div
            key={a._id}
            style={{ display: 'flex', gap: 11, padding: '12px 0', borderBottom: i < announcements.length - 1 ? '1px solid var(--border)' : 'none' }}
          >
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: `var(--${a.color})`, marginTop: 5, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{a.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                <span className={`chip ${a.color}`} style={{ fontSize: 10 }}>{a.category}</span>
                {' '}· {new Date(a.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// No Policy Document model exists yet — shown honestly rather than faking sample policies.
function PoliciesTab() {
  return (
    <div className="empty-state">
      <div className="es-icon"><FileText size={30} /></div>
      Company policy documents aren't wired up to real data yet — there's no Policy Document store behind this tab.
    </div>
  );
}

function BirthdayFolksTab({ birthdays }) {
  if (birthdays === null) return <div className="empty-state">Loading birthdays…</div>;
  return (
    <div className="card">
      <div className="card-header"><span className="card-title"><Cake size={15} /> Birthday Folks</span></div>
      <div className="card-body" style={{ padding: birthdays.length ? '6px 18px' : 18 }}>
        {birthdays.length === 0 && <div className="empty-state">No employee has a date of birth on file yet.</div>}
        {birthdays.map((p) => (
          <div className="task-item" key={p.id}>
            <PersonAvatar person={p} />
            <div style={{ flex: 1 }}>
              <div className="task-text" style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.designation} · {p.department}</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {new Date(p.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              {p.daysUntil === 0 ? ' · Today!' : p.daysUntil === 1 ? ' · Tomorrow' : ` · in ${p.daysUntil}d`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewHiresTab({ employees }) {
  const sorted = [...employees].filter((e) => e.joinDate).sort((a, b) => new Date(b.joinDate) - new Date(a.joinDate));
  return (
    <div className="card">
      <div className="card-header"><span className="card-title"><UserPlus size={15} /> New Hires</span></div>
      <div className="card-body" style={{ padding: sorted.length ? '6px 18px' : 18 }}>
        {sorted.length === 0 && <div className="empty-state">No join dates on file yet.</div>}
        {sorted.map((p) => (
          <div className="task-item" key={p.id}>
            <PersonAvatar person={p} />
            <div style={{ flex: 1 }}>
              <div className="task-text" style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.designation} · {p.department}</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {new Date(p.joinDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Reporting-hierarchy view, built from the same real employee list as the Directory tab (just
// linked by reportingManagerId instead of grouped by department). Employees with no manager are
// the tree's roots; everyone else nests under whoever they report to. Real data only — an
// employee with no reports simply has no expand affordance, nothing is padded or invented.
function EmployeeTree({ employees }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(() => new Set(employees.filter((p) => !p.reportingManagerId).map((p) => p.id)));

  if (employees.length === 0) {
    return <div className="empty-state">No employees to show.</div>;
  }

  const childrenByManager = new Map();
  employees.forEach((p) => {
    if (!p.reportingManagerId) return;
    if (!childrenByManager.has(p.reportingManagerId)) childrenByManager.set(p.reportingManagerId, []);
    childrenByManager.get(p.reportingManagerId).push(p);
  });

  const downlineCache = new Map();
  function countDownline(id) {
    if (downlineCache.has(id)) return downlineCache.get(id);
    const kids = childrenByManager.get(id) || [];
    const count = kids.reduce((sum, k) => sum + 1 + countDownline(k.id), 0);
    downlineCache.set(id, count);
    return count;
  }

  const roots = employees.filter((p) => !p.reportingManagerId);

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Reporting Hierarchy</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click a card to expand or collapse their team</span>
      </div>
      <div className="card-body" style={{ overflowX: 'auto', padding: '20px 24px' }}>
        {roots.length === 0 ? (
          <div className="empty-state">No employee without a reporting manager was found to anchor the tree.</div>
        ) : (
          <div className="org-tree">
            {roots.map((r) => (
              <OrgTreeNode
                key={r.id}
                person={r}
                childrenByManager={childrenByManager}
                countDownline={countDownline}
                expanded={expanded}
                onToggle={toggle}
                meId={user?.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrgTreeNode({ person, childrenByManager, countDownline, expanded, onToggle, meId }) {
  const kids = childrenByManager.get(person.id) || [];
  const isOpen = expanded.has(person.id);
  const total = kids.length ? countDownline(person.id) : 0;

  return (
    <div className="org-tree-row">
      <div
        className={'org-tree-card' + (kids.length ? ' has-children' : '') + (person.id === meId ? ' is-me' : '')}
        onClick={() => kids.length && onToggle(person.id)}
        title={kids.length ? `${person.name} · ${total} in team — click to ${isOpen ? 'collapse' : 'expand'}` : person.name}
      >
        <PersonAvatar person={person} size={36} fontSize={12} />
        <div className="org-tree-info">
          <div className="org-tree-name">{person.name}</div>
          <div className="org-tree-desig">{person.designation}</div>
        </div>
        {kids.length > 0 && (
          <span className="org-tree-badge">{isOpen ? <Minus size={11} /> : total}</span>
        )}
      </div>
      {isOpen && kids.length > 0 && (
        <div className="org-tree-children">
          {kids.map((k) => (
            <OrgTreeNode
              key={k.id}
              person={k}
              childrenByManager={childrenByManager}
              countDownline={countDownline}
              expanded={expanded}
              onToggle={onToggle}
              meId={meId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Grouped by department instead of by manager — a department is a synthetic root (not a real
// employee), its children are simply everyone in it. One level deep only: unlike Employee Tree,
// this isn't a reporting hierarchy, so there's nothing further to nest under a person here.
function DepartmentTree({ employees }) {
  const [expanded, setExpanded] = useState(() => new Set());

  if (employees.length === 0) {
    return <div className="empty-state">No employees to show.</div>;
  }

  const byDept = new Map();
  employees.forEach((e) => {
    const dept = e.department || 'Unassigned';
    if (!byDept.has(dept)) byDept.set(dept, []);
    byDept.get(dept).push(e);
  });

  function toggle(dept) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept); else next.add(dept);
      return next;
    });
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Departments</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click a department to see who's in it</span>
      </div>
      <div className="card-body" style={{ overflowX: 'auto', padding: '20px 24px' }}>
        <div className="org-tree">
          {[...byDept.entries()].map(([dept, people]) => (
            <div className="org-tree-row" key={dept}>
              <div className="org-tree-card has-children" onClick={() => toggle(dept)}>
                <div className="org-tree-dept-icon"><Building2 size={16} /></div>
                <div className="org-tree-info">
                  <div className="org-tree-name">{dept}</div>
                  <div className="org-tree-desig">{people.length} employee{people.length === 1 ? '' : 's'}</div>
                </div>
                <span className="org-tree-badge">{expanded.has(dept) ? <Minus size={11} /> : people.length}</span>
              </div>
              {expanded.has(dept) && (
                <div className="org-tree-children">
                  {people.map((p) => (
                    <div className="org-tree-row" key={p.id}>
                      <div className="org-tree-card">
                        <PersonAvatar person={p} size={36} fontSize={12} />
                        <div className="org-tree-info">
                          <div className="org-tree-name">{p.name}</div>
                          <div className="org-tree-desig">{p.designation}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
