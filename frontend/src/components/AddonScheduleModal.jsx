import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Utensils, Check } from 'lucide-react';

// 'YYYY-MM-DD' -> Date (UTC-ээр parse хийнэ, PlanPreview-тэй адил дүрэм)
function parsePlanDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// validDates (зочны сонгосон 12 хоногийн цонх)-оос гадуурх огноог идэвхгүй
// болгосон жижиг сар-грид календарь. Сонгосон horим (once/custom)-оос
// хамааран нэг огноог орлуулах эсвэл нэмэх/хасах нь дуудагч талд шийдэгдэнэ.
function BoundedCalendar({ validDates, selected, onToggle, language }) {
  const validSet = useMemo(() => new Set(validDates), [validDates]);
  const first = validDates.length ? parsePlanDate(validDates[0]) : new Date();
  const last = validDates.length ? parsePlanDate(validDates[validDates.length - 1]) : first;
  const [month, setMonth] = useState(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1)));

  const days = useMemo(() => {
    const year = month.getUTCFullYear();
    const mo = month.getUTCMonth();
    const firstDow = new Date(Date.UTC(year, mo, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, mo + 1, 0)).getUTCDate();
    const startOffset = (firstDow + 6) % 7; // Monday = 0
    const arr = [];
    for (let i = 0; i < startOffset; i++) arr.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      arr.push(new Date(Date.UTC(year, mo, i)).toISOString().slice(0, 10));
    }
    return arr;
  }, [month]);

  const canPrev = month.getTime() > Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1);
  const canNext = month.getTime() < Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1);
  const monthLabel = (() => {
    try {
      return month.toLocaleDateString(language, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    } catch {
      return `${month.getUTCFullYear()}-${month.getUTCMonth() + 1}`;
    }
  })();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))}
          style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--bg-muted)', opacity: canPrev ? 1 : 0.3, cursor: canPrev ? 'pointer' : 'not-allowed' }}
        >‹</button>
        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-dark)' }}>{monthLabel}</span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))}
          style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--bg-muted)', opacity: canNext ? 1 : 0.3, cursor: canNext ? 'pointer' : 'not-allowed' }}
        >›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {days.map((dateStr, idx) => {
          if (!dateStr) return <div key={idx} />;
          const isValid = validSet.has(dateStr);
          const isSelected = selected.includes(dateStr);
          return (
            <button
              key={dateStr}
              type="button"
              disabled={!isValid}
              onClick={() => onToggle(dateStr)}
              style={{
                padding: '7px 0', fontSize: '0.76rem', borderRadius: 7, border: 'none',
                background: isSelected ? 'var(--brand-green)' : 'transparent',
                color: isSelected ? '#fff' : isValid ? 'var(--text-body)' : 'var(--text-muted)',
                fontWeight: isSelected ? 800 : 500,
                cursor: isValid ? 'pointer' : 'not-allowed',
                opacity: isValid ? 1 : 0.35,
              }}
            >
              {parseInt(dateStr.slice(8, 10), 10)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ModePill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700,
        background: active ? 'var(--brand-green)' : 'var(--bg-muted)',
        color: active ? '#fff' : 'var(--text-body)', border: 'none', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

// Огноо тус бүрийг богино "сар өдөр" хэлбэрээр товчлон харуулна (жишээ нь "Aug 17").
function formatShortDates(dates, language) {
  return dates
    .map(d => {
      try {
        return parsePlanDate(d).toLocaleDateString(language, { month: 'short', day: 'numeric', timeZone: 'UTC' });
      } catch {
        return d;
      }
    })
    .join(', ');
}

function AddonItemRow({ item, schedule, validDates, skipLunch, mealLabels, onChange, tr, language }) {
  const mealOptions = ['morning', 'lunch', 'evening'].filter(m => !(skipLunch && m === 'lunch'));
  const dates = schedule.dates || [];

  const setMode = (mode) => {
    if (mode === 'daily') onChange({ ...schedule, mode, dates: validDates });
    else if (mode === 'once') onChange({ ...schedule, mode, dates: dates.slice(0, 1).length ? dates.slice(0, 1) : validDates.slice(0, 1) });
    else onChange({ ...schedule, mode, dates: dates.length ? dates : validDates.slice(0, 1) });
  };

  const toggleDate = (dateStr) => {
    if (schedule.mode === 'once') {
      onChange({ ...schedule, dates: [dateStr] });
    } else {
      const has = dates.includes(dateStr);
      onChange({ ...schedule, dates: has ? dates.filter(d => d !== dateStr) : [...dates, dateStr].sort() });
    }
  };

  const price = Number(item.price_usd);
  const lineTotal = price * dates.length;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        {item.image_url ? (
          <img src={item.image_url} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{
            width: 52, height: 52, borderRadius: 10, background: 'var(--bg-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Utensils size={20} color="var(--text-muted)" />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{item.name}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            ${price.toFixed(2)} × {dates.length} = <strong style={{ color: 'var(--brand-green)' }}>${lineTotal.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', marginBottom: 8 }}>
        <ModePill active={schedule.mode === 'once'} onClick={() => setMode('once')}>{tr.addonModeOnce}</ModePill>
        <ModePill active={schedule.mode === 'daily'} onClick={() => setMode('daily')}>{tr.addonModeDaily}</ModePill>
        <ModePill active={schedule.mode === 'custom'} onClick={() => setMode('custom')}>{tr.addonModeCustom}</ModePill>
      </div>

      {mealOptions.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', marginBottom: 10 }}>
          {mealOptions.map(m => (
            <ModePill key={m} active={schedule.meal_time === m} onClick={() => onChange({ ...schedule, meal_time: m })}>
              {mealLabels[m]}
            </ModePill>
          ))}
        </div>
      )}

      {schedule.mode === 'daily' ? (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '8px 0 2px' }}>
          {tr.addonDeliveredAllDays} ({validDates.length})
        </div>
      ) : (
        <BoundedCalendar validDates={validDates} selected={dates} onToggle={toggleDate} language={language} />
      )}
    </div>
  );
}

// Бүх сонгосон нэмэлт зүйлийн эцсийн тохиргоог нэг харцаар харуулах жагсаалт
// — PlanPreview-д "Schedule your extras" мөрийн доор (modal дотор биш)
// байнга харагдаж, зочин Configure дарж тохируулах бүрдээ юу сонгосноо
// шууд харна.
export function ScheduleSummary({ items, schedules, mealLabels, tr, language }) {
  return (
    <div style={{
      marginTop: 12, padding: '12px 14px', borderRadius: 12,
      background: 'var(--bg-muted)', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Check size={14} color="var(--brand-green)" />
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)' }}>
          {tr.menuPlanAddonSummaryTitle}
        </span>
      </div>
      {items.map(item => {
        const sched = schedules[item.id];
        if (!sched) return null;
        const modeLabel = sched.mode === 'once' ? tr.addonModeOnce : sched.mode === 'daily' ? tr.addonModeDaily : tr.addonModeCustom;
        return (
          <div key={item.id} style={{ fontSize: '0.78rem', color: 'var(--text-body)', padding: '3px 0', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-dark)' }}>{item.name}</strong> — {modeLabel}, {mealLabels[sched.meal_time]}
            {sched.mode !== 'daily' && <> ({formatShortDates(sched.dates, language)})</>}
          </div>
        );
      })}
    </div>
  );
}

// Зочин "One more thing?"-с multi-select хийсэн нэмэлт хоол тус бүрийг хэдэн
// өдөр (нэг л удаа / өдөр бүр / тодорхой өдрүүд), аль цагт (өглөө/өдөр/орой)
// авахаа тохируулах цонх. Тус тусад нь тохируулдаг тул зочин 3 зүйлийг нэг
// өдөрт хамт эсвэл тус тусад нь өөр өдрүүдэд хуваарилах аль алиныг хийж чадна.
//
// document.body руу Portal ашиглан render хийнэ — эс бөгөөс энэ modal нь
// PlanPreview-ийн "anim-fade-up" гэсэн CSS animation бүхий эцэг элемент
// дотор үлдэж, transform:translateY(0) (animation "both" fill-mode-оор
// permanent-аар үлддэг) нь position:fixed-ийн харьцах цэгийг бодит
// viewport-оос тэр эцэг элемент рүү шилжүүлдэг байсан — иймд хуудсыг
// доош scroll хийгээд нээхэд modal дэлгэцийн гадна (хуудасны эхэнд)
// харагддаг баг гарч байв.
export function AddonScheduleModal({ isOpen, onClose, items, schedules, onChangeSchedule, validDates, skipLunch, mealLabels, tr, language }) {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="anim-fade-in"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.65)', backdropFilter: 'blur(8px)',
        zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        className="anim-scale-in"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', width: '100%', maxWidth: 520,
          maxHeight: '85vh', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-dark)' }}>
            {tr.menuPlanAddonScheduleTitle}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-body)', flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '18px 22px', overflowY: 'auto' }}>
          {items.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{tr.menuPlanAddonEmpty}</p>
          ) : items.map(item => (
            <AddonItemRow
              key={item.id}
              item={item}
              schedule={schedules[item.id] || { mode: 'once', dates: validDates.slice(0, 1), meal_time: 'morning' }}
              validDates={validDates}
              skipLunch={skipLunch}
              mealLabels={mealLabels}
              onChange={patch => onChangeSchedule(item.id, patch)}
              tr={tr}
              language={language}
            />
          ))}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={onClose} className="btn-primary" style={{ width: '100%', padding: 14, borderRadius: 12, fontWeight: 800 }}>
            {tr.menuPlanAddonScheduleDone}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
