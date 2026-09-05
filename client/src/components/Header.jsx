import { useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, Calendar, Grid3x3, Bell, Settings } from 'lucide-react';
import NotifPanel from './NotifPanel';
import UserMenu from './UserMenu';
import { useAuth } from '../context/AuthContext';
import { assetUrl } from '../utils/assetUrl';
import api from '../api/client';

export default function Header({ collapsed, onToggleSidebar }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const headerRef = useRef(null);
  const isConsole = location.pathname === '/console';

  useEffect(() => {
    function onClickOutside(e) {
      if (!e.target.closest('.notif-panel') && !e.target.closest('#notifBtn')) setNotifOpen(false);
      if (!e.target.closest('.user-menu-panel') && !e.target.closest('#userMenuBtn')) setUserMenuOpen(false);
    }
    document.addEventListener('click', onClickOutside);
    return () => document.removeEventListener('click', onClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      api.get('/notifications/unread-count').then((res) => { if (!cancelled) setUnreadCount(res.data.count); }).catch(() => {});
    }
    poll();
    const id = setInterval(poll, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <>
      <header id="header" ref={headerRef} className={isConsole ? 'console-mode' : ''}>
        <button className="header-toggle" onClick={onToggleSidebar}><Menu size={18} /></button>
        <div className="header-title" onClick={() => navigate('/home')} title="Back to Home">
          My Kanan Hub
        </div>
        <div className="search-bar">
          <span className="search-icon"><Search size={14} /></span>
          <input type="text" placeholder="Search people, modules, documents…" />
        </div>
        <div className="header-actions">
          <button className="cal-btn" onClick={() => navigate('/hr-admin?tab=calendar')}><Calendar size={14} /> <span className="cal-btn-label">Calendar</span></button>
          <button className="hdr-btn" id="consoleBtn" title="All Modules" onClick={() => navigate('/console')}>
            <Grid3x3 size={17} />
          </button>
          <button className="hdr-btn" id="notifBtn" onClick={() => { setUserMenuOpen(false); setNotifOpen((v) => !v); }}>
            <Bell size={17} />{unreadCount > 0 && <span className="dot" />}
          </button>
          <button className="hdr-btn hdr-gear"><Settings size={17} /></button>
          <div
            className="header-avatar"
            id="userMenuBtn"
            onClick={() => { setNotifOpen(false); setUserMenuOpen((v) => !v); }}
          >
            {user?.avatarUrl ? <img className="avatar-img" src={assetUrl(user.avatarUrl)} alt="" /> : user?.initials || '..'}
          </div>
        </div>
      </header>
      <NotifPanel open={notifOpen} setUnreadCount={setUnreadCount} />
      <UserMenu open={userMenuOpen} onClose={() => setUserMenuOpen(false)} />
    </>
  );
}
