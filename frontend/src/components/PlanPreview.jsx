import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Utensils, RefreshCcw, AlertTriangle, Info } from 'lucide-react';

const MEAL_KEYS = ['morning', 'lunch', 'evening'];

function getMealLabel(tr) {
  return { morning: tr.menuMealMorning || 'Morning', lunch: tr.menuMealLunch || 'Lunch', evening: tr.menuMealEvening || 'Evening' };
}

// 'YYYY-MM-DD' -> "Tue, Aug 18" маягийн уншигдахуйц огноо (хуанлийн огноо тул
// UTC-ээр parse хийж локал TZ-ийн шилжилтээс зайлсхийнэ).
function formatPlanDate(dateStr, language) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  try {
    return dt.toLocaleDateString(language, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  } catch {
    return `${m}/${d}`;
  }
}

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

function MealSlot({ date, mealKey, label, options, selectedId, onSelect }) {
  const [swapping, setSwapping] = useState(false);
  const selected = options.find(o => o.menu_item_id === selectedId) || options[0];
  if (!selected) {
    return (
      <div style={{ padding: '14px 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>—</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--brand-green)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
        {options.length > 1 && (
          <button
            onClick={() => setSwapping(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
              background: swapping ? 'var(--brand-green)' : 'var(--bg-muted)', color: swapping ? '#fff' : 'var(--text-body)',
              fontSize: '0.72rem', fontWeight: 700,
            }}
          >
            <RefreshCcw size={11} /> {swapping ? 'Close' : 'Swap'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {selected.image_url ? (
          <img src={selected.image_url} alt="" style={{ width: 68, height: 68, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 68, height: 68, borderRadius: 14, background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Utensils size={26} color="var(--text-muted)" />
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-dark)' }}>{selected.name}</span>
            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--brand-green)', whiteSpace: 'nowrap' }}>${Number(selected.price_usd).toFixed(2)}</span>
          </div>
          {selected.description && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{selected.description}</p>
          )}
        </div>
      </div>

      {swapping && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {options.map(opt => (
            <button
              key={opt.menu_item_id}
              onClick={() => { onSelect(date, mealKey, opt.menu_item_id); setSwapping(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 6px', borderRadius: 10,
                background: opt.menu_item_id === selected.menu_item_id ? 'var(--bg-muted)' : 'var(--bg-card)',
                border: `1.5px solid ${opt.menu_item_id === selected.menu_item_id ? 'var(--brand-green)' : 'var(--border)'}`,
              }}
            >
              {opt.image_url
                ? <img src={opt.image_url} alt="" style={{ width: 30, height: 30, borderRadius: 7, objectFit: 'cover' }} />
                : <div style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--bg-muted)' }} />}
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)' }}>{opt.name}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>${Number(opt.price_usd).toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Зочны 12 хоногийн (эсвэл захиалсан огнооноос хамааран цөөн) огнооны цонхыг
// бодит огноогоор харуулж, слот бүрд (өдөр/цаг) admin-ийн тохируулсан ≤3
// сонголтын дундаас зочин сольж болно. Session үүсэхээс ӨМНӨ дуудагдана тул
// backend /api/menu/plan-window нь public.
export function PlanPreview({ dietTypeId, tr, language, onConfirmPlan, onBack }) {
  const [data, setData] = useState(null); // { available, start_date, end_date, day_count, days }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selections, setSelections] = useState({}); // { [date]: { [mealKey]: menu_item_id } }

  useEffect(() => {
    setLoading(true);
    const qs = dietTypeId ? `?diet_type_id=${dietTypeId}` : '';
    fetch(`/api/menu/plan-window${qs}`)
      .then(r => r.json())
      .then(json => {
        setData(json);
        if (json.available) {
          const init = {};
          for (const day of json.days) {
            init[day.date] = {};
            for (const meal of MEAL_KEYS) {
              init[day.date][meal] = day.meals[meal]?.[0]?.menu_item_id ?? null;
            }
          }
          setSelections(init);
        }
        setError('');
      })
      .catch(() => setError(tr.genericError || 'Failed to load plan.'))
      .finally(() => setLoading(false));
  }, [dietTypeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (date, mealKey, menuItemId) => {
    setSelections(prev => ({ ...prev, [date]: { ...prev[date], [mealKey]: menuItemId } }));
  };

  const total = useMemo(() => {
    if (!data?.days) return 0;
    let sum = 0;
    for (const day of data.days) {
      for (const meal of MEAL_KEYS) {
        const selectedId = selections[day.date]?.[meal];
        const opt = day.meals[meal]?.find(o => o.menu_item_id === selectedId) || day.meals[meal]?.[0];
        if (opt) sum += Number(opt.price_usd);
      }
    }
    return sum;
  }, [data, selections]);

  const handleConfirm = () => {
    if (!data?.available) return;
    const flatSelections = [];
    const reviewItems = [];
    for (const day of data.days) {
      for (const meal of MEAL_KEYS) {
        const selectedId = selections[day.date]?.[meal] ?? day.meals[meal]?.[0]?.menu_item_id;
        const opt = day.meals[meal]?.find(o => o.menu_item_id === selectedId);
        if (!selectedId || !opt) continue;
        flatSelections.push({ plan_date: day.date, meal_time: meal, menu_item_id: selectedId });
        reviewItems.push({ date: day.date, meal, name: opt.name, price_usd: opt.price_usd });
      }
    }
    onConfirmPlan(flatSelections, total, reviewItems);
  };

  const mealLabels = getMealLabel(tr);

  return (
    <div className="anim-fade-up" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 0 140px' }}>
      <BackButton label={tr.back} onBack={onBack} />
      <h2 className="heading-lg" style={{ marginBottom: 8 }}>{tr.menuPlanTitle}</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>{tr.menuPlanSubtitle}</p>

      <div style={{
        background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 24,
      }}>
        <Info size={17} color="var(--brand-green-light)" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: '0.83rem', color: 'var(--text-body)', lineHeight: 1.55 }}>{tr.menuPlanInfoNote}</p>
      </div>

      {loading && <p style={{ color: 'var(--text-muted)' }}>{tr.loading || 'Loading...'}</p>}

      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px 14px', borderRadius: 10, fontSize: '0.85rem', marginBottom: 16 }}>{error}</div>
      )}

      {!loading && data && !data.available && (
        <div className="card" style={{
          padding: 24, display: 'flex', gap: 12, alignItems: 'flex-start',
          background: '#fffbeb', border: '1px solid #fde68a',
        }}>
          <AlertTriangle size={22} color="#92400e" style={{ flexShrink: 0 }} />
          <p style={{ color: '#92400e', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {tr.menuPlanUnavailable || 'There is no active 12-day cycle available to order right now. Please check back soon.'}
          </p>
        </div>
      )}

      {!loading && data?.available && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {data.days.map(day => (
            <div key={day.date} className="card" style={{ padding: '18px 22px' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-dark)' }}>
                {formatPlanDate(day.date, language)}
              </div>
              {MEAL_KEYS.map(meal => (
                <MealSlot
                  key={meal}
                  date={day.date}
                  mealKey={meal}
                  label={mealLabels[meal]}
                  options={day.meals[meal] || []}
                  selectedId={selections[day.date]?.[meal]}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {!loading && data?.available && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
          background: 'var(--bg-card)', borderTop: '1px solid var(--border)',
          boxShadow: '0 -6px 20px rgba(0,0,0,0.06)', padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
        }}>
          <div style={{ display: 'flex', flexDirection: 'row', maxWidth: 900, width: '100%', margin: '0 auto', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                {data.day_count} {tr.menuPlanDaysLabel || 'days'}
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--brand-green)' }}>${total.toFixed(2)}</div>
            </div>
            <button id="confirm-plan-btn" className="btn-primary" onClick={handleConfirm} style={{ padding: '14px 32px', borderRadius: 14 }}>
              {tr.menuPlanConfirm}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
