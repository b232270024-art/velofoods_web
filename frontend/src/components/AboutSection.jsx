import React from 'react';
import { Utensils, ChefHat, Salad, Coffee } from 'lucide-react';

export function AboutSection({ tr, onAboutClick }) {
  const GRID_ICONS = [
    { icon: Utensils, bg: '#fff3e8', color: '#c2410c', image: '/images/about-1.webp' },
    { icon: ChefHat, bg: '#e8f5e9', color: '#166534', image: '/images/about-2.webp' },
    { icon: Salad, bg: '#e8f0fe', color: '#1d4ed8', image: '/images/about-3.webp' },
    { icon: Coffee, bg: '#fce4ec', color: '#be185d', image: '/images/about-4.webp' },
  ];

  return (
    <section style={{ padding: '80px 0', background: 'var(--bg-cream)' }}>
      <div className="container">
        <div className="about-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 60,
          alignItems: 'center',
        }}>
          {/* LEFT — Image collage */}
          <div className="anim-fade-up" style={{ position: 'relative' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              borderRadius: 'var(--r-xl)',
              overflow: 'hidden',
            }}>
              {GRID_ICONS.map((item, i) => {
                const IconComp = item.icon;
                return (
                  <div
                    key={i}
                    style={{
                      aspectRatio: '1/1',
                      background: item.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 20,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <IconComp size={48} color={item.color} />
                    <img
                      src={item.image}
                      alt=""
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Floating circular decoration */}
            <div style={{
              position: 'absolute',
              top: -20, left: -20,
              width: 80, height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--brand-green-light), var(--brand-green))',
              opacity: 0.15,
            }} />
          </div>

          {/* RIGHT — Copy */}
          <div className="anim-fade-up anim-delay-2">
            <h2 className="heading-lg" style={{ marginBottom: 20 }}>
              {tr.aboutTitle}
              <span style={{ color: 'var(--accent-orange)' }}>{tr.aboutTitleAccent}</span>
              {tr.aboutTitle2}
              <span style={{ color: 'var(--brand-green-light)' }}>{tr.aboutTitleAccent2}</span>
              {tr.aboutTitle3}
            </h2>

            <p style={{ color: 'var(--text-body)', lineHeight: 1.8, marginBottom: 32 }}>
              {tr.aboutDesc}
            </p>

            {/* Түр хугацаагаар нуусан: "Meet our partner" товч */}
            {false && (
              <button className="btn-primary" style={{ padding: '13px 32px' }} onClick={onAboutClick}>
                {tr.aboutBtn}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .about-grid { grid-template-columns: 1fr !important; gap: 36px !important; }
        }
      `}</style>
    </section>
  );
}
