import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { bindLegacyNavigate, installLegacyGlobals } from '../legacy/legacyBridge';

const MOBILE_BREAKPOINT = 900;

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    installLegacyGlobals();
    bindLegacyNavigate(navigate);
  }, [navigate]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  function toggleSidebar() {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      setMobileNavOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  }

  return (
    <>
      <Sidebar collapsed={collapsed} mobileOpen={mobileNavOpen} />
      {mobileNavOpen && <div className="sidebar-backdrop" onClick={() => setMobileNavOpen(false)} />}
      <div id="main">
        <Header collapsed={collapsed} onToggleSidebar={toggleSidebar} />
        <div id="content">
          <div className="page">
            <Outlet />
          </div>
        </div>
      </div>
    </>
  );
}
