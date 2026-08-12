import React, { useEffect, useState } from 'react';
import { ChevronLeft, ArrowRight, ArrowUp, Utensils } from 'lucide-react';
import { dietStyle } from './MenuSection';

// 12 хоногийн планд зочин аль ресторантай (diet type) ажиллахаа сонгоно.
// Зөвхөн diet_type_id оноогдсон ресторанууд харагдана.
export function DietTypeSelection({ tr, onBack, onContinue }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // restaurant id

  useEffect(() => {
    fetch('/api/menu/restaurants')
      .then(r => r.json())
      .then(data => setRestaurants(Array.isArray(data) ? data.filter(r => r.diet_type_id) : []))
      .catch(() => setRestaurants([]))
      .finally(() => setLoading(false));
  }, []);

  // Ресторан байхгүй бол шууд дамжина (diet_type_id = null)
  useEffect(() => {
    if (!loading && restaurants.length === 0) onContinue(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, restaurants]);

  if (loading || restaurants.length === 0) return null;

  const canContinue = !!selected;
  const selectedRestaurant = restaurants.find(r => r.id === selected);

  return (
    <div className="anim-fade-up" style={{
      minHeight: '100vh',
      background: '#f8faf9',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ flex: 1, padding: '32px 24px', maxWidth: 640, width: '100%', margin: '0 auto' }}>
        {/* Back */}
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '1rem',
            color: '#374151', background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 0', marginBottom: 20,
          }}
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
          {tr.back}
        </button>

        {/* Title */}
        <h1 style={{
          fontFamily: 'Outfit, sans-serif', fontWeight: 800,
          fontSize: '2.1rem', color: '#064e3b',
          textAlign: 'center', marginBottom: 10, lineHeight: 1.2,
          letterSpacing: '-0.02em',
        }}>
          {tr.dietTypeSelectTitle || 'Choose your menu'}
        </h1>
        <p style={{
          color: '#6b7280', fontSize: '0.95rem', lineHeight: 1.6,
          marginBottom: 24, textAlign: 'center', maxWidth: 520, margin: '0 auto 24px',
        }}>
          {tr.dietTypeSelectDesc || 'Each 12-Day Meal Plan is prepared by a dedicated kitchen. Pick the one that matches your dietary needs.'}
        </p>

        {/* Minimal accent line */}
        <div style={{
          width: 120, height: 3, borderRadius: 3,
          background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)',
          margin: '0 auto 32px',
          opacity: 0.75,
        }} />

        {/* Restaurant cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
          {restaurants.map(r => {
            const cfg = dietStyle(r.diet_type_name);
            const active = selected === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                style={{
                  width: '100%',
                  padding: '18px 24px',
                  borderRadius: 22,
                  border: active ? '2px solid #059669' : '1.5px solid #e5e7eb',
                  background: active ? '#e6f7ef' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  boxShadow: active ? '0 2px 8px rgba(0, 0, 0, 0.04)' : '0 1px 3px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.18s ease',
                  textAlign: 'left',
                  outline: 'none',
                }}
              >
                {/* Avatar Circle with Lucide Utensils Icon */}
                <div style={{
                  width: 52, height: 52,
                  borderRadius: '50%',
                  background: active ? '#c6f6d5' : '#f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.18s ease',
                }}>
                  <Utensils size={22} color={active ? '#059669' : '#6b7280'} />
                </div>

                {/* Info: Diet Type Name on TOP, Restaurant Name on BOTTOM (No box/badge) */}
                <div style={{ flex: 1 }}>
                  {/* Diet Type Name (Halal, Vegetarian, Gluten Free, etc.) */}
                  <div style={{
                    fontFamily: 'Outfit, sans-serif',
                    fontWeight: 800,
                    fontSize: '1.15rem',
                    color: '#111827',
                    lineHeight: 1.3,
                  }}>
                    {cfg.label || r.diet_type_name}
                  </div>
                  {/* Restaurant Name - Plain text, NO box */}
                  <div style={{
                    fontSize: '0.88rem',
                    color: '#6b7280',
                    fontWeight: 500,
                    marginTop: 3,
                  }}>
                    {r.name}
                  </div>
                </div>

                {/* Selected Checkmark */}
                {active && (
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: '#059669', color: '#ffffff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: '0.85rem', flexShrink: 0,
                  }}>
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Notice Bar */}
        {selectedRestaurant && (
          <div style={{
            padding: '12px 18px', borderRadius: 14,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            fontSize: '0.88rem', color: '#374151',
            marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: '#059669', fontWeight: 800 }}>✓</span>
            <span><strong>{selectedRestaurant.name}</strong>{tr.dietTypeSelectedMsg || "'s 12-Day Meal Plan is ready to view."}</span>
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Bar */}
      <div style={{
        padding: '18px 24px',
        position: 'sticky',
        bottom: 0,
        background: '#f8faf9',
        borderTop: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <button
            id="continue-diet-btn"
            onClick={() => {
              if (!canContinue) return;
              onContinue(selectedRestaurant.diet_type_id);
            }}
            style={{
              width: '100%',
              background: canContinue ? '#059669' : '#d1d5db',
              color: canContinue ? '#ffffff' : '#9ca3af',
              padding: '16px 20px',
              borderRadius: 14, fontWeight: 800, fontSize: '1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, cursor: canContinue ? 'pointer' : 'not-allowed',
              transition: 'all 0.18s ease',
              border: 'none',
            }}
          >
            <span>{tr.dietTypeSelectBtn || 'Continue'}</span>
            {canContinue ? <ArrowRight size={20} /> : <ArrowUp size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}

