import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const nav = [
  { section: 'Operations', links: [
    ['/', 'Dashboard'], ['/suppliers', 'Suppliers'], ['/purchases', 'Purchases'], ['/cheques', 'Cheques'],
  ]},
  { section: 'Finance', links: [
    ['/revenue', 'Sales & savings'], ['/reports', 'Reports'],
  ]},
  { section: 'System', links: [
    ['/sms-log', 'SMS log'], ['/activity', 'Activity log'], ['/settings', 'Settings'],
  ]},
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <div className="brand">Cheque Manager<small>Supplier payments ledger</small></div>
        <nav className="nav">
          {nav.map(g => (
            <div key={g.section}>
              <div className="nav-section">{g.section}</div>
              {g.links.map(([to, label]) => (
                <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>{label}</NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div style={{ marginBottom: 8 }}>Signed in as <strong>{user?.username}</strong></div>
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="main">
        <button className="menu-btn" onClick={() => setOpen(true)}>☰ Menu</button>
        <Outlet />
      </main>
    </div>
  );
}
