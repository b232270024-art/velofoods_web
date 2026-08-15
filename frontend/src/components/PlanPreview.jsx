import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Utensils, RefreshCcw, AlertTriangle, Info, Check, Sunrise, Sun, Moon, CalendarClock } from 'lucide-react';
import { InlineDateRangePicker } from './InlineDateRangePicker';
import { AddonScheduleModal, ScheduleSummary } from './AddonScheduleModal';

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
// admin-ийн is_addon_recommended гэж тэмдэглэсэн зүйлсээс зочин хэдэн ч зүйл
// сонгож болно (multi-select). Хэдэн өдөр/аль цагт хүргэгдэхийг дараа нь
// AddonScheduleModal-оор тус тусад нь тохируулна.
function AddonSection({ menuItems, tr, selectedIds, onToggle }) {
  const options = menuItems.filter(i => i.is_addon_recommended && i.available !== false);
  if (options.length === 0) return null;

  return (
    <div className="card" style={{ padding: '18px 22px', marginTop: 16 }}>
      <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>
        {tr.menuPlanAddonTitle || 'One more thing?'}
      </h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
        {tr.menuPlanAddonDesc || 'Our picks for you — choose as many as you\'d like, then pick which days to receive them.'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
        {options.map(item => {
          const active = selectedIds.includes(item.id);
          return (
            <button
              key={item.id}
              onClick={() => onToggle(item.id)}
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
  // Зочны сонгосон нэмэлт (addon) зүйлсийн ID (сонгосон дараалалтай) + тус
  // бүрийн хүргэлтийн хуваарь (хэдэн өдөр, аль цагт).
  const [addonSelectedIds, setAddonSelectedIds] = useState([]);
  const [addonSchedules, setAddonSchedules] = useState({}); // { [menu_item_id]: { mode, dates: string[], meal_time } }
  const [addonModalOpen, setAddonModalOpen] = useState(false);
  // Зочин 12 хоногийн турш өдрийн хоол (lunch) авахгүй бол true — бүх өдрийн
  // lunch сонголт нийт үнэ болон эцсийн захиалгаас алгасагдана.
  const [skipLunch, setSkipLunch] = useState(false);

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
          setStartDate(json.start_date);
          // Default to 12 days for convenience
          const ed = new Date(json.start_date);
          ed.setUTCDate(ed.getUTCDate() + 11);
          setEndDate(ed.toISOString().slice(0, 10));
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

  // Generate dynamic days array based on startDate and endDate
  const dynamicDays = useMemo(() => {
    if (!data?.template_days || !startDate || !endDate) return [];
    if (endDate < startDate) return [];
    const sy = parseInt(startDate.slice(0, 4)), sm = parseInt(startDate.slice(5, 7)), sd = parseInt(startDate.slice(8, 10));
    const ey = parseInt(endDate.slice(0, 4)), em = parseInt(endDate.slice(5, 7)), ed = parseInt(endDate.slice(8, 10));
    const s = Date.UTC(sy, sm - 1, sd);
    const e = Date.UTC(ey, em - 1, ed);
    const count = Math.max(0, Math.round((e - s) / 86400000)) + 1;
    
    const maxDayNum = data.template_days.length;
    if (maxDayNum === 0) return [];

    const daysArr = [];
    for (let i = 0; i < count; i++) {
      const dt = new Date(Date.UTC(sy, sm - 1, sd + i));
      const dateStr = dt.toISOString().slice(0, 10);
      // Map to template day_number (1-indexed, loops if user selects more days than admin defined)
      const dayNum = (i % maxDayNum) + 1;
      const template = data.template_days.find(td => td.day_number === dayNum) || { meals: {} };
      daysArr.push({ date: dateStr, day_number: dayNum, meals: template.meals });
    }
    return daysArr;
  }, [data, startDate, endDate]);

  // Re-initialize selections if dates or template change
  useEffect(() => {
    if (dynamicDays.length > 0) {
      setSelections(prev => {
        const init = { ...prev };
        for (const day of dynamicDays) {
          if (!init[day.date]) {
            init[day.date] = {};
            for (const meal of MEAL_KEYS) {
              init[day.date][meal] = {};
              for (const [category, options] of Object.entries(day.meals[meal] || {})) {
                init[day.date][meal][category] = options[0]?.menu_item_id ?? null;
              }
            }
          }
        }
        return init;
      });
      if (!activeDate || !dynamicDays.find(d => d.date === activeDate)) {
        setActiveDate(dynamicDays[0]?.date ?? null);
      }
    }
  }, [dynamicDays]);

  const validDates = useMemo(() => dynamicDays.map(d => d.date), [dynamicDays]);

  const addonItems = useMemo(
    () => addonSelectedIds.map(id => menuItems.find(i => i.id === id)).filter(Boolean),
    [addonSelectedIds, menuItems]
  );

  const handleAddonToggle = (id) => {
    setAddonSelectedIds(prev => {
      if (prev.includes(id)) {
        setAddonSchedules(s => { const next = { ...s }; delete next[id]; return next; });
        return prev.filter(x => x !== id);
      }
      setAddonSchedules(s => ({
        ...s,
        [id]: { mode: 'once', dates: validDates.slice(0, 1), meal_time: 'morning' },
      }));
      return [...prev, id];
    });
  };

  const handleAddonScheduleChange = (id, patch) => {
    setAddonSchedules(prev => ({ ...prev, [id]: patch }));
  };

  // skipLunch асаагдвал нэмэлт зүйлсийн lunch цагт хуваарилагдсан
  // хуваариудыг morning руу автоматаар шилжүүлнэ — эс бөгөөс lunch байхгүй
  // өдөр нэмэлт хоол ч lunch-аар "хүргэгдэх" зөрчилтэй төлөв үлдэнэ.
  useEffect(() => {
    if (!skipLunch) return;
    setAddonSchedules(prev => {
      let changed = false;
      const next = { ...prev };
      for (const [id, sched] of Object.entries(prev)) {
        if (sched.meal_time === 'lunch') {
          next[id] = { ...sched, meal_time: 'morning' };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [skipLunch]);

  // Огнооны цонх (validDates) өөрчлөгдвөл нэмэлт зүйлсийн хуваарийг цонхны
  // дотор байлгана — daily горим шинэ бүх өдрийг автоматаар дагана, бусад
  // горимд цонхны гадуур унасан огноог хасна.
  useEffect(() => {
    if (validDates.length === 0) return;
    setAddonSchedules(prev => {
      let changed = false;
      const next = { ...prev };
      const validSet = new Set(validDates);
      for (const [id, sched] of Object.entries(prev)) {
        if (sched.mode === 'daily') {
          if (sched.dates.length !== validDates.length || sched.dates.some((d, i) => d !== validDates[i])) {
            next[id] = { ...sched, dates: validDates };
            changed = true;
          }
          continue;
        }
        const kept = sched.dates.filter(d => validSet.has(d));
        if (kept.length !== sched.dates.length) {
          next[id] = { ...sched, dates: kept.length ? kept : validDates.slice(0, 1) };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [validDates]);

  const addonTotal = useMemo(() => {
    let sum = 0;
    for (const id of addonSelectedIds) {
      const item = menuItems.find(i => i.id === id);
      const sched = addonSchedules[id];
      if (item && sched) sum += Number(item.price_usd) * sched.dates.length;
    }
    return sum;
  }, [addonSelectedIds, addonSchedules, menuItems]);

  const total = useMemo(() => {
    if (!dynamicDays.length) return addonTotal;
    let sum = 0;
    for (const day of dynamicDays) {
      for (const meal of MEAL_KEYS) {
        if (skipLunch && meal === 'lunch') continue;
        for (const [category, options] of Object.entries(day.meals[meal] || {})) {
          const selectedId = selections[day.date]?.[meal]?.[category];
          const opt = options.find(o => o.menu_item_id === selectedId) || options[0];
          if (opt) sum += Number(opt.price_usd);
        }
      }
    }
    return sum + addonTotal;
  }, [dynamicDays, selections, skipLunch, addonTotal]);

  const handleConfirm = () => {
    if (!data?.available || dynamicDays.length === 0) return;
    const flatSelections = [];
    const reviewItems = [];
    for (const day of dynamicDays) {
      for (const meal of MEAL_KEYS) {
        if (skipLunch && meal === 'lunch') continue;
        for (const [category, options] of Object.entries(day.meals[meal] || {})) {
          const selectedId = selections[day.date]?.[meal]?.[category] ?? options[0]?.menu_item_id;
          const opt = options.find(o => o.menu_item_id === selectedId);
          if (!selectedId || !opt) continue;
          flatSelections.push({ plan_date: day.date, meal_time: meal, menu_item_id: selectedId });
          reviewItems.push({ date: day.date, meal, category, name: opt.name, price_usd: opt.price_usd, is_addon: false });
        }
      }
    }

    const addonsFlat = [];
    for (const id of addonSelectedIds) {
      const item = menuItems.find(i => i.id === id);
      const sched = addonSchedules[id];
      if (!item || !sched) continue;
      for (const date of sched.dates) {
        addonsFlat.push({ plan_date: date, meal_time: sched.meal_time, menu_item_id: id });
        reviewItems.push({
          date, meal: sched.meal_time, category: tr.menuPlanAddonReviewLabel || 'Extra',
          name: item.name, price_usd: item.price_usd, is_addon: true,
        });
      }
    }

    onConfirmPlan(flatSelections, total, reviewItems, addonsFlat, skipLunch);
  };

  const mealLabels = getMealLabel(tr);
  const activeDay = dynamicDays.find(d => d.date === activeDate);

  return (
    <div className="anim-fade-up" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 0 140px' }}>
      <BackButton label={tr.back} onBack={onBack} />
      {/* The date range selector has been moved below */}
      <h2 className="heading-lg" style={{ marginBottom: 8 }}>{tr.menuPlanTitle}</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>{tr.menuPlanSubtitle}</p>

      <div style={{
        background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 24,
      }}>
        <Info size={17} color="var(--brand-green-light)" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: '0.83rem', color: 'var(--text-body)', lineHeight: 1.55 }}>{tr.menuPlanInfoNote}</p>
      </div>

      {data?.available && (
        <InlineDateRangePicker 
          startDate={startDate} 
          endDate={endDate} 
          minDate={data.start_date}
          onSelectRange={(start, end) => {
            setStartDate(start);
            setEndDate(end);
          }}
        />
      )}


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
            if (dynamicDays.length === 0) return <p style={{ color: 'var(--text-muted)' }}>{tr.menuPlanUnavailable || 'No days available for this date range.'}</p>;
            const dates = dynamicDays.map(d => d.date);
            const active = dates.includes(activeDate) ? activeDate : dates[0];
            const currentDay = dynamicDays.find(d => d.date === active);
            if (!currentDay) return null;
            return (
              <>
                <DayTabs dates={dates} activeDate={active} onSelect={setActiveDate} language={language} />

                <div className="card" style={{ padding: '18px 22px', background: 'var(--bg-muted)' }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
                    paddingBottom: 14, marginBottom: 16, borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-body)', lineHeight: 1.45 }}>
                      {tr.menuPlanSkipLunchLabel}
                    </span>
                    <span style={{
                      position: 'relative', flexShrink: 0, width: 40, height: 24, borderRadius: 999,
                      background: skipLunch ? 'var(--brand-green)' : 'var(--border)', transition: 'background 0.2s',
                    }}>
                      <input
                        type="checkbox"
                        checked={skipLunch}
                        onChange={e => setSkipLunch(e.target.checked)}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', margin: 0 }}
                      />
                      <span style={{
                        position: 'absolute', top: 3, left: skipLunch ? 19 : 3, width: 18, height: 18, borderRadius: '50%',
                        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.2s',
                      }} />
                    </span>
                  </label>

                  <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-dark)' }}>
                    {formatFullDate(currentDay.date, language)}
                  </div>
                  {MEAL_KEYS.map(meal => (
                    meal === 'lunch' && skipLunch ? (
                      <div key={meal} style={{
                        marginTop: 26, padding: '12px 14px', borderRadius: 12,
                        background: 'var(--bg-card)', border: '1px dashed var(--border)',
                        fontSize: '0.83rem', color: 'var(--text-muted)', fontWeight: 600,
                      }}>
                        {mealLabels.lunch} — {tr.menuPlanSkipLunchBadge}
                      </div>
                    ) : (
                      <MealTimeSection
                        key={meal}
                        date={currentDay.date}
                        mealKey={meal}
                        label={mealLabels[meal]}
                        categories={currentDay.meals[meal] || {}}
                        selections={selections[currentDay.date]?.[meal]}
                        onSelect={handleSelect}
                      />
                    )
                  ))}
                </div>

                <AddonSection menuItems={menuItems} tr={tr} selectedIds={addonSelectedIds} onToggle={handleAddonToggle} />

                {addonItems.length > 0 && (
                  <div
                    className="card"
                    style={{
                      width: '100%', marginTop: 12, padding: '14px 16px',
                      display: 'flex', alignItems: 'center', gap: 12,
                      border: '1px solid var(--border-card)',
                    }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 9, background: 'var(--bg-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <CalendarClock size={17} color="var(--brand-green)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-dark)' }}>
                        {tr.menuPlanAddonScheduleBtn} — {addonItems.length}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        +${addonTotal.toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={() => setAddonModalOpen(true)}
                      className="btn-primary"
                      style={{ padding: '9px 18px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, flexShrink: 0 }}
                    >
                      {tr.menuPlanAddonConfigureBtn}
                    </button>
                  </div>
                )}

                {addonItems.length > 0 && (
                  <ScheduleSummary items={addonItems} schedules={addonSchedules} mealLabels={mealLabels} tr={tr} language={language} />
                )}
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
                {dynamicDays.length} {tr.menuPlanDaysLabel || 'days'}{addonItems.length > 0 ? ` + ${addonItems.length}` : ''}
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--brand-green)' }}>${total.toFixed(2)}</div>
            </div>
            <button id="confirm-plan-btn" className="btn-primary" onClick={handleConfirm} style={{ padding: '14px 32px', borderRadius: 14 }}>
              {tr.menuPlanConfirm}
            </button>
          </div>
        </div>
      )}

      <AddonScheduleModal
        isOpen={addonModalOpen}
        onClose={() => setAddonModalOpen(false)}
        items={addonItems}
        schedules={addonSchedules}
        onChangeSchedule={handleAddonScheduleChange}
        validDates={validDates}
        skipLunch={skipLunch}
        mealLabels={mealLabels}
        tr={tr}
        language={language}
      />
    </div>
  );
}
