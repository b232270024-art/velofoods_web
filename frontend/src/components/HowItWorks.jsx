import React from 'react';
import { ShoppingBag, Bike, Utensils } from 'lucide-react';

// Хажуу талд бүдгэрүүлж тавих хоолны зургууд — шинэ зураг оруулаагүй тул
// байгаа dish зургуудаас (hero-д ашигладагтай ижил) шимийн ногоо/шөл шиг
// "цэвэрхэн" харагдах хоёрыг сонгосон (кебаб/мах шиг илт биш).
const SIDE_DECOR_IMAGES = ['/images/1_normalized.webp', '/images/3_normalized.webp'];

function SideDecor({ side }) {
  const isLeft = side === 'left';
  const spots = [
    { top: '4%', offset: -70, size: 200 },
    { top: '54%', offset: -120, size: 160 },
  ];
  return (
    <div
      className="how-side-decor"
      aria-hidden="true"
      style={{
        position: 'absolute', top: 0, bottom: 0,
        [isLeft ? 'left' : 'right']: 0,
        width: 260, zIndex: 0, pointerEvents: 'none',
      }}
    >
      {spots.map((spot, i) => (
        <img
          key={i}
          src={SIDE_DECOR_IMAGES[i]}
          alt=""
          style={{
            position: 'absolute',
            top: spot.top,
            [isLeft ? 'left' : 'right']: spot.offset,
            width: spot.size, height: spot.size,
            borderRadius: '50%',
            objectFit: 'cover',
            opacity: 0.9,
            // Зурагны ирмэгийг дэвсгэр рүү зөөлөн бүдгэрүүлж холихын тулд
            // radial mask ашиглав — ингэснээр цагаан дэвсгэртэй эх зургууд
            // ард талын ногоон градиент рүү шимэгдэж, тод ирмэггүй харагдана.
            WebkitMaskImage: 'radial-gradient(circle, black 52%, transparent 76%)',
            maskImage: 'radial-gradient(circle, black 52%, transparent 76%)',
          }}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ))}
    </div>
  );
}

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
    <section
      style={{
        padding: '80px 0',
        position: 'relative',
        overflow: 'hidden',

        background: `
      radial-gradient(
        ellipse 42% 100% at 0% 50%,
        rgba(74, 222, 128, 0.45) 0%,
        rgba(134, 239, 172, 0.28) 25%,
        rgba(209, 250, 229, 0.10) 55%,
        transparent 100%
      ),
      radial-gradient(
        ellipse 42% 100% at 100% 50%,
        rgba(74, 222, 128, 0.45) 0%,
        rgba(134, 239, 172, 0.28) 25%,
        rgba(209, 250, 229, 0.10) 55%,
        transparent 100%
      ),
      var(--bg-cream)
    `,
      }}
    >
      <SideDecor side="left" />
      <SideDecor side="right" />
      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
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
          @media (max-width: 900px) {
            .how-side-decor { display: none !important; }
          }
        `}</style>
      </div>
    </section>
  );
}
