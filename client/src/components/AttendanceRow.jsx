import { Wrench, Ticket } from 'lucide-react';

// Shared with Attendance.jsx (self-service) and the HR Admin Employee Profile Attendance tab
// (read-only, another employee's data) — same rendering, different data source.

export function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function sundayOf(d) {
  const s = new Date(d);
  s.setDate(d.getDate() - d.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function fmtRangeDate(d) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
}

export function fmtMinutes(min) {
  if (min == null) return '—';
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export const REASON_LABEL = {
  NORMAL: '',
  FIRST_HALF_LEAVE: 'First Half Leave',
  SECOND_HALF_LEAVE: 'Second Half Leave',
  NO_CHECK_IN: 'No Check-In',
  MISSING_CHECK_OUT: 'Missing Check-Out',
  INSUFFICIENT_WORKING_HOURS: 'Insufficient Hours',
  INSUFFICIENT_HALF_DAY_HOURS: 'Insufficient Half-Day Hours',
  REGULARIZED: 'Regularized'
};

export const STATUS_STYLE = {
  PRESENT: { color: 'var(--green)', label: null },
  HALF_DAY: { color: 'var(--blue-mid)', label: null },
  LEAVE: { color: 'var(--gold)', label: 'On Leave' },
  WFH: { color: 'var(--blue-mid)', label: 'Work From Home' },
  ON_DUTY: { color: 'var(--purple)', label: 'On Duty' },
  ABSENT: { color: 'var(--red)', label: null },
  HOLIDAY: { color: '#E0A94A', label: null },
  WEEKLY_OFF: { color: '#E0A94A', label: 'Weekly Off' },
  PENDING: { color: 'var(--border)', label: 'Not Checked In' },
  IN_PROGRESS: { color: 'var(--gold)', label: 'In Progress' }
};

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}

export default function AttendanceRow({ day, onRegularize }) {
  const dateObj = new Date(`${day.date}T00:00:00`);
  const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
  const dayNum = dateObj.getDate();
  const style = STATUS_STYLE[day.status] || STATUS_STYLE.PENDING;
  const reasonLabel = REASON_LABEL[day.reason];
  const permLabel = day.permissions?.length
    ? day.permissions.map((p) => (p.type === 'SHORT' ? 'Short Permission' : p.type === 'LATE' ? 'Late (authorized)' : 'Early Exit (authorized)')).join(', ')
    : '';
  const labelText = day.label || style.label || reasonLabel || '';

  const fullWidth = !day.checkIn;
  const lineStart = fullWidth ? 3 : 14;
  const lineEnd = fullWidth ? 97 : (day.checkOut ? 88 : 45);

  return (
    <div className="attend-row">
      <div className="attend-row-day">
        <div className="attend-row-dayname">{dayName}</div>
        <div className="attend-row-daynum">{dayNum}</div>
      </div>
      <div className="attend-row-time attend-in">{fmtTime(day.checkIn)}</div>
      <div className="attend-track">
        <div className="attend-track-dot" style={{ left: '2%' }} />
        <div className="attend-track-dot" style={{ left: '5%' }} />
        <div className="attend-track-line" style={{ left: `${lineStart}%`, right: `${100 - lineEnd}%`, background: style.color }} />
        {day.checkIn && <div className="attend-track-dot marker" style={{ left: `${lineStart}%`, background: 'var(--green)' }} />}
        {day.checkOut && <div className="attend-track-dot marker" style={{ left: `${lineEnd}%`, background: '#EF8C8C' }} />}
        {labelText && (
          <div className="attend-track-label" style={{ color: style.color }}>
            {day.regularized && <Wrench size={9} style={{ marginRight: 3, verticalAlign: -1 }} />}
            {labelText}
          </div>
        )}
        <div className="attend-track-dot" style={{ left: '95%' }} />
        <div className="attend-track-dot" style={{ left: '98%' }} />
      </div>
      <div className="attend-row-time attend-out">{fmtTime(day.checkOut)}</div>
      <div className="attend-row-hours">
        <div className="attend-row-hours-val">{fmtMinutes(day.minutesWorked)}</div>
        <div className="attend-row-hours-lbl">Hrs worked</div>
        {permLabel && (
          <div style={{ fontSize: 10, color: 'var(--purple, #7c5cff)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
            <Ticket size={10} /> {permLabel}
          </div>
        )}
      </div>
      {onRegularize && day.status === 'ABSENT' && !day.regularized && (
        <button className="btn btn-outline btn-sm" style={{ marginLeft: 10, flexShrink: 0 }} onClick={() => onRegularize(day)}>
          Fix
        </button>
      )}
    </div>
  );
}
