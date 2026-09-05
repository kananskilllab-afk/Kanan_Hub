import { useEffect, useState } from 'react';
import { AlertTriangle, LayoutDashboard, ClipboardList, Mic, Mail, PartyPopper } from 'lucide-react';
import api from '../api/client';

export default function RecruitDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    api.get('/recruit/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load the Recruit dashboard.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) return <div className="empty-state">Loading Recruit dashboard…</div>;
  if (error) {
    return (
      <div className="empty-state">
        <div className="es-icon"><AlertTriangle size={30} /></div>
        {error}
        <div style={{ marginTop: 12 }}><button className="btn btn-primary btn-sm" onClick={load}>Retry</button></div>
      </div>
    );
  }

  const { openPositions, interviewsToday, offersSent, joiningThisWeek, todaysInterviews, pendingOffers } = data;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1><LayoutDashboard size={19} /> Kanan Recruit</h1>
          <p>Recruitment team only — hiring pipeline from job requisition through offer acceptance.</p>
        </div>
      </div>

      <div className="grid g-4" style={{ marginBottom: 16 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-mid)' }}><ClipboardList size={19} /></div>
          <div className="stat-info"><div className="val">{openPositions}</div><div className="lbl">Open Positions</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-icon" style={{ background: 'var(--gold-light)', color: 'var(--gold)' }}><Mic size={19} /></div>
          <div className="stat-info"><div className="val">{interviewsToday}</div><div className="lbl">Interviews Today</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-icon" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}><Mail size={19} /></div>
          <div className="stat-info"><div className="val">{offersSent}</div><div className="lbl">Offers Sent</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-icon" style={{ background: 'var(--green-light)', color: 'var(--green)' }}><PartyPopper size={19} /></div>
          <div className="stat-info"><div className="val">{joiningThisWeek}</div><div className="lbl">Joining This Week</div></div>
        </div>
      </div>

      <div className="grid g-2" style={{ alignItems: 'start', gap: 16 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Today's Interviews</span></div>
          <div className="card-body" style={{ padding: todaysInterviews.length ? '4px 18px' : 18 }}>
            {todaysInterviews.length === 0 && <div className="empty-state">No interviews scheduled today.</div>}
            {todaysInterviews.map((iv) => (
              <div className="task-item" key={iv._id}>
                <div style={{ flex: 1 }}>
                  <div className="task-text" style={{ fontWeight: 600 }}>{iv.candidateName} — {iv.position || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(iv.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {iv.round} · {iv.interviewer?.name || 'Unassigned'}
                  </div>
                </div>
                <span className={`chip ${iv.status === 'Completed' ? 'green' : iv.status === 'No Show' ? 'red' : 'gold'}`}>{iv.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Offers Awaiting Decision</span></div>
          <div className="card-body" style={{ padding: pendingOffers.length ? '4px 18px' : 18 }}>
            {pendingOffers.length === 0 && <div className="empty-state">No offers pending a decision.</div>}
            {pendingOffers.map((o) => (
              <div className="task-item" key={o._id}>
                <div style={{ flex: 1 }}>
                  <div className="task-text" style={{ fontWeight: 600 }}>{o.candidateName} — {o.designation}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.offerId} · Joining {new Date(o.joiningDate).toLocaleDateString()}</div>
                </div>
                <span className="chip gold">{o.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
