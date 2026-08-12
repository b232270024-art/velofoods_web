import React, { useEffect, useState } from 'react';
import { ArrowDown, Truck, ShoppingBag } from 'lucide-react';

const DISH_IMAGES = [
  '/images/1_normalized.webp',
  '/images/2_normalized.webp',
  '/images/3_normalized.webp',
  '/images/4_normalized.webp',
  '/images/5_normalized.webp',
];

const ROTATE_INTERVAL_MS = 3000;
const ORBIT_RADIUS_PCT = 46;

const ORBIT_SLOTS = [
  { angle: 36, size: 100 },
  { angle: 72, size: 90 },
  { angle: 108, size: 90 },
  { angle: 144, size: 100 },
];

function useRotatingIndex(length, intervalMs) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % length), intervalMs);
    return () => clearInterval(id);
  }, [length, intervalMs]);
  return index;
}

function HeroCopy({ tr, onGetStarted }) {
  return (
    <div className="anim-fade-up">
      <h1 className="heading-xl" style={{ marginBottom: 15 }}>
        {tr.heroTitle1}
        <span style={{ color: 'var(--brand-green-light)' }}>{tr.heroTitleGreen}</span>
        {tr.heroTitle2}<br />
        <span style={{ color: 'var(--accent-orange)' }}>{tr.heroTitle3}</span>
        {tr.heroTitle4}
        <span style={{ color: 'var(--accent-orange)' }}>{tr.heroTitleOrange}</span>
        {tr.heroTitle5}
      </h1>

      <div style={{
        width: 120, height: 4, borderRadius: 4,
        background: 'linear-gradient(90deg, var(--accent-yellow), transparent)',
        marginBottom: 24,
      }} />

      <p style={{ color: 'var(--text-body)', fontSize: '1rem', maxWidth: 420, lineHeight: 1.7, marginBottom: 36 }}>
        {tr.heroDesc}
      </p>

      <button
        id="hero-get-started"
        onClick={onGetStarted}
        className="btn-primary"
        style={{ fontSize: '1rem', padding: '14px 36px', borderRadius: 'var(--r-sm)' }}
      >
        {tr.heroBtn}
      </button>

      <div style={{ marginTop: 48, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
          <ArrowDown size={14} />
        </div>
        <span>Scroll to explore</span>
      </div>
    </div>
  );
}

function DeliveryCard() {
  return (
    <div id="hero-delivery-card" style={{
      position: 'absolute',
      bottom: '-5%',
      left: '-65%',
      maxWidth: 390,
      width: 390,
      paddingTop: '16px',
      paddingBottom: '16px',
      background: 'rgba(255, 255, 255, 0.17)',
      border: '1px solid rgba(255, 255, 255, 0.41)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: 20,
      padding: '24px 28px',
      boxShadow: '0 10px 35px rgba(0,0,0,0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      overflow: 'hidden',
      zIndex: 1,
    }}>
      <div style={{
        position: 'absolute',
        top: -18,
        left: -18,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'var(--brand-green-light)',
        opacity: 0.5,
      }} />

      <div style={{
        position: 'absolute',
        bottom: -16,
        right: -16,
        width: 42,
        height: 42,
        borderRadius: '50%',
        background: 'var(--accent-orange)',
        opacity: 0.5,
      }} />

      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Truck size={16} color="var(--text-dark)" />
        </div>
        <div>
          <div style={{ color: 'var(--text-dark)', fontWeight: 700, fontSize: '0.82rem' }}>
            Next Day Delivery
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 500 }}>
            Order today and receive your fresh meals tomorrow at your hotel or current location
          </div>
        </div>
      </div>

      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ShoppingBag size={16} color="var(--text-dark)" />
        </div>
        <div>
          <div style={{ color: 'var(--text-dark)', fontWeight: 700, fontSize: '0.82rem' }}>
            Location Delivery
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 500 }}>
            We deliver directly to your hotel room or current location.
          </div>
        </div>
      </div>
    </div>
  );
}

