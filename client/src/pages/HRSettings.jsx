import { useEffect, useState } from 'react';
import { Settings, Clock, Ticket } from 'lucide-react';
import api from '../api/client';
import { toDateKey, fmtMinutes } from '../components/AttendanceRow';

const PERMISSION_TYPE_LABEL = { SHORT: 'Short Permission', LATE: 'Late Check-In', EARLY_EXIT: 'Early Check-Out' };

function fmtDurationMin(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

function fmtVersionDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function HRSettings() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1><Settings size={19} /> HR Settings</h1>
          <p>Attendance and Permission policy — every save creates a new dated version; past days keep using whatever was active at the time.</p>
        </div>
      </div>
      <div className="grid g-2" style={{ alignItems: 'start', gap: 20 }}>
        <ShiftPolicyCard />
        <PermissionPolicyCard />
      </div>
    </div>
  );
}

function VersionHistory({ show, onToggle, versions, renderRow }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <span className="text-link" style={{ fontSize: 11.5 }} onClick={onToggle}>
        {show ? 'Hide version history' : 'Show version history'}
      </span>
      {show && (
        <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '8px 10px', marginTop: 8, fontSize: 11 }}>
          {versions.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No versions yet.</div>}
          {versions.map((v) => (
            <div key={v._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '3px 0' }}>
              <span>{renderRow(v)}</span>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{v.createdBy?.name || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShiftPolicyCard() {
  const [form, setForm] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function load() {
    api.get('/hrm/shift').then((res) => {
      const s = res.data.shift;
      setForm({
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        hours: Math.floor(s.requiredMinutes / 60),
        minutes: s.requiredMinutes % 60,
        breakMinutes: s.breakMinutes,
        breakPolicy: s.breakPolicy,
        halfDayLeaveEnabled: s.halfDayLeaveEnabled,
        firstHalfEnabled: s.firstHalfEnabled,
        secondHalfEnabled: s.secondHalfEnabled,
        effectiveFrom: toDateKey(new Date()),
        changeSummary: ''
      });
    });
  }

  useEffect(load, []);

  async function loadHistory() {
    const res = await api.get('/hrm/shift/history');
    setHistory(res.data.versions);
  }

  function toggleHistory() {
    if (!showHistory) loadHistory();
    setShowHistory((v) => !v);
  }

  if (!form) return <div className="card"><div className="card-body">Loading…</div></div>;

  const requiredMinutes = form.hours * 60 + Number(form.minutes);
  const halfPreview = Math.round(requiredMinutes / 2);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/hrm/shift', {
        name: form.name,
        startTime: form.startTime,
        endTime: form.endTime,
        requiredMinutes,
        breakMinutes: Number(form.breakMinutes),
        breakPolicy: form.breakPolicy,
        halfDayLeaveEnabled: form.halfDayLeaveEnabled,
        firstHalfEnabled: form.firstHalfEnabled,
        secondHalfEnabled: form.secondHalfEnabled,
        effectiveFrom: form.effectiveFrom,
        changeSummary: form.changeSummary
      });
      load();
      setSaved(true);
      if (showHistory) loadHistory();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header"><span className="card-title"><Clock size={15} /> Attendance / Shift Policy</span></div>
      <div className="card-body">
        <VersionHistory
          show={showHistory}
          onToggle={toggleHistory}
          versions={history}
          renderRow={(v) => `${fmtVersionDate(v.effectiveFrom)} — ${fmtMinutes(v.requiredMinutes)} required${v.changeSummary ? ` — ${v.changeSummary}` : ''}`}
        />
        <form onSubmit={save}>
          <div className="form-group">
            <label className="form-label">Shift Name</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid g-2">
            <div className="form-group">
              <label className="form-label">Shift Start</label>
              <input type="time" className="form-input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Shift End</label>
              <input type="time" className="form-input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Required Working Hours</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" min="0" className="form-input" style={{ width: 80 }} value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>hrs</span>
              <input type="number" min="0" max="59" className="form-input" style={{ width: 80 }} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>min</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--blue-mid)', marginTop: 5 }}>
              Half-day hours (auto): {fmtMinutes(halfPreview)}
            </div>
          </div>
          <div className="grid g-2">
            <div className="form-group">
              <label className="form-label">Break Duration (min)</label>
              <input type="number" min="0" className="form-input" value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Break Policy</label>
              <select className="form-input" value={form.breakPolicy} onChange={(e) => setForm({ ...form, breakPolicy: e.target.value })}>
                <option value="INCLUDE_IN_SHIFT">Included in shift (no subtraction)</option>
                <option value="EXCLUDE_FROM_WORK">Excluded from working hours</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginBottom: 6 }}>
              <input type="checkbox" checked={form.halfDayLeaveEnabled} onChange={(e) => setForm({ ...form, halfDayLeaveEnabled: e.target.checked })} />
              Half-Day Leave Enabled
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginBottom: 6 }}>
              <input type="checkbox" checked={form.firstHalfEnabled} onChange={(e) => setForm({ ...form, firstHalfEnabled: e.target.checked })} />
              First Half Enabled
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              <input type="checkbox" checked={form.secondHalfEnabled} onChange={(e) => setForm({ ...form, secondHalfEnabled: e.target.checked })} />
              Second Half Enabled
            </label>
          </div>
          <div className="grid g-2">
            <div className="form-group">
              <label className="form-label">Effective From</label>
              <input type="date" className="form-input" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Change Summary</label>
              <input className="form-input" placeholder="Optional" value={form.changeSummary} onChange={(e) => setForm({ ...form, changeSummary: e.target.value })} />
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -6, marginBottom: 10 }}>
            Saving creates a new version — days before the effective date keep using whatever was active at the time.
          </p>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving}>
            {saving ? 'Saving…' : 'Save as New Version'}
          </button>
          {saved && !saving && <div style={{ fontSize: 11.5, color: 'var(--green)', marginTop: 8, textAlign: 'center' }}>✓ New version saved.</div>}
        </form>
      </div>
    </div>
  );
}

