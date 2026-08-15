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

// SEO-friendly category naming + per-category icon & crawlable copy.
const CATEGORY_LABELS = {
  main: 'Main Courses',
  dessert: 'Desserts',
  extra: 'Extras & Sides',
};

const CATEGORY_ICONS = { main: '🍲', dessert: '🍰', extra: '🥤' };

const CATEGORY_COPY = {
  main: 'Freshly prepared mains — delivered to your hotel room in about 30 minutes.',
  dessert: 'Made in-house every day. Order alongside your mains so it arrives together.',
  extra: 'Sides, drinks and add-ons to complete your order.',
};

export function categoryLabel(cat) {
  return CATEGORY_LABELS[cat] || humanizeLabel(cat);
}

export function slugify(s) {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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
                {categoryLabel(item.category)}
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
  const [activeCat, setActiveCat] = useState('top');
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
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
      return matchDiet && matchSearch;
    }),
    [menuItems, dietFilter, search]
  );

  const isFiltering = search.trim() !== '' || dietFilter !== 'all';

  const getQty = (id) => cart.find(c => c.menu_item_id === id)?.quantity ?? 0;
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + Number(i.price_usd) * i.quantity, 0);

  // ── One-time: Full Menu View ───────────────────────────────────────────────────
  const sectionedCategories = useMemo(() => categories.filter(c => c !== 'All'), [categories]);

  // Categories with at least one item matching the current diet/search filters —
  // both the sticky nav pills and the sections render from this, so an anchor
  // never points at a hidden section.
  const populatedCats = useMemo(
    () => sectionedCategories.filter(cat => filtered.some(i => i.category === cat)),
    [sectionedCategories, filtered]
  );
  const featuredInFilter = filtered.filter(i => i.is_featured);

  const clearFilters = () => { setSearch(''); setDietFilter('all'); };

  const scrollToId = (id) => (e) => {
    e.preventDefault();
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── SEO: swap title / description / canonical while the menu is shown ─────────
  useEffect(() => {
    const prevTitle = document.title;
    const descEl = document.querySelector('meta[name="description"]');
    const canonEl = document.querySelector('link[rel="canonical"]');
    const prevDesc = descEl?.content;
    const prevCanon = canonEl?.href;
    document.title = 'Our Menu — Main Courses, Desserts & Extras | Velofoods';
    if (descEl) descEl.setAttribute('content', 'Browse the Velofoods menu — halal mains, desserts and sides, prepared fresh and delivered to your hotel room. Order online in minutes.');
    if (canonEl) canonEl.setAttribute('href', 'https://velofoods.com/menu');
    return () => {
      document.title = prevTitle;
      if (descEl) descEl.setAttribute('content', prevDesc || '');
      if (canonEl) canonEl.setAttribute('href', prevCanon || 'https://velofoods.com/');
    };
  }, []);

  // ── SEO: Menu schema.org structured data for rich results ─────────────────────
  useEffect(() => {
    if (!menuItems.length) return undefined;
    const dietUris = {
      halal: 'https://schema.org/HalalDiet',
      vegan: 'https://schema.org/VeganDiet',
      vegetarian: 'https://schema.org/VegetarianDiet',
      gluten_free: 'https://schema.org/GlutenFreeDiet',
    };
    const abs = (u = '') => (u.startsWith('http') ? u : `https://velofoods.com${u.startsWith('/') ? '' : '/'}${u}`);
    const cats = [...new Set(menuItems.map(i => i.category).filter(Boolean))];
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Menu',
      name: 'Velofoods Menu',
      url: 'https://velofoods.com/menu',
      hasMenuSection: cats.map(cat => {
        const items = menuItems.filter(i => i.category === cat);
        if (!items.length) return null;
        return {
          '@type': 'MenuSection',
          name: categoryLabel(cat),
          position: cats.indexOf(cat) + 1,
          hasMenuItem: items.map(item => ({
            '@type': 'MenuItem',
            name: item.name,
            description: item.description || undefined,
            image: item.image_url ? abs(item.image_url) : undefined,
            suitableForDiet: dietUris[String(item.diet_type_name || '').toLowerCase().trim().replace(/\s+/g, '_')],
            offers: {
              '@type': 'Offer',
              price: Number(item.price_usd || item.price || 0).toFixed(2),
              priceCurrency: 'USD',
              availability: item.stock_limit === 0 ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
            },
          })),
        };
      }).filter(Boolean),
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'menu-jsonld';
    el.textContent = JSON.stringify(data);
    document.head.appendChild(el);
    return () => { document.getElementById('menu-jsonld')?.remove(); };
  }, [menuItems]);

  // ── Scrollspy: highlight the pill for the section currently in view ───────────
  useEffect(() => {
    const ids = ['offers', ...populatedCats.map(cat => slugify(cat))];
    const probe = (isMobile ? 60 : 102) + 90;
    let ticking = false;
    const compute = () => {
      let current = '';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= probe) current = id;
      }
      if (window.scrollY < 40) current = 'top';
      setActiveCat(prev => (prev === current ? prev : current));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { compute(); ticking = false; });
    };
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [populatedCats, isMobile]);

  return (
    <div id="menu-top" className="anim-fade-up" style={{ padding: `40px 0 ${cartCount > 0 ? 110 : 40}px` }}>
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
          alt="Velofoods menu — fresh mains, soups and desserts prepared for hotel room delivery"
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
          <h1 className="heading-lg" style={{ color: '#fff' }}>
            {tr.menuTitle}
            <span style={{ color: 'var(--brand-green-light)' }}>{tr.menuTitleAccent}</span>
          </h1>
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

      {/* Category anchor nav — sticky scrollspy */}
      <div style={{
        position: 'sticky', top: isMobile ? 60 : 102, zIndex: 40,
        background: 'var(--bg-cream)', padding: '8px 0 10px',
        borderBottom: '1px solid var(--border)', marginBottom: 20,
      }}>
        <nav aria-label="Menu categories" style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <a
            href="#menu-top"
            onClick={scrollToId('top')}
            aria-current={activeCat === 'top' ? 'true' : undefined}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 'var(--r-full)',
              fontSize: '0.875rem', fontWeight: 700, whiteSpace: 'nowrap',
              cursor: 'pointer', textDecoration: 'none', flexShrink: 0,
              border: `2px solid ${activeCat === 'top' ? 'var(--brand-green)' : 'var(--border)'}`,
              background: activeCat === 'top' ? 'var(--brand-green)' : 'var(--bg-card)',
              color: activeCat === 'top' ? 'white' : 'var(--text-body)',
              boxShadow: activeCat === 'top' ? 'var(--shadow-glow)' : undefined,
            }}
          >
            {tr.menuAllCat}
          </a>
          {populatedCats.map(cat => {
            const slug = slugify(cat);
            const active = activeCat === slug;
            const count = filtered.filter(i => i.category === cat).length;
            return (
              <a
                key={cat}
                href={`#${slug}`}
                onClick={scrollToId(slug)}
                aria-current={active ? 'true' : undefined}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 18px', borderRadius: 'var(--r-full)',
                  fontSize: '0.875rem', fontWeight: 700, whiteSpace: 'nowrap',
                  cursor: 'pointer', textDecoration: 'none', flexShrink: 0,
                  border: `2px solid ${active ? 'var(--brand-green)' : 'var(--border)'}`,
                  background: active ? 'var(--brand-green)' : 'var(--bg-card)',
                  color: active ? 'white' : 'var(--text-body)',
                  boxShadow: active ? 'var(--shadow-glow)' : undefined,
                }}
              >
                {CATEGORY_ICONS[cat] || '🍽️'} {categoryLabel(cat)}
                <span style={{
                  fontSize: '0.72rem', fontWeight: 800,
                  background: active ? 'rgba(255,255,255,0.25)' : 'var(--bg-muted)',
                  borderRadius: 'var(--r-full)', padding: '1px 8px',
                }}>
                  {count}
                </span>
              </a>
            );
          })}
        </nav>
      </div>

      {isFiltering && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {filtered.length} dish{filtered.length !== 1 ? 'es' : ''} found
          </p>
          <button
            onClick={clearFilters}
            style={{
              fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-green)',
              background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        // ── Empty state ──────────────────────────────────────────────────────────
        <div style={{
          textAlign: 'center', padding: '80px 20px',
          background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', color: 'var(--text-muted)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <Search size={48} strokeWidth={1.5} color="var(--text-muted)" style={{ marginBottom: 16 }} />
          <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>{tr.menuEmpty}</p>
          <p style={{ fontSize: '0.875rem' }}>{tr.menuEmptySub}</p>
          <button
            onClick={clearFilters}
            style={{
              marginTop: 16, background: 'var(--brand-green)', color: 'white',
              padding: '10px 22px', borderRadius: 'var(--r-full)', fontWeight: 700,
              border: 'none', cursor: 'pointer',
            }}
          >
            Show full menu
          </button>
        </div>
      ) : (
        // ── Sectioned view (Special Offers + per-category sections) ─────────────
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {featuredInFilter.length > 0 && (
            <section id="offers" style={{ scrollMarginTop: isMobile ? 150 : 200 }}>
              <h2 className="heading-md" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <Sparkles size={20} color="var(--accent-orange)" /> {tr.menuSpecialOffers}
              </h2>
              <CardGrid items={featuredInFilter} getQty={getQty} onAddToCart={onAddToCart} onRemoveFromCart={onRemoveFromCart} compact={isMobile} />
            </section>
          )}

          {populatedCats.map((cat, i) => {
            const items = filtered.filter(item => item.category === cat);
            const banded = i % 2 === 1;
            const count = items.length;
            return (
              <section
                key={cat}
                id={slugify(cat)}
                style={{
                  ...(banded ? {
                    background: 'var(--brand-green)',
                    borderRadius: isMobile ? 'var(--r-lg)' : 'var(--r-xl)',
                    padding: isMobile ? '18px 16px' : '32px 28px',
                  } : {}),
                  scrollMarginTop: isMobile ? 150 : 200,
                }}
              >
                <header>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: isMobile ? '1.05rem' : '1.2rem' }}>{CATEGORY_ICONS[cat] || '🍽️'}</span>
                    <h2 style={{
                      fontFamily: 'Outfit, sans-serif',
                      fontWeight: 800, fontSize: isMobile ? '1.15rem' : '1.4rem',
                      color: banded ? 'white' : 'var(--text-dark)',
                    }}>
                      {categoryLabel(cat)}
                    </h2>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 800,
                      color: banded ? 'rgba(255,255,255,0.9)' : 'var(--brand-green)',
                      background: banded ? 'rgba(255,255,255,0.18)' : 'var(--bg-muted)',
                      borderRadius: 'var(--r-full)', padding: '2px 10px',
                    }}>
                      {count} item{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p style={{
                    fontSize: '0.85rem', lineHeight: 1.5,
                    color: banded ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)',
                    marginBottom: 16, maxWidth: 560,
                  }}>
                    {CATEGORY_COPY[cat] || `Fresh ${categoryLabel(cat).toLowerCase()} prepared daily and delivered to your room.`}
                  </p>
                </header>
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
