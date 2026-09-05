import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Inbox, Plus, ListChecks, Palmtree, Coins, Trophy, Megaphone, CalendarDays, CalendarClock, UserPlus, Cake, PartyPopper, IdCard, Wallet, FileText, UsersRound, AlertTriangle } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { assetUrl } from '../utils/assetUrl';
import { STATUS_STYLE } from '../components/AttendanceRow';

const AVATAR_COLORS = ['var(--blue-mid)', 'var(--green)', 'var(--gold)', 'var(--purple)', 'var(--orange)', 'var(--red)'];
function avatarColor(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

function PersonAvatar({ person, size = 34, fontSize = 12 }) {
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
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'myspace', label: 'My Space' },
  { key: 'team', label: 'Team' }
];

export default function KananHRM() {
  const [primary, setPrimary] = useState('dashboard');
  const [home, setHome] = useState(null);
  const [summary, setSummary] = useState(null);
  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [homeRes, summaryRes, weekRes] = await Promise.all([
        api.get('/hrm/home'),
        api.get('/dashboard/summary'),
        api.get('/hrm/attendance')
      ]);
      setHome(homeRes.data);
      setSummary(summaryRes.data);
      setWeek(weekRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your home page.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
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

      {primary === 'dashboard' && (
        <DashboardView home={home} summary={summary} week={week} loading={loading} error={error} onRetry={load} />
      )}
      {primary === 'myspace' && (
        <MySpaceView data={home} loading={loading} error={error} onRetry={load} />
      )}
      {primary === 'team' && <TeamView data={home} loading={loading} error={error} onRetry={load} />}
    </div>
  );
}

