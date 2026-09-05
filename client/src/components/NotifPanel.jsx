import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palmtree, Home, SunMoon, Wrench, Ticket, Bell } from 'lucide-react';
import api from '../api/client';

// Event name -> icon, matching the icons already used for these request types elsewhere in the app
// (AttendanceRow's Wrench regularized badge, the Ticket permission badge, etc).
const EVENT_ICON = {
  LEAVE_CREATED: Palmtree,
  WFH_CREATED: Home,
  HALF_DAY_LEAVE_CREATED: SunMoon,
  HALF_DAY_LEAVE_APPROVED: SunMoon,
  HALF_DAY_LEAVE_REJECTED: SunMoon,
  REGULARIZATION_CREATED: Wrench,
  REGULARIZATION_APPROVED: Wrench,
  REGULARIZATION_REJECTED: Wrench,
  PERMISSION_CREATED: Ticket,
  PERMISSION_APPROVED: Ticket,
  PERMISSION_REJECTED: Ticket
};

function timeAgo(iso) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr > 1 ? 's' : ''} ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export default function NotifPanel({ open, setUnreadCount }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get('/notifications').then((res) => {
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.notifications.filter((n) => n.status === 'Unread').length);
    }).finally(() => setLoading(false));
  }, [open]);

  async function markAllRead() {
    await api.patch('/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, status: 'Read' })));
    setUnreadCount(0);
  }

  async function openNotification(n) {
    if (n.status === 'Unread') {
      api.patch(`/notifications/${n._id}/read`);
      setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, status: 'Read' } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (n.link) navigate(n.link);
  }

  return (
    <div className={'notif-panel' + (open ? ' show' : '')}>
      <div className="notif-header">
        Notifications
        {notifications.some((n) => n.status === 'Unread') && (
          <span style={{ fontSize: 11, color: 'var(--blue-mid)', fontWeight: 500, cursor: 'pointer' }} onClick={markAllRead}>
            Mark all read
          </span>
        )}
      </div>
      {loading && <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>}
      {!loading && notifications.length === 0 && (
        <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--text-muted)' }}>No notifications yet.</div>
      )}
      {!loading && notifications.map((n) => (
        <div className={'notif-item' + (n.status === 'Unread' ? ' unread' : '')} key={n._id} onClick={() => openNotification(n)}>
          <span className="notif-ico">{EVENT_ICON[n.event] || '🔔'}</span>
          <div>
            <div className="notif-text">{n.title}{n.body && ` — ${n.body}`}</div>
            <div className="notif-time">{timeAgo(n.createdAt)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
