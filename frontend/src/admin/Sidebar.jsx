import React from 'react';
import { LayoutDashboard, UtensilsCrossed, ClipboardList, CalendarDays, Users, Settings, LogOut, MessageCircle } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'menu', label: 'Цэс', icon: UtensilsCrossed },
  { key: 'plan', label: '12 хоногийн цэс', icon: CalendarDays },
  { key: 'orders', label: 'Захиалгууд', icon: ClipboardList },
  { key: 'twelve_day_guests', label: '12 хоногийн захиалгууд', icon: Users },
  { key: 'chat', label: 'Чат', icon: MessageCircle },
  { key: 'settings', label: 'Тохиргоо', icon: Settings },
];

export function Sidebar({ tab, onSetTab, onLogout }) {
  return (
    <aside style={{
      width: 220, flexShrink: 0, minHeight: '100vh', background: '#fff',
      borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
      padding: '20px 14px', position: 'sticky', top: 0,
    }}>
      <div style={{ padding: '4px 10px 22px', fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.05rem', color: 'var(--brand-green)' }}>
        Admin
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onSetTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10, textAlign: 'left',
              fontSize: '0.88rem', fontWeight: 700,
              background: tab === key ? 'var(--brand-green)' : 'transparent',
              color: tab === key ? '#fff' : 'var(--text-body)',
            }}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      <button
        onClick={onLogout}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 10, textAlign: 'left',
          fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)',
        }}
      >
        <LogOut size={16} /> Гарах
      </button>
    </aside>
  );
}