function SmallDishSlots({ activeIndex }) {
  const smallDishIndices = DISH_IMAGES.map((_, i) => i).filter((i) => i !== activeIndex);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {smallDishIndices.map((dishIdx, slot) => {
        const { angle, size } = ORBIT_SLOTS[slot];
        const rad = (angle * Math.PI) / 180;
        const x = 50 + ORBIT_RADIUS_PCT * Math.cos(rad);
        const y = 50 + ORBIT_RADIUS_PCT * Math.sin(rad);
        return (
          <div
            key={`slot-${slot}`}
            className="dish-small-slot"
            style={{
              position: 'absolute', top: `${y}%`, left: `${x}%`,
              width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2,
              borderRadius: '50%', overflow: 'hidden',
              border: '3px solid var(--bg-card)', boxShadow: 'var(--shadow-md)',
              zIndex: 4,
            }}
          >
            <img
              key={DISH_IMAGES[dishIdx]}
              src={DISH_IMAGES[dishIdx]}
              alt={`Signature dish ${dishIdx + 1}`}
              className="orbit-item-img"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        );
      })}
    </div>
  );
}

function DishCircle({ activeIndex }) {
  return (
    <div id="hero-image-wrapper" className="anim-fade-up anim-delay-2" style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 620,
        aspectRatio: '1/1',
        borderRadius: '100%',
        background: 'radial-gradient(circle, rgba(254,243,199,0.7) 0%, rgba(236,253,245,0.3) 70%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div id="dish-cycle" style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', zIndex: 3 }}>
          <img
            key={DISH_IMAGES[activeIndex]}
            src={DISH_IMAGES[activeIndex]}
            alt={`Signature dish ${activeIndex + 1}`}
            className="dish-big-img"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
        <DeliveryCard />
        <SmallDishSlots activeIndex={activeIndex} />
      </div>
    </div>
  );
}

const HERO_STYLES = `
  .dish-big-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    animation: slotPop 0.6s ease-out;
  }
  .orbit-item-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    animation: slotPop 0.5s ease-out;
  }
  @keyframes slotPop {
    0%   { opacity: 0; transform: scale(0.6); }
    100% { opacity: 1; transform: scale(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .dish-big-img, .orbit-item-img { animation: none; }
  }
  @media (max-width: 768px) {
    #hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
    #hero-image-wrapper { display: none !important; }
    .hero-wave-shape { display: none !important; }
  }
`;

export function HeroSection({ tr, onGetStarted }) {
  const activeIndex = useRotatingIndex(DISH_IMAGES.length, ROTATE_INTERVAL_MS);

  return (
    <section style={{
      position: 'relative',
      background: 'var(--bg-cream)',
      marginTop: '-88px',
      paddingTop: '118px',
      paddingBottom: '120px',
      overflow: 'hidden',
    }}>
      <svg
        className="hero-wave-shape"
        aria-hidden="true"
        viewBox="0 0 900 1440"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <path
          d="
      M 400 0
      C 250 200, 200 500, 300 800
      C 400 1100, 450 1300, 400 1440
      L 900 1440
      L 900 0
      Z
    "
          fill="#34d399"
          opacity="0.15"
        />
      </svg>

      {/* Texture дэвсгэр */}
      <div id="hero-bg-layer" aria-hidden="true" style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'url(/images/hero-bg.webp)',
        backgroundSize: '420px',
        backgroundPosition: 'center',
        backgroundRepeat: 'repeat',
        opacity: 0.04,
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* MAIN CONTENT */}
      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <div id="hero-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 40,
          alignItems: 'center',
          minHeight: 600,
        }}>
          <HeroCopy tr={tr} onGetStarted={onGetStarted} />
          <DishCircle activeIndex={activeIndex} />
        </div>
      </div>
      <style>{HERO_STYLES}</style>
    </section>
  );
}