import React, { useEffect, useState } from 'react';
import { ChevronLeft, Utensils, Check } from 'lucide-react';

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

// 12 хоногийн план сонгосны дараах сүүлийн санал болгох алхам — admin-ийн
// "Санал болгох" (is_addon_recommended) гэж тэмдэглэсэн зууш/амттангаас
// зочин дан ганц зүйл (эсвэл юу ч биш) сонгож нэмж болно. Сонгосон бол
// маргааш (planы эхний өдөртэй адил) хүргэгдэнэ.
export function PlanAddonStep({ menuItems, tr, onContinue, onBack }) {
  const [selectedId, setSelectedId] = useState(null);
  const options = menuItems.filter(i => i.is_addon_recommended && i.available !== false);

  // Санал болгох зүйл огт байхгүй бол зочинд хоосон алхам харуулахгүйгээр алгасна.
  useEffect(() => {
    if (options.length === 0) onContinue(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  if (options.length === 0) return null;

  return (
    <div className="anim-fade-up" style={{ maxWidth: 760, margin: '0 auto', padding: '40px 0 100px' }}>
      <BackButton label={tr.back} onBack={onBack} />
      <h2 className="heading-lg" style={{ marginBottom: 8 }}>{tr.menuPlanAddonTitle || 'One more thing?'}</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28 }}>
        {tr.menuPlanAddonDesc || 'Our pick for you — add it to tomorrow\'s delivery. Optional, pick at most one.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        {options.map(item => {
          const active = selectedId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSelectedId(active ? null : item.id)}
              className="card"
              style={{
                textAlign: 'left', padding: 0, overflow: 'hidden',
                border: active ? '2px solid var(--brand-green)' : '1px solid var(--border-card)',
                position: 'relative',
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--brand-green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                }}>
                  <Check size={15} />
                </div>
              )}
              <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Utensils size={30} color="var(--text-muted)" />}
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-dark)', marginBottom: 4 }}>{item.name}</div>
                {item.description && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.45 }}>{item.description}</p>
                )}
                <span style={{ fontWeight: 800, color: 'var(--brand-green)' }}>${Number(item.price_usd).toFixed(2)}</span>
              </div>
            </button>
          );
        })}
      </div>

      <button className="btn-primary" onClick={() => onContinue(selectedId)} style={{ width: '100%', padding: 16, justifyContent: 'center', borderRadius: 14 }}>
        {selectedId ? (tr.menuPlanAddonAdd || 'Add & Continue') : (tr.menuPlanAddonSkip || 'No thanks, continue')}
      </button>
    </div>
  );
}