function DashboardView({ home, summary, week, loading, error, onRetry }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="empty-state">Loading dashboard…</div>;
  if (error) {
    return (
      <div className="empty-state">
        <div className="es-icon"><AlertTriangle size={30} /></div>
        {error}
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={onRetry}>Retry</button>
        </div>
      </div>
    );
  }

  const lb = summary.leaveBalance;
  const { upcomingHolidays, newHires, announcements, birthdays, anniversaries } = home;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const todayStatus = attendanceStatusMeta(week?.today?.status);

  return (
    <div>
      <div className="dash-hero">
        <div>
          <div className="dash-hero-greet">{greeting}, {user?.name?.split(' ')[0] || 'there'} 👋</div>
          <div className="dash-hero-sub">
            {user?.location && <span>{user.location}</span>}
            <span className="dash-status-pill" onClick={() => navigate('/attendance')}>
              <span className="dash-status-dot" style={{ background: todayStatus.color }} />
              {todayStatus.text}
            </span>
          </div>
        </div>
        <div className="dash-hero-actions">
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/tasks')}><Inbox size={14} /> My Inbox</button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/leave')}><Plus size={14} /> New Request</button>
        </div>
      </div>

      <div className="grid g-4" style={{ marginBottom: 16 }}>
        <div className="stat-card" onClick={() => navigate('/tasks')}>
          <div className="stat-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-mid)' }}><ListChecks size={19} /></div>
          <div className="stat-info">
            <div className="val">{summary.pendingTasks}</div>
            <div className="lbl">Pending Tasks</div>
          </div>
        </div>
        <div className="stat-card" onClick={() => navigate('/leave')}>
          <div className="stat-icon" style={{ background: 'var(--green-light)', color: 'var(--green)' }}><Palmtree size={19} /></div>
          <div className="stat-info">
            <div className="val">{summary.leaveRemaining}</div>
            <div className="lbl">Leave Balance</div>
            <div className="chg up">{lb.casual - lb.casualUsed} CL · {lb.sick - lb.sickUsed} SL left</div>
          </div>
        </div>
        <div className="stat-card" onClick={() => navigate('/kpoints')}>
          <div className="stat-icon" style={{ background: 'var(--gold-light)', color: 'var(--gold)' }}><Coins size={19} /></div>
          <div className="stat-info">
            <div className="val">{summary.kPoints.toLocaleString()}</div>
            <div className="lbl">K Points</div>
          </div>
        </div>
        <div className="stat-card" onClick={() => navigate('/leaderboard')}>
          <div className="stat-icon" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}><Trophy size={19} /></div>
          <div className="stat-info">
            <div className="val">#{summary.leaderboardRank}</div>
            <div className="lbl">Leaderboard Rank</div>
          </div>
        </div>
      </div>

      {week && <WeekStrip week={week} navigate={navigate} />}

      <div className="grid g-2-1" style={{ marginTop: 2, marginBottom: 16 }}>
        <div className="grid" style={{ gap: 14 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Megaphone size={15} /> Announcements</span>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/news')}>All News</button>
            </div>
            <div className="card-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
              {announcements.length === 0 && <div className="empty-state">No announcements yet.</div>}
              {announcements.map((a, i) => (
                <div
                  key={a._id}
                  className="dash-row"
                  onClick={() => navigate('/news')}
                  style={{
                    display: 'flex',
                    gap: 11,
                    padding: '12px 4px',
                    margin: '0 -4px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    borderBottom: i < announcements.length - 1 ? '1px solid var(--border)' : 'none'
                  }}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: `var(--${a.color})`, marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      <span className={`chip ${a.color}`} style={{ fontSize: 10 }}>{a.category}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid" style={{ gap: 14 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Palmtree size={15} /> Leave Balance</span>
              <LeaveRing used={lb.casualUsed + lb.sickUsed + lb.earnedUsed} total={lb.casual + lb.sick + lb.earned} />
            </div>
            <div className="card-body">
              <LeaveBar label="Casual" used={lb.casualUsed} total={lb.casual} color="var(--blue-mid)" />
              <LeaveBar label="Sick" used={lb.sickUsed} total={lb.sick} color="var(--green)" />
              <LeaveBar label="Earned" used={lb.earnedUsed} total={lb.earned} color="var(--gold)" />
              <button
                className="btn btn-outline btn-sm"
                style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                onClick={() => navigate('/leave')}
              >
                Apply Leave
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid g-2">
        <Widget icon={CalendarDays} title="Upcoming Holidays">
          {upcomingHolidays.length === 0 && <Empty text="No holidays coming up." />}
          {upcomingHolidays.map((h) => (
            <div key={h._id} className="task-item">
              <div className="task-text">{h.name}</div>
              <div className="task-due">{new Date(h.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
            </div>
          ))}
        </Widget>

        <Widget icon={UserPlus} title="New Hires">
          {newHires.length === 0 && <Empty text="No new hires in the last 30 days." />}
          {newHires.map((p) => <PersonRow key={p.id} person={p} sub={p.designation} />)}
        </Widget>

        <Widget icon={Cake} title="Upcoming Birthdays">
          {birthdays.length === 0 && <Empty text="No birthdays in the next 30 days." />}
          {birthdays.map((p) => (
            <PersonRow key={p.id} person={p} sub={new Date(p.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} />
          ))}
        </Widget>

        <Widget icon={PartyPopper} title="Work Anniversaries">
          {anniversaries.length === 0 && <Empty text="No anniversaries in the next 30 days." />}
          {anniversaries.map((p) => (
            <PersonRow key={p.id} person={p} sub={`${p.years} yr${p.years === 1 ? '' : 's'} · ${new Date(p.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`} />
          ))}
        </Widget>
      </div>
    </div>
  );
}

function MySpaceView({ data, loading, error, onRetry }) {
  if (loading) return <div className="empty-state">Loading…</div>;
  if (error) {
    return (
      <div className="empty-state">
        <div className="es-icon"><AlertTriangle size={30} /></div>
        {error}
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={onRetry}>Retry</button>
        </div>
      </div>
    );
  }

  const { profile } = data;

  return (
    <div className="card">
      <div className="card-header"><span className="card-title"><IdCard size={15} /> My Profile</span></div>
      <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <PersonAvatar person={profile} size={56} fontSize={18} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 700, fontSize: 15 }}>{profile.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{profile.designation} · {profile.department}</div>
          <div className="grid g-3" style={{ gap: 6, fontSize: 12 }}>
            <div><span style={{ color: 'var(--text-muted)' }}>ID:</span> {profile.employeeId}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>Branch:</span> {profile.branch}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>Email:</span> {profile.email}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>Mobile:</span> {profile.mobile || '—'}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>Manager:</span> {profile.manager?.name || '—'}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>Type:</span> {profile.employmentType}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Link to="/payroll" className="btn btn-outline btn-sm"><Wallet size={13} /> View Payslip</Link>
            <Link to="/policies" className="btn btn-outline btn-sm"><FileText size={13} /> Policies & SOPs</Link>
            <Link to="/profile" className="btn btn-outline btn-sm"><IdCard size={13} /> Edit Profile</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamView({ data, loading, error, onRetry }) {
  if (loading) return <div className="empty-state">Loading…</div>;
  if (error) {
    return (
      <div className="empty-state">
        <div className="es-icon"><AlertTriangle size={30} /></div>
        {error}
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={onRetry}>Retry</button>
        </div>
      </div>
    );
  }

  const { profile, myTeam } = data;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title"><UsersRound size={15} /> My Team</span>
        <span className="chip gray">{myTeam.length} report{myTeam.length === 1 ? '' : 's'}</span>
      </div>
      <div className="card-body" style={{ padding: myTeam.length ? '6px 18px' : 18 }}>
        {profile.manager && (
          <div className="task-item" style={{ background: 'var(--surface)', margin: '0 -18px', padding: '10px 18px' }}>
            <PersonAvatar person={profile.manager} size={28} fontSize={10} />
            <div style={{ flex: 1 }}>
              <div className="task-text" style={{ fontWeight: 600 }}>{profile.manager.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{profile.manager.designation} · Your Manager</div>
            </div>
          </div>
        )}
        {myTeam.length === 0 && <div className="empty-state" style={{ padding: '20px 0' }}>You have no direct reports.</div>}
        {myTeam.map((m) => <PersonRow key={m.id} person={m} sub={`${m.designation} · ${m.department}`} />)}
      </div>
    </div>
  );
}

function Widget({ icon: Icon, title, children }) {
  return (
    <div className="card">
      <div className="card-header"><span className="card-title"><Icon size={15} /> {title}</span></div>
      <div className="card-body" style={{ paddingTop: 6, paddingBottom: 6 }}>{children}</div>
    </div>
  );
}

function PersonRow({ person, sub }) {
  return (
    <div className="task-item">
      <PersonAvatar person={person} size={28} fontSize={10} />
      <div style={{ flex: 1 }}>
        <div className="task-text" style={{ fontWeight: 600 }}>{person.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
      </div>
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--text-muted)' }}>{text}</div>;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function attendanceStatusMeta(status) {
  const style = STATUS_STYLE[status];
  if (!style) return { text: 'Not Checked In', color: 'var(--text-muted)' };
  const fallback = status === 'PRESENT' ? 'Present' : status === 'ABSENT' ? 'Absent' : status.replace(/_/g, ' ');
  return { text: style.label || fallback, color: style.color === 'var(--border)' ? 'var(--text-muted)' : style.color };
}

function WeekStrip({ week, navigate }) {
  const { days, todayKey } = { days: week.days, todayKey: week.today?.date };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-title"><CalendarClock size={15} /> This Week</span>
        <button className="btn btn-outline btn-sm" onClick={() => navigate('/attendance')}>View Attendance</button>
      </div>
      <div className="card-body">
        <div className="week-strip">
          {days.map((d) => {
            const style = STATUS_STYLE[d.status] || STATUS_STYLE.PENDING;
            const dateObj = new Date(`${d.date}T00:00:00`);
            const isToday = d.date === todayKey;
            const hrs = d.minutesWorked != null ? `${Math.floor(d.minutesWorked / 60)}h ${d.minutesWorked % 60}m` : null;
            return (
              <div
                key={d.date}
                className={'week-strip-day' + (isToday ? ' is-today' : '')}
                onClick={() => navigate('/attendance')}
                title={`${dateObj.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })} · ${style.label || d.status.replace(/_/g, ' ')}${hrs ? ` · ${hrs}` : ''}`}
              >
                <div className="week-strip-dow">{WEEKDAY_SHORT[dateObj.getDay()]}</div>
                <div className="week-strip-bar" style={{ background: style.color, opacity: d.status === 'PENDING' ? 0.35 : 1 }} />
                <div className="week-strip-num">{dateObj.getDate()}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LeaveRing({ used, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const r = 15;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }} title={`${used} of ${total} leave days used`}>
      <svg width="36" height="36" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle
          cx="18" cy="18" r={r} fill="none" stroke="var(--blue-mid)" strokeWidth="4"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>{pct}% used</span>
    </div>
  );
}

function LeaveBar({ label, used, total, color }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  return (
    <div className="leave-bar">
      <div className="leave-bar-label"><span>{label}</span><span>{used}/{total}</span></div>
      <div className="leave-bar-track"><div className="leave-bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}
