import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Utensils, RefreshCcw, AlertTriangle, Info, Check, Sunrise, Sun, Moon } from 'lucide-react';

const MEAL_KEYS = ['morning', 'lunch', 'evening'];

function getMealLabel(tr) {
  return { morning: tr.menuMealMorning || 'Morning', lunch: tr.menuMealLunch || 'Lunch', evening: tr.menuMealEvening || 'Evening' };
}

// Цаг тус бүрийг нэг харцаар ялгаж танихад зориулсан icon + өнгө (Өглөө/Өдөр/
// Орой) — MealTimeSection-ий гарчгийг тод, бие даасан блок болгоход ашиглана.
const MEAL_STYLE = {
  morning: { icon: Sunrise, color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  lunch:   { icon: Sun,     color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  evening: { icon: Moon,    color: '#4338ca', bg: '#eef2ff', border: '#c7d2fe' },
};

// 'YYYY-MM-DD' -> Date (UTC-ээр parse хийнэ — хуанлийн огноо тул локал TZ-ийн шилжилтээс зайлсхийнэ)
function parsePlanDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Өдрийн сонголтын tab-д зориулсан богино "сар / өдөр" хос (жишээ нь "Aug" / "17").
function formatTabParts(dateStr, language) {
  const dt = parsePlanDate(dateStr);
  let month;
  try {
    month = dt.toLocaleDateString(language, { month: 'short', timeZone: 'UTC' });
  } catch {
    month = String(dt.getUTCMonth() + 1);
  }
  return { month, day: dt.getUTCDate() };
}

// Сонгосон өдрийн дээрх дэлгэрэнгүй гарчиг (жишээ нь "Tuesday, August 18").
function formatFullDate(dateStr, language) {
  const dt = parsePlanDate(dateStr);
  try {
    return dt.toLocaleDateString(language, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  } catch {
    return dateStr;
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

// Дээд талын өдрийн сонголт — нэг мөр segmented control, идэвхтэй өдөр
// бараан дэвсгэртэй тод харагдана. Олон өдөр орвол хажуу тийш scroll хийнэ.
function DayTabs({ dates, activeDate, onSelect, language }) {
  return (
    <div style={{
      display: 'flex', border: '1.5px solid var(--border)', borderRadius: 14,
      overflowX: 'auto', marginBottom: 20, background: 'var(--bg-card)',
    }}>
      {dates.map((date, idx) => {
        const { month, day } = formatTabParts(date, language);
        const active = date === activeDate;
        return (
          <button
            key={date}
            onClick={() => onSelect(date)}
            style={{
              flex: '0 0 auto', minWidth: 66, padding: '10px 12px', textAlign: 'center',
              borderRight: idx === dates.length - 1 ? 'none' : '1px solid var(--border)',
              background: active ? 'var(--text-dark)' : 'transparent',
              color: active ? '#fff' : 'var(--text-body)',
              transition: 'background 0.15s',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 700, opacity: active ? 0.85 : 0.6 }}>{month}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: active ? 800 : 700 }}>{day}</div>
          </button>
        );
      })}
    </div>
  );
}

// Нэг ангиллын (жишээ нь "Main Course") дотор зочны сонгосон хоол + swap —
// том, тод карт хэлбэрээр (зураг том, нэр/үнэ илүү тодоор) харагдана. Meal-time
// (Өглөө/Өдөр/Орой) нь эцэг MealTimeSection-д нэг л удаа гарчиг болж
// харагддаг тул энд caption нь АНГИЛЛЫН нэр байна.
function CategorySlot({ date, mealKey, category, options, selectedId, onSelect, accentColor }) {
  const [swapping, setSwapping] = useState(false);
  const selected = options.find(o => o.menu_item_id === selectedId) || options[0];
  if (!selected) return null;

  return (
    <div className="card" style={{ padding: 18, marginTop: 10, border: '1px solid var(--border-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: accentColor || 'var(--brand-green)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{category}</span>
        {options.length > 1 && (
          <button
            onClick={() => setSwapping(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 999,
              background: swapping ? 'var(--brand-green)' : 'var(--bg-muted)', color: swapping ? '#fff' : 'var(--text-body)',
              fontSize: '0.75rem', fontWeight: 700,
            }}
          >
            <RefreshCcw size={12} /> {swapping ? 'Close' : 'Swap'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {selected.image_url ? (
          <img src={selected.image_url} alt="" style={{ width: 104, height: 104, borderRadius: 16, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 104, height: 104, borderRadius: 16, background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Utensils size={34} color="var(--text-muted)" />
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-dark)', lineHeight: 1.25 }}>{selected.name}</span>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--brand-green)', whiteSpace: 'nowrap' }}>${Number(selected.price_usd).toFixed(2)}</span>
          </div>
          {selected.description && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.55 }}>{selected.description}</p>
          )}
        </div>
      </div>

      {swapping && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {options.map(opt => (
            <button
              key={opt.menu_item_id}
              onClick={() => { onSelect(date, mealKey, category, opt.menu_item_id); setSwapping(false); }}
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

// Нэг цагийн (Өглөө/Өдөр/Орой) бүлэг — гарчиг нэг л удаа, дотор нь тухайн
// цагт admin-ийн тохируулсан ангилал тус бүрийг (Main Course, Soup, Snack гэх
// мэт) тусдаа CategorySlot болгож жагсаана. Ямар ч ангилал тохируулаагүй бол
// юу ч харуулахгүй (admin ямар ч ангилал нэмээгүй бол тухайн цаг алгасагдана).
function MealTimeSection({ date, mealKey, label, categories, selections, onSelect }) {
  const categoryEntries = Object.entries(categories);
  if (categoryEntries.length === 0) return null;

  const cfg = MEAL_STYLE[mealKey] || MEAL_STYLE.morning;
  const Icon = cfg.icon;

  return (
    <div style={{ marginBottom: 6, marginTop: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, background: cfg.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={16} color={cfg.color} strokeWidth={2.25} />
        </div>
        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-dark)', letterSpacing: 0.1 }}>
          {label}
        </span>
      </div>
      {categoryEntries.map(([category, options]) => (
        <CategorySlot
          key={category}
          date={date}
          mealKey={mealKey}
          category={category}
          options={options}
          selectedId={selections?.[category]}
          onSelect={onSelect}
          accentColor={cfg.color}
        />
      ))}
    </div>
  );
}

// Хуудасны доод хэсэгт байнга байрлах "Санал болгох" нэмэлт зүйлийн сонголт —
// admin-ийн is_addon_recommended гэж тэмдэглэсэн зүйлсээс зочин дан ганц (эсвэл
// юу ч биш) сонгоно. Дахин дарвал сонголтоо цуцална.
function AddonSection({ menuItems, tr, addonId, onSelect }) {
  const options = menuItems.filter(i => i.is_addon_recommended && i.available !== false);
  if (options.length === 0) return null;

  return (
    <div className="card" style={{ padding: '18px 22px', marginTop: 16 }}>
      <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>
        {tr.menuPlanAddonTitle || 'One more thing?'}
      </h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
        {tr.menuPlanAddonDesc || 'Our pick for you — add it to tomorrow\'s delivery. Optional, pick at most one.'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
        {options.map(item => {
          const active = addonId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(active ? null : item.id)}
              style={{
                textAlign: 'left', padding: 0, overflow: 'hidden', borderRadius: 12,
                border: active ? '2px solid var(--brand-green)' : '1px solid var(--border-card)',
                position: 'relative', background: 'var(--bg-card)',
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%',
                  background: 'var(--brand-green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                }}>
                  <Check size={13} />
                </div>
              )}
              <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Utensils size={26} color="var(--text-muted)" />}
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-dark)', marginBottom: 4 }}>{item.name}</div>
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--brand-green)' }}>${Number(item.price_usd).toFixed(2)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Зочны 12 хоногийн (эсвэл захиалсан огнооноос хамааран цөөн) огнооны цонхыг
// бодит огноогоор харуулж, дээд талд өдөр сонгох tab-аар аль өдрийг харахаа
export function PlanPreview({ dietTypeId, menuItems, tr, language, onConfirmPlan, onBack }) {
  const [data, setData] = useState(null); // { available, start_date, end_date, day_count, days }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selections, setSelections] = useState({}); // { [date]: { [mealKey]: { [category]: menu_item_id } } }
  const [activeDate, setActiveDate] = useState(null);
  const [addonId, setAddonId] = useState(null);
  // New UI state for admin to add extra day (client‑side placeholder)
  const addExtraDay = (newDate) => {
    if (!data?.days) return;
    // Avoid duplicate dates
    if (data.days.some(d => d.date === newDate)) return;
    const emptyDay = {
      date: newDate,
      meals: {},
    };
    setData(prev => ({
      ...prev,
      days: [...prev.days, emptyDay].sort((a, b) => a.date.localeCompare(b.date)),
      day_count: (prev.day_count || 0) + 1,
    }));
  };
  // New state for user-selected date range
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState(''); // YYYY-MM-DD
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
              init[day.date][meal] = {};
              for (const [category, options] of Object.entries(day.meals[meal] || {})) {
                init[day.date][meal][category] = options[0]?.menu_item_id ?? null;
              }
            }
          }
          setSelections(init);
          setActiveDate(json.days[0]?.date ?? null);
        }
        setError('');
      })
      .catch(() => setError(tr.genericError || 'Failed to load plan.'))
      .finally(() => setLoading(false));
  }, [dietTypeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (date, mealKey, category, menuItemId) => {
    setSelections(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [mealKey]: { ...prev[date]?.[mealKey], [category]: menuItemId },
      },
    }));
  };

  const addonItem = addonId ? menuItems.find(i => i.id === addonId) : null;

  const total = useMemo(() => {
    if (!data?.days) return 0;
    let sum = 0;
    // Determine which days are within the selected range
    const relevantDays = data.days.filter(d => {
      if (startDate && d.date < startDate) return false;
      if (endDate && d.date > endDate) return false;
      return true;
    });
    for (const day of relevantDays) {
      for (const meal of MEAL_KEYS) {
        for (const [category, options] of Object.entries(day.meals[meal] || {})) {
          const selectedId = selections[day.date]?.[meal]?.[category];
          const opt = options.find(o => o.menu_item_id === selectedId) || options[0];
          if (opt) sum += Number(opt.price_usd);
        }
      }
    }
    if (addonItem) sum += Number(addonItem.price_usd);
    return sum;
  }, [data, selections, addonItem, startDate, endDate]);

  const handleConfirm = () => {
    if (!data?.available) return;
    const flatSelections = [];
    const reviewItems = [];
    for (const day of data.days) {
      for (const meal of MEAL_KEYS) {
        for (const [category, options] of Object.entries(day.meals[meal] || {})) {
          const selectedId = selections[day.date]?.[meal]?.[category] ?? options[0]?.menu_item_id;
          const opt = options.find(o => o.menu_item_id === selectedId);
          if (!selectedId || !opt) continue;
          flatSelections.push({ plan_date: day.date, meal_time: meal, menu_item_id: selectedId });
          reviewItems.push({ date: day.date, meal, category, name: opt.name, price_usd: opt.price_usd });
        }
      }
    }
    onConfirmPlan(flatSelections, total, reviewItems, addonId);
  };

  const mealLabels = getMealLabel(tr);
  const activeDay = data?.days?.find(d => d.date === activeDate);

  return (
    <div className="anim-fade-up" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 0 140px' }}>
      <BackButton label={tr.back} onBack={onBack} />
      {/* Date range selector */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-body)' }}>{tr.startDateLabel || 'Start Date'}:</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-full)' }} />
        <label style={{ fontSize: '0.85rem', color: 'var(--text-body)' }}>{tr.endDateLabel || 'End Date'}:</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-full)' }} />
      </div>
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
        <>
          {(() => {
            const filtered = data.days.filter(d => {
              if (startDate && d.date < startDate) return false;
              if (endDate && d.date > endDate) return false;
              return true;
            });
            const dates = filtered.map(d => d.date);
            const active = dates.includes(activeDate) ? activeDate : dates[0];
            const currentDay = filtered.find(d => d.date === active);
            if (!currentDay) return null;
            return (
              <>
                <DayTabs dates={dates} activeDate={active} onSelect={setActiveDate} language={language} />

                <div className="card" style={{ padding: '18px 22px', background: 'var(--bg-muted)' }}>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-dark)' }}>
                    {formatFullDate(currentDay.date, language)}
                  </div>
                  {MEAL_KEYS.map(meal => (
                    <MealTimeSection
                      key={meal}
                      date={currentDay.date}
                      mealKey={meal}
                      label={mealLabels[meal]}
                      categories={currentDay.meals[meal] || {}}
                      selections={selections[currentDay.date]?.[meal]}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>

                <AddonSection menuItems={menuItems} tr={tr} addonId={addonId} onSelect={setAddonId} />
              </>
            );
          })()}

        </>
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
                {data.day_count} {tr.menuPlanDaysLabel || 'days'}{addonItem ? ' + 1' : ''}
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--brand-green)' }}>${total.toFixed(2)}</div>
            </div>
            {/* Admin: Add extra day button (client‑side only) */}
            <button onClick={() => {
              const newDate = prompt('Enter new day (YYYY-MM-DD)');
              if (newDate) addExtraDay(newDate);
            }} style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--brand-green)', color: '#fff', marginRight: 8 }}>
              {tr.addDayBtn || 'Add Day'}
            </button>
            <button id="confirm-plan-btn" className="btn-primary" onClick={handleConfirm} style={{ padding: '14px 32px', borderRadius: 14 }}>
              {tr.menuPlanConfirm}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
