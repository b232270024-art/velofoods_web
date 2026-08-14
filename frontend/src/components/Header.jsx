import React from 'react';
import { ShoppingBag, Globe, Sun, Moon, User, Receipt } from 'lucide-react';
import { LANGUAGES } from '../i18n/translations';
import { useTheme } from '../lib/useTheme';

export function Header({ session, cartCount, cartTotal, onOpenCart, language, onSetLanguage, showCart, tr, onOpenAbout, onOpenMenu, onBackToHome, hasOrderHistory, onOpenHistory }) {
  const [langOpen, setLangOpen] = React.useState(false);
  const { theme, toggleTheme } = useTheme();
  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <header className="navbar">
      <div className="container">
        <div className="navbar-inner">
          <div
            onClick={onBackToHome}
            style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, overflow: 'hidden', cursor: 'pointer' }}
          >
            <img
              src="/velofoods.jpeg"
              alt="Velofoods"
              style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                objectFit: 'cover',
              }}
            />
            <span style={{
              fontFamily: 'Outfit, sans-serif', fontWeight: 1000, fontSize: '1.15rem',
              color: 'var(--text-black)', lineHeight: 1, letterSpacing: '-0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              Velofoods
            </span>
          </div>
          <nav className="nav-links">
            {/* Түр хугацаагаар нуусан: "About Us" / "Meet our partner" линк */}
            <span className="nav-link" onClick={onOpenMenu} style={{ fontWeight: 800, color: 'var(--text-black)' }}>{tr.navMenu}</span>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
            {session && (
              <div style={{
                background: '#ecfdf5', border: '1px solid #a7f3d0',
                padding: '5px 14px', borderRadius: 'var(--r-full)',
                display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
                color: '#047857', fontWeight: 600, fontSize: '0.85rem',
              }}>
                <User size={14} />
                <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.guest_name}</span>
                {session.room_number && (
                  <span style={{ background: '#10b981', color: 'white', padding: '2px 8px', borderRadius: 8, fontSize: '0.75rem' }}>
                    {tr.room} {session.room_number}
                  </span>
                )}
              </div>
            )}

            {hasOrderHistory && (
              <button
                id="order-history-btn"
                onClick={onOpenHistory}
                title={tr.orderHistoryBtn}
                style={{
                  width: 38, height: 38, borderRadius: 'var(--r-lg)', flexShrink: 0,
                  background: 'var(--bg-white)', border: 'var(--border-header)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-dark)',
                }}
              >
                <Receipt size={17} />
              </button>
            )}

            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              style={{
                width: 38, height: 38, borderRadius: 'var(--r-lg)', flexShrink: 0,
                background: 'var(--bg-white)', border: 'var(--border-header)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-dark)',
              }}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setLangOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 'var(--r-sm)',
                  background: 'var(--bg-muted)', border: '1px solid var(--border)',
                  fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-dark)',
                }}
              >
                <span className="lang-label">{currentLang.label}</span>
                <Globe size={14} style={{ color: 'var(--text-muted)' }} />
              </button>

              {langOpen && (
                <div className="anim-fade-in" style={{
                  position: 'absolute', top: 'calc(100% + 8px)',
                  right: 0, minWidth: 160,
                  background: 'var(--bg-white)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)',
                  overflow: 'hidden', zIndex: 200,
                }}>
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => { onSetLanguage(lang.code); setLangOpen(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '10px 14px',
                        background: lang.code === language ? 'var(--bg-white)' : 'transparent',
                        fontWeight: lang.code === language ? 700 : 500,
                        fontSize: '0.875rem', color: 'var(--text-dark)',
                        borderBottom: '1px solid var(--border)',
                        textAlign: 'left',
                      }}
                    >
                      <span>{lang.name}</span>
                      {lang.code === language && <span style={{ marginLeft: 'auto', color: 'var(--brand-green-light)' }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {showCart && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {cartCount > 0 && (
                  <span
                    key={cartTotal}
                    className="anim-bump"
                    style={{
                      fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.9rem',
                      color: 'var(--brand-green)', background: 'var(--bg-white)',
                      padding: '6px 12px', borderRadius: 'var(--r-full)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ${Number(cartTotal || 0).toFixed(2)}
                  </span>
                )}
                <button
                  id="cart-btn"
                  onClick={onOpenCart}
                  style={{
                    position: 'relative', width: 44, height: 44,
                    borderRadius: 'var(--r-sm)', background: 'var(--bg-white)',
                    border: '1px solid var(--border)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-dark)', boxShadow: 'var(--shadow-sm)',
                    flexShrink: 0,
                  }}
                >
                  <ShoppingBag size={20} />
                  {cartCount > 0 && (
                    <span
                      key={`badge-${cartCount}`}
                      className="anim-bump"
                      style={{
                        position: 'absolute', top: -6, right: -6,
                        background: '#ef4444', color: 'white', borderRadius: '50%',
                        width: 20, height: 20, fontSize: '0.7rem', fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {cartCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {langOpen && (
        <div
          onClick={() => setLangOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 150 }}
        />
      )}

      <style>{`
        @media (max-width: 420px) {
          .lang-label { display: none; }
        }
      `}</style>
    </header>
  );
}
