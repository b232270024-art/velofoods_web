import React from 'react';
import { ShoppingBag, Bike, Utensils } from 'lucide-react';

const STEPS = [
  {
    icon: ShoppingBag,
    bg: '#e8f5e9',
    color: '#166534',
    num: 1,
    image: '/images/step1.webp',
  },
  {
    icon: Bike,
    bg: '#fff3e8',
    color: '#c2410c',
    num: 2,
    image: '/images/step2.webp',
  },
  {
    icon: Utensils,
    bg: '#e8f0fe',
    color: '#1d4ed8',
    num: 3,
    image: '/images/step3.png',
  },
];

export function HowItWorks({ tr }) {
  return (
    <section style={{ padding: '80px 0', background: 'var(--bg-cream)' }}>
      <div className="container">
        {/* Section Title */}
        <div className="anim-fade-up" style={{ textAlign: 'center', marginBottom: 16 }}>
          <h2 className="heading-lg">
            {tr.howTitle}
            <span style={{ color: 'var(--accent-orange)' }}>{tr.howTitleAccent}</span>
            {tr.howTitle2}
            <span style={{ color: 'var(--brand-green-light)' }}>{tr.howTitleAccent2}</span>
            {tr.howTitle3}
          </h2>
        </div>

        {/* Steps grid */}
        <div id="how-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}>
          {STEPS.map((step, i) => {
            const titles = [tr.step1Title, tr.step2Title, tr.step3Title];
            const descs = [tr.step1Desc, tr.step2Desc, tr.step3Desc];
            const IconComponent = step.icon;
            return (
              <div
                key={i}
                className="anim-fade-up"
                style={{ animationDelay: `${i * 0.1}s`, textAlign: 'center' }}
              >
                {/* Illustration */}
                <div style={{
                  width: '100%', maxWidth: 450, aspectRatio: '1/1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                  position: 'relative',
                }}>
                  <IconComponent size={64} color={step.color} />
                  <img
                    src={step.image}
                    alt=""
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>

                {/* Step title */}
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: 10, marginTop: '-40px' }}>
                  {titles[i]}
                </h3>

                {/* Description */}
                {descs[i] && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 280, margin: '0 auto 16px' }}>
                    {descs[i]}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Responsive */}
        <style>{`
          @media (max-width: 600px) {
            #how-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </section>
  );
}
