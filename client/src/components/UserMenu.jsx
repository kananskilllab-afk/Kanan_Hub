import { useNavigate } from 'react-router-dom';
import { IdCard, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { assetUrl } from '../utils/assetUrl';

export default function UserMenu({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    onClose();
    navigate('/login', { replace: true });
  }

  return (
    <div className={'notif-panel user-menu-panel' + (open ? ' show' : '')}>
      <div className="user-menu-header">
        <div className="header-avatar" style={{ cursor: 'default' }}>
          {user?.avatarUrl ? <img className="avatar-img" src={assetUrl(user.avatarUrl)} alt="" /> : user?.initials || '..'}
        </div>
        <div>
          <div className="user-menu-name">{user?.name}</div>
          <div className="user-menu-email">{user?.email}</div>
        </div>
      </div>
      <div
        className="notif-item"
        onClick={() => {
          onClose();
          navigate('/profile');
        }}
      >
        <span className="notif-ico"><IdCard size={16} /></span>
        <div className="notif-text">My Profile</div>
      </div>
      <div className="notif-item user-menu-logout" onClick={handleLogout}>
        <span className="notif-ico"><LogOut size={16} /></span>
        <div className="notif-text">Log Out</div>
      </div>
    </div>
  );
}
