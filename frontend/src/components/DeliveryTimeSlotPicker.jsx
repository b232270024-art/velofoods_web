import React from 'react';
import { Clock } from 'lucide-react';

const PERIOD_LABEL_KEY = {
  morning: 'deliveryTimeMorning',
  midday: 'deliveryTimeMidday',
  evening: 'deliveryTimeEvening',
};

export function DeliveryTimeSlotPicker({ slots, selectedId, onSelect, tr }) {
  if (!slots || slots.length === 0) return null;

  return (
    <div className="card" style={{ padding: '22px 24px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Clock size={18} color="var(--brand-green)" />
        <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem' }}>
          {tr.deliveryTimeTitle}
        </h3>
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14 }}>
        {tr.deliveryTimeHint}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {slots.map(slot => {
          const active = selectedId === slot.id;
          return (
            <button
              key={slot.id}
              type="button"
              id={`delivery-time-slot-${slot.period}`}
              onClick={() => onSelect(slot.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '12px 16px', borderRadius: 10,
                border: `1.5px solid ${active ? 'var(--brand-green)' : 'var(--border)'}`,
                background: active ? '#eafbf3' : 'white',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-dark)' }}>
                {tr[PERIOD_LABEL_KEY[slot.period]] || slot.period}
              </span>
              <span style={{
                fontWeight: 700, fontSize: '0.85rem',
                color: active ? 'var(--brand-green-btn)' : 'var(--text-muted)',
              }}>
                {slot.start_time}–{slot.end_time}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
