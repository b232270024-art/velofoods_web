import React, { useMemo } from 'react';
import { AlertTriangle, ChevronLeft, User, MapPin, Utensils, Info } from 'lucide-react';

const MEAL_ORDER = { morning: 0, lunch: 1, evening: 2 };

function getMealLabel(tr) {
  return { morning: tr.menuMealMorning || 'Morning', lunch: tr.menuMealLunch || 'Lunch', evening: tr.menuMealEvening || 'Evening' };
}

function formatPlanDate(dateStr, language) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  try {
    return dt.toLocaleDateString(language, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  } catch {
    return `${m}/${d}`;
  }
}

// 12 хоногийн планы сүүлийн шат — өдөр тус бүрийн товч дэлгэрэнгүй, сонгосон
// нэмэлт зүйл (байвал), нийт үнэ, нөхцөл зөвшөөрөл, төлбөр товч.
export function PlanReviewStep({
  reviewItems, addonItem, session, language, tr,
  agreeTerms, onToggleAgree, onOpenTerms,
  onPay, isSubmitting, onBack,
}) {
  const mealLabels = getMealLabel(tr);

  const byDate = useMemo(() => {
    const map = new Map();
    for (const item of reviewItems) {
      if (!map.has(item.date)) map.set(item.date, []);
      map.get(item.date).push(item);
    }
    for (const list of map.values()) list.sort((a, b) => MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [reviewItems]);

  const coreTotal = reviewItems.reduce((s, i) => s + Number(i.price_usd), 0);
  const addonPrice = addonItem ? Number(addonItem.price_usd) : 0;
  const grandTotal = coreTotal + addonPrice;

  return (
    <div className="anim-fade-up" style={{ maxWidth: 680, margin: '0 auto', padding: '40px 0 100px' }}>
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
        {tr.back}
      </button>

      <h2 className="heading-lg" style={{ marginBottom: 24 }}>{tr.menuPlanReviewTitle || 'Review your plan'}</h2>

      <div style={{
        display: 'flex', gap: 12,
        background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--r-md)',
        padding: '16px 18px', marginBottom: 24,
      }}>
        <AlertTriangle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ color: '#991b1b', fontSize: '0.85rem', lineHeight: 1.65, fontWeight: 500 }}>{tr.refundWarning}</p>
      </div>

      <div className="card" style={{ padding: '20px 22px', marginBottom: 20 }}>
        {byDate.map(([date, items]) => (
          <div key={date} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-dark)', marginBottom: 6 }}>
              {formatPlanDate(date, language)}
            </div>
            {items.map(item => (
              <div key={`${item.date}-${item.meal}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', padding: '3px 0', color: 'var(--text-body)' }}>
                <span>
                  <span style={{ color: 'var(--text-muted)' }}>{mealLabels[item.meal]}:</span> {item.name}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--text-dark)', flexShrink: 0 }}>${Number(item.price_usd).toFixed(2)}</span>
              </div>
            ))}
          </div>
        ))}

        {addonItem && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
            background: '#fff7ed', border: '1px solid #fed7aa', marginBottom: 4,
          }}>
            <Utensils size={15} color="#9a3412" />
            <span style={{ flex: 1, fontSize: '0.83rem', fontWeight: 700, color: '#9a3412' }}>
              + {addonItem.name} ({tr.menuPlanAddonReviewLabel || 'extra, delivered tomorrow'})
            </span>
            <span style={{ fontWeight: 800, color: '#9a3412' }}>${addonPrice.toFixed(2)}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{tr.cartSubtotal || 'Total'}</span>
          <span style={{ fontWeight: 900, fontSize: '1.35rem', color: 'var(--brand-green)' }}>${grandTotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="card" style={{ padding: '20px 26px', marginBottom: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={16} color="var(--brand-green-light)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-dark)' }}>{session?.guest_name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <MapPin size={16} color="var(--brand-green-light)" style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-body)' }}>
              {session?.hotel_name || ''}{session?.room_number ? ` — ${tr.room} ${session.room_number}` : ''}
            </span>
          </div>
        </div>
      </div>

      <p style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        {tr.menuPlanReviewChangeNote}
      </p>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24, cursor: 'pointer' }}>
        <input
          type="checkbox"
          className="checkbox-custom"
          checked={agreeTerms}
          onChange={e => onToggleAgree(e.target.checked)}
          style={{ marginTop: 2 }}
        />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-body)', lineHeight: 1.6 }}>
          {tr.agreeTermsPrefix}{' '}
          <button
            type="button"
            onClick={onOpenTerms}
            style={{ background: 'none', color: 'var(--brand-green-btn)', fontWeight: 700, textDecoration: 'underline', fontSize: '0.85rem', padding: 0, display: 'inline' }}
          >
            {tr.agreeTermsLink}
          </button>
        </span>
      </label>

      <button
        onClick={onPay}
        disabled={!agreeTerms || isSubmitting}
        className={agreeTerms && !isSubmitting ? 'anim-pulse-glow' : ''}
        style={{
          width: '100%', padding: 17, borderRadius: 14, fontWeight: 800, fontSize: '1rem',
          background: !agreeTerms ? '#d1d5db' : isSubmitting ? '#a7f3d0' : 'linear-gradient(135deg, #3D7A5A, #1A3C34)',
          color: 'white', cursor: (!agreeTerms || isSubmitting) ? 'not-allowed' : 'pointer',
          transition: 'background 0.25s ease, box-shadow 0.25s ease',
        }}
      >
        {isSubmitting ? tr.cartPlacing : tr.payNowBtn}
      </button>
    </div>
  );
}
