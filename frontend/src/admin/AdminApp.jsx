import React, { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { DashboardHome } from './DashboardHome';
import { OrdersBoard } from './OrdersBoard';
import { TwelveDayGuests } from './TwelveDayGuests';
import { MenuManager } from './MenuManager';
import { PlanManager } from './PlanManager';
import { SettingsPage } from './SettingsPage';
import { ChatPage } from './ChatPage';

function LoginForm({ onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Нэвтрэхэд алдаа гарлаа.');
      onLoggedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-muted)', padding: 20 }}>
      <form onSubmit={handleSubmit} className="card" style={{ padding: 32, width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h1 className="heading-md" style={{ marginBottom: 4 }}>Админ нэвтрэх</h1>
        {error && (
          <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px 14px', borderRadius: 10, fontSize: '0.85rem' }}>
            {error}
          </div>
        )}
        <input
          placeholder="Хэрэглэгчийн нэр"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          required
          style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.9rem' }}
        />
        <input
          placeholder="Нууц үг"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.9rem' }}
        />
        <button type="submit" disabled={loggingIn} className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.9rem' }}>
          {loggingIn ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
        </button>
      </form>
    </div>
  );
}

const TAB_LABEL = {
  dashboard: 'Dashboard',
  menu: 'Цэс',
  plan: '12 хоногийн цэс',
  orders: 'Захиалгууд',
  twelve_day_guests: '12 хоногийн захиалгууд',
  chat: 'Чат',
  settings: 'Тохиргоо',
};

function Dashboard({ onLoggedOut }) {
  const [tab, setTab] = useState('dashboard');

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    onLoggedOut();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-muted)', display: 'flex' }}>
      <Sidebar tab={tab} onSetTab={setTab} onLogout={handleLogout} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          padding: '16px 24px', background: '#fff', borderBottom: '1px solid var(--border)',
        }}>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem' }}>{TAB_LABEL[tab]}</h1>
        </header>

        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>
          {tab === 'dashboard' ? (
            <DashboardHome />
          ) : tab === 'plan' ? (
            <PlanManager />
          ) : tab === 'orders' ? (
            <OrdersBoard />
          ) : tab === 'twelve_day_guests' ? (
            <TwelveDayGuests />
          ) : tab === 'chat' ? (
            <ChatPage />
          ) : tab === 'settings' ? (
            <SettingsPage />
          ) : (
            <MenuManager />
          )}
        </main>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setAuthenticated(!!data.authenticated))
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Ачааллаж байна...</div>;
  }

  if (!authenticated) {
    return <LoginForm onLoggedIn={() => setAuthenticated(true)} />;
  }

  return <Dashboard onLoggedOut={() => setAuthenticated(false)} />;
}
