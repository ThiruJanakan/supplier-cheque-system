"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, AuthProvider } from '@/context/AuthContext';
import { Loader } from '@/components/ui';

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

function DashboardLayoutContent({ children }) {
  const { user, isAuthed, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthed) {
      router.push('/login');
    }
  }, [isAuthed, loading, router]);

  if (loading || !isAuthed) {
    return <div style={{ marginTop: '20vh' }}><Loader text="Loading session" /></div>;
  }

  return (
    <>
      <header className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
          ☰
        </button>
        <div className="mobile-header-brand">
          Cheque Manager
        </div>
        <div style={{ fontSize: '18px', padding: '4px 8px', cursor: 'pointer', userSelect: 'none' }} title={`Signed in as ${user?.username}`}>
          👤
        </div>
      </header>

      <div className={`sidebar-backdrop ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />

      <div className="shell">
        <aside className={`sidebar ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
          <div className="brand">Cheque Manager<small>Supplier payments ledger</small></div>
          <nav className="nav">
            {nav.map(g => (
              <div key={g.section}>
                <div className="nav-section">{g.section}</div>
                {g.links.map(([to, label]) => {
                  const isActive = to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/');
                  return (
                    <Link 
                      key={to} 
                      href={to} 
                      className={isActive ? 'active' : ''}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="sidebar-foot">
            <div style={{ marginBottom: 8 }}>Signed in as <strong>{user?.username}</strong></div>
            <button onClick={logout}>Sign out</button>
          </div>
        </aside>
        <main className="main">
          <div className="route-view" key={pathname}>
            {children}
          </div>
        </main>
      </div>
    </>
  );

}

export default function DashboardLayout({ children }) {
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}
