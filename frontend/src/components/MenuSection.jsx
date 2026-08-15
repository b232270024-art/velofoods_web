import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Minus, ArrowRight, ChevronLeft, Utensils, Sparkles } from 'lucide-react';
import { useIsMobile } from '../lib/useIsMobile';

function BackButton({ label, onBack }) {
  return (
    <button
      onClick={onBack}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '1.1rem',
        color: 'var(--text-dark)', background: 'none', cursor: 'pointer',
        padding: '10px 0', marginBottom: 20,
      }}
    >
      <ChevronLeft size={24} strokeWidth={3} />
      {label}
    </button>
  );
}

const DIET_CONFIG = {
  halal: { label: 'Halal', color: '#065f46', bg: '#d1fae5' },
  vegetarian: { label: 'Vegetarian', color: '#166534', bg: '#dcfce7' },
  vegan: { label: 'Vegan', color: '#14532d', bg: '#f0fdf4' },
  gluten_free: { label: 'Gluten Free', color: '#78350f', bg: '#fef3c7' },
  standard: { label: 'Standard', color: '#374151', bg: '#f3f4f6' },
};


export function humanizeLabel(s) {
  return (s || '').replace(/[_-]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
}

export function dietStyle(name) {
  const key = (name || '').toLowerCase().trim().replace(/\s+/g, '_');
  return DIET_CONFIG[key] || { ...DIET_CONFIG.standard, label: humanizeLabel(name) || DIET_CONFIG.standard.label };
}


const CARD_BG = ['#fff3e8', '#e8f5e9', '#fff8e1', '#fce4ec', '#e8f0fe', '#f0fdf4'];

function ItemCard({ item, idx, qty, onAddToCart, onRemoveFromCart, readOnly, compact }) {
  const diet = dietStyle(item.diet_type_name);
  const bg = CARD_BG[idx % CARD_BG.length];
  const featured = item.is_featured;

  // Mobile 2-баганат grid дотор нэг дэлгэц дээр ойролцоогоор 4 карт багтаах
  // зорилгоор compact горимд зураг илүү намхан, тайлбар нуугдана, товч жижиг.
  return (
    <div
      className="card anim-fade-up"
      style={{
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        position: 'relative',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        border: featured ? '2px solid var(--brand-green-light)' : '1px solid var(--border-card)',
        animationDelay: `${Math.min(idx, 10) * 0.04}s`,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
    >
      {featured && (
        <div style={{
          position: 'absolute', top: compact ? 8 : 12, right: compact ? 8 : 12,
          background: 'var(--accent-yellow)', color: '#111',
          fontSize: compact ? '0.62rem' : '0.7rem', fontWeight: 800,
          padding: compact ? '2px 7px' : '3px 10px', borderRadius: 'var(--r-full)',
          zIndex: 1, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Sparkles size={compact ? 10 : 12} /> {compact ? '' : 'Featured'}
        </div>
      )}

      <div style={{
        width: '100%', aspectRatio: compact ? '1/1' : '16/9',
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => {
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <Utensils size={compact ? 26 : 40} color="var(--text-muted)" />
        )}
      </div>

      <div style={{ padding: compact ? '10px 10px 10px' : '18px 18px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {!compact && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 'var(--r-full)',
              background: diet.bg, color: diet.color,
              fontSize: '0.72rem', fontWeight: 800, border: `1px solid ${diet.color}22`,
            }}>
              {diet.label}
            </span>
            {item.category && (
              <span style={{
                padding: '3px 10px', borderRadius: 'var(--r-full)',
                background: 'var(--bg-muted)', color: 'var(--text-muted)',
                fontSize: '0.72rem', fontWeight: 600,
              }}>
                {humanizeLabel(item.category)}
              </span>
            )}
          </div>
        )}

        <h3 style={{
          fontSize: compact ? '0.85rem' : '1rem', fontWeight: 700, color: 'var(--text-dark)',
          marginBottom: compact ? 3 : 6, lineHeight: 1.3,
          ...(compact ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}),
        }}>
          {item.name}
        </h3>

        {!compact && item.description && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 12 }}>
            {item.description}
          </p>
        )}

        {item.stock_limit === 0 && (
          <div style={{ fontSize: compact ? '0.68rem' : '0.78rem', color: '#dc2626', marginBottom: compact ? 6 : 14, fontWeight: 700 }}>
            Sold Out
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', gap: 6 }}>
          <span style={{ fontSize: compact ? '0.92rem' : '1.2rem', fontWeight: 900, color: 'var(--brand-green)' }}>
            ${Number(item.price_usd).toFixed(2)}
          </span>

          {readOnly ? null : item.stock_limit === 0 ? (
            <span style={{
              background: '#f3f4f6', color: '#9ca3af',
              padding: compact ? '6px 10px' : '9px 20px', borderRadius: 10,
              fontWeight: 700, fontSize: compact ? '0.72rem' : '0.875rem',
            }}>
              {tr.menuSoldOut || 'Sold Out'}
            </span>
          ) : qty > 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: compact ? 3 : 6,
              background: 'var(--bg-muted)', borderRadius: 10, padding: '4px',
            }}>
              <button
                onClick={() => onRemoveFromCart(item.id)}
                style={{
                  width: compact ? 24 : 30, height: compact ? 24 : 30, borderRadius: 7,
                  background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Minus size={compact ? 12 : 14} />
              </button>
              <span style={{ fontWeight: 800, minWidth: compact ? 16 : 22, textAlign: 'center', fontSize: compact ? '0.8rem' : '0.9rem' }}>{qty}</span>
              <button
                onClick={() => onAddToCart(item)}
                disabled={item.stock_limit !== null && qty >= item.stock_limit}
                style={{
                  width: compact ? 24 : 30, height: compact ? 24 : 30, borderRadius: 7,
                  background: item.stock_limit !== null && qty >= item.stock_limit ? '#ccc' : 'var(--brand-green)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Plus size={compact ? 12 : 14} />
              </button>
            </div>
          ) : compact ? (
            <button
              onClick={() => onAddToCart(item)}
              aria-label="Add to cart"
              style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: 'var(--brand-green)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Plus size={15} />
            </button>
          ) : (
            <button
              onClick={() => onAddToCart(item)}
              style={{
                background: 'var(--brand-green)', color: 'white',
                padding: '9px 20px', borderRadius: 10,
                fontWeight: 700, fontSize: '0.875rem',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Plus size={15} /> Add To Cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CardGrid({ items, getQty, onAddToCart, onRemoveFromCart, readOnly, compact }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
      gap: compact ? 12 : 24,
    }}>
      {items.map((item, idx) => (
        <ItemCard
          key={item.id}
          item={item}
          idx={idx}
          qty={getQty(item.id)}
          onAddToCart={onAddToCart}
          onRemoveFromCart={onRemoveFromCart}
          readOnly={readOnly}
          compact={compact}
        />
      ))}
    </div>
  );
}

export function MenuSection({ menuItems, cart, tr, onAddToCart, onRemoveFromCart, onContinueToDelivery, onBack }) {
  const [search, setSearch] = useState('');
  const [dietFilter, setDietFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('All');
  const isMobile = useIsMobile();

  const categories = useMemo(() => {
    const cats = [...new Set(menuItems.map(i => i.category).filter(Boolean))];
    return ['All', ...cats];
  }, [menuItems]);

  // Тухайн буудлын menu-д бодитоор ашиглагдаж буй ангиллуудаас л filter pill
  // үүсгэнэ (dietFilter одоо fixed key биш, diet_type_id (uuid) хадгална).
  const dietFilters = useMemo(() => {
    const map = new Map();
    menuItems.forEach(i => { if (i.diet_type_id && !map.has(i.diet_type_id)) map.set(i.diet_type_id, i.diet_type_name); });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [menuItems]);

  const filtered = useMemo(() =>
    menuItems.filter(item => {
      const matchDiet = dietFilter === 'all' || item.diet_type_id === dietFilter;
      const matchCat = catFilter === 'All' || item.category === catFilter;
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
      return matchDiet && matchCat && matchSearch;
    }),
    [menuItems, dietFilter, catFilter, search]
  );

  const isFiltering = search.trim() !== '' || dietFilter !== 'all' || catFilter !== 'All';

  const getQty = (id) => cart.find(c => c.menu_item_id === id)?.quantity ?? 0;
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + Number(i.price_usd) * i.quantity, 0);

  // ── One-time: Full Menu View ───────────────────────────────────────────────────
  const featuredItems = menuItems.filter(i => i.is_featured);
  const sectionedCategories = categories.filter(c => c !== 'All');

  return (
    <div className="anim-fade-up" style={{ padding: `40px 0 ${cartCount > 0 ? 110 : 40}px` }}>
      <BackButton label={tr.back} onBack={onBack} />

      {/* Hero banner */}
      <div
        className="anim-fade-up"
        style={{
          position: 'relative', overflow: 'hidden',
          borderRadius: 'var(--r-xl)',
          minHeight: isMobile ? 200 : 280,
          marginBottom: 24,
          background: '#0B120E',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <img
          src="/images/hero-menu.webp"
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'right center',
          }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, rgba(11,18,14,0.94) 0%, rgba(11,18,14,0.55) 42%, rgba(11,18,14,0) 75%)',
        }} />
        <div style={{
          position: 'relative', zIndex: 1, height: '100%',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: isMobile ? '24px 22px' : '36px 44px',
        }}>
          <h2 className="heading-lg" style={{ color: '#fff' }}>
            {tr.menuTitle}
            <span style={{ color: 'var(--brand-green-light)' }}>{tr.menuTitleAccent}</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', marginTop: 8, maxWidth: 430, fontSize: isMobile ? '0.85rem' : '1rem' }}>
            {tr.menuDesc}
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
          <Search size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            id="menu-search"
            type="text"
            placeholder={tr.menuSearch}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px 10px 42px',
              borderRadius: 'var(--r-full)',
              border: '1.5px solid var(--border)',
              background: 'var(--bg-card)', fontSize: '0.875rem', outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Diet type filter pills — тухайн буудлын menu-д бодитоор байгаа ангиллуудаас */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          onClick={() => setDietFilter('all')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 'var(--r-full)',
            fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
            border: `2px solid ${dietFilter === 'all' ? DIET_CONFIG.standard.color : 'var(--border)'}`,
            background: dietFilter === 'all' ? DIET_CONFIG.standard.bg : 'var(--bg-card)',
            color: dietFilter === 'all' ? DIET_CONFIG.standard.color : 'var(--text-body)',
            transition: 'all 0.2s',
          }}
        >
          <Utensils size={15} /> {tr.menuAllCat}
        </button>
        {dietFilters.map(f => {
          const active = dietFilter === f.id;
          const cfg = dietStyle(f.name);
          return (
            <button
              key={f.id}
              onClick={() => setDietFilter(f.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 'var(--r-full)',
                fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                border: `2px solid ${active ? cfg.color : 'var(--border)'}`,
                background: active ? cfg.bg : 'var(--bg-card)',
                color: active ? cfg.color : 'var(--text-body)',
                transition: 'all 0.2s',
              }}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16, marginBottom: 28 }}>
        {categories.map(cat => (
          <button
            key={cat}
            className={`pill ${catFilter === cat ? 'active' : ''}`}
            onClick={() => setCatFilter(cat)}
          >
            {cat === 'All' ? tr.menuAllCat : humanizeLabel(cat)}
          </button>
        ))}
      </div>

      {isFiltering ? (
        // ── Flat filtered grid ──────────────────────────────────────────────────
        filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 20px',
            background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', color: 'var(--text-muted)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <Search size={48} strokeWidth={1.5} color="var(--text-muted)" style={{ marginBottom: 16 }} />
            <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>{tr.menuEmpty}</p>
            <p style={{ fontSize: '0.875rem' }}>{tr.menuEmptySub}</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
              {filtered.length} dish{filtered.length !== 1 ? 'es' : ''} found
            </p>
            <CardGrid items={filtered} getQty={getQty} onAddToCart={onAddToCart} onRemoveFromCart={onRemoveFromCart} compact={isMobile} />
          </>
        )
      ) : (
        // ── Sectioned view (Special Offers + per-category banners) ─────────────
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {featuredItems.length > 0 && (
            <section>
              <h3 style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--text-dark)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={20} color="var(--accent-orange)" /> {tr.menuSpecialOffers}
              </h3>
              <CardGrid items={featuredItems} getQty={getQty} onAddToCart={onAddToCart} onRemoveFromCart={onRemoveFromCart} compact={isMobile} />
            </section>
          )}

          {sectionedCategories.map((cat, i) => {
            const items = menuItems.filter(item => item.category === cat);
            if (items.length === 0) return null;
            const banded = i % 2 === 1;
            return (
              <section
                key={cat}
                style={banded ? {
                  background: 'var(--brand-green)',
                  borderRadius: isMobile ? 'var(--r-lg)' : 'var(--r-xl)',
                  padding: isMobile ? '16px 14px' : '32px 28px',
                } : undefined}
              >
                <h3 style={{
                  fontWeight: 800, fontSize: isMobile ? '1.05rem' : '1.3rem', marginBottom: isMobile ? 12 : 18,
                  color: banded ? 'white' : 'var(--text-dark)',
                }}>
                  {humanizeLabel(cat)}
                </h3>
                <CardGrid items={items} getQty={getQty} onAddToCart={onAddToCart} onRemoveFromCart={onRemoveFromCart} compact={isMobile} />
              </section>
            );
          })}
        </div>
      )}

      {/* Floating "Continue" bar once the cart has items — rendered via portal straight to
          <body> so it stays pinned to the viewport (an ancestor's CSS transform/animation
          would otherwise turn `position: fixed` into `position: absolute` relative to it). */}
      {cartCount > 0 && createPortal(
        <div
          style={{
            position: 'fixed', left: 20, right: 20, bottom: 20,
            maxWidth: 1160, margin: '0 auto', zIndex: 150,
          }}
        >
          <div className="anim-slide-up" style={{
            background: 'var(--bg-green-dark)', padding: '16px 24px',
            borderRadius: 'var(--r-lg)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.78rem' }}>
                {cartCount} item{cartCount !== 1 ? 's' : ''} in cart
              </span>
              <span key={cartTotal} className="anim-bump" style={{ color: 'white', fontWeight: 900, fontSize: '1.15rem' }}>
                ${cartTotal.toFixed(2)}
              </span>
            </div>
            <button
              id="menu-continue-btn"
              onClick={onContinueToDelivery}
              style={{
                background: 'var(--accent-yellow)', color: '#111',
                padding: '12px 24px', borderRadius: 12,
                fontWeight: 800, fontSize: '0.95rem',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {tr.menuContinueBtn} <ArrowRight size={18} />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