function PermissionPolicyCard() {
  const [policies, setPolicies] = useState(null);
  const [saving, setSaving] = useState('');
  const [saved, setSaved] = useState('');
  const [historyType, setHistoryType] = useState(null);
  const [history, setHistory] = useState([]);

  function load() {
    api.get('/hrm/permission-policy').then((res) => {
      const byType = {};
      res.data.policies.forEach((p) => {
        byType[p.type] = { ...p, effectiveFrom: toDateKey(new Date()), changeSummary: '' };
      });
      setPolicies(byType);
    });
  }

  useEffect(load, []);

  async function loadHistory(type) {
    const res = await api.get(`/hrm/permission-policy/${type}/history`);
    setHistory(res.data.versions);
  }

  function toggleHistory(type) {
    if (historyType === type) {
      setHistoryType(null);
    } else {
      loadHistory(type);
      setHistoryType(type);
    }
  }

  async function save(type) {
    setSaving(type);
    setSaved('');
    try {
      const p = policies[type];
      await api.put(`/hrm/permission-policy/${type}`, {
        maxDurationMinutes: Number(p.maxDurationMinutes),
        monthlyRequestLimit: Number(p.monthlyRequestLimit),
        countsAsWorkingTime: p.countsAsWorkingTime,
        enabled: p.enabled,
        effectiveFrom: p.effectiveFrom,
        changeSummary: p.changeSummary
      });
      load();
      setSaved(type);
      if (historyType === type) loadHistory(type);
    } finally {
      setSaving('');
    }
  }

  function update(type, field, value) {
    setPolicies((prev) => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  }

  return (
    <div className="card">
      <div className="card-header"><span className="card-title"><Ticket size={15} /> Permission Policy</span></div>
      <div className="card-body">
        {!policies ? (
          <div>Loading…</div>
        ) : (
          ['SHORT', 'LATE', 'EARLY_EXIT'].map((type) => {
            const p = policies[type];
            return (
              <div key={type} style={{ marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                  {PERMISSION_TYPE_LABEL[type]}
                </div>
                <VersionHistory
                  show={historyType === type}
                  onToggle={() => toggleHistory(type)}
                  versions={history}
                  renderRow={(v) => `${fmtVersionDate(v.effectiveFrom)} — ${fmtDurationMin(v.maxDurationMinutes)} max, ${v.monthlyRequestLimit}/mo${v.changeSummary ? ` — ${v.changeSummary}` : ''}`}
                />
                <div className="grid g-2">
                  <div className="form-group">
                    <label className="form-label">Max Duration (min)</label>
                    <input type="number" min="1" className="form-input" value={p.maxDurationMinutes} onChange={(e) => update(type, 'maxDurationMinutes', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Monthly Limit (requests)</label>
                    <input type="number" min="0" className="form-input" value={p.monthlyRequestLimit} onChange={(e) => update(type, 'monthlyRequestLimit', e.target.value)} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginBottom: 6 }}>
                  <input type="checkbox" checked={p.countsAsWorkingTime} onChange={(e) => update(type, 'countsAsWorkingTime', e.target.checked)} />
                  Counts As Working Time
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginBottom: 10 }}>
                  <input type="checkbox" checked={p.enabled} onChange={(e) => update(type, 'enabled', e.target.checked)} />
                  Enabled
                </label>
                <div className="grid g-2">
                  <div className="form-group">
                    <label className="form-label">Effective From</label>
                    <input type="date" className="form-input" value={p.effectiveFrom} onChange={(e) => update(type, 'effectiveFrom', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Change Summary</label>
                    <input className="form-input" placeholder="Optional" value={p.changeSummary} onChange={(e) => update(type, 'changeSummary', e.target.value)} />
                  </div>
                </div>
                <button className="btn btn-outline btn-sm" disabled={saving === type} onClick={() => save(type)}>
                  {saving === type ? 'Saving…' : 'Save as New Version'}
                </button>
                {saved === type && saving !== type && <span style={{ fontSize: 11.5, color: 'var(--green)', marginLeft: 10 }}>✓ Saved.</span>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
