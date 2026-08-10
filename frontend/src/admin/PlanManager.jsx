import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X, Search, Check } from 'lucide-react';
import { ItemForm, emptyItemForm } from './MenuManager';
import { dietStyle } from '../components/MenuSection';

const MEAL_TIMES = [
  { key: 'morning', label: 'Өглөө' },
  { key: 'lunch', label: 'Өдөр' },
  { key: 'evening', label: 'Орой' },
];

const SLOT_LABELS = ['Үндсэн', 'Нөөц 1', 'Нөөц 2'];

// day_number (1-12) -> тухайн эргэлтийн бодит огноо ('sar/ödör' богино формат).
// cycleStartDate нь 'YYYY-MM-DD' — Date.UTC-ээр тооцоолж локал TZ-ийн урвуулалтаас зайлсхийнэ.
function dayNumberToLabel(dayNumber, cycleStartDate) {
  if (!cycleStartDate) return null;
  const [y, m, d] = cycleStartDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + (dayNumber - 1)));
  return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
}

function ExistingItemPicker({ menuItems, onPick }) {
  const [search, setSearch] = useState('');
  const filtered = menuItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Хоол хайх..."
          autoFocus
          style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.85rem' }}
        />
      </div>
      <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.length === 0 && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '8px 0' }}>Олдсонгүй.</p>}
        {filtered.map(item => (
          <button
            key={item.id}
            onClick={() => onPick(item.id)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              padding: '8px 10px', borderRadius: 8, background: 'var(--bg-muted)', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dark)' }}>{item.name}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
              {item.category || 'Бусад'} · ${Number(item.price_usd).toFixed(2)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AddItemModal({ activeRestaurant, dietTypes, menuItems, onPickExisting, onCreateNew, saving, onClose }) {
  const [mode, setMode] = useState('existing');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div className="card anim-scale-in" style={{ padding: 22, width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem' }}>Хоол нэмэх</h3>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setMode('existing')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem',
              background: mode === 'existing' ? 'var(--brand-green)' : 'var(--bg-muted)',
              color: mode === 'existing' ? '#fff' : 'var(--text-body)',
            }}
          >
            Жагсаалтаас сонгох
          </button>
          <button
            onClick={() => setMode('new')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem',
              background: mode === 'new' ? 'var(--brand-green)' : 'var(--bg-muted)',
              color: mode === 'new' ? '#fff' : 'var(--text-body)',
            }}
          >
            Шинэ хоол нэмэх
          </button>
        </div>

        {mode === 'existing' ? (
          <ExistingItemPicker menuItems={menuItems} onPick={onPickExisting} />
        ) : (
          <ItemForm
            initial={emptyItemForm([activeRestaurant], dietTypes)}
            restaurants={[activeRestaurant]}
            dietTypes={dietTypes}
            onCancel={onClose}
            onSave={onCreateNew}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}

export function PlanManager() {
  const [restaurants, setRestaurants] = useState([]);
  const [dietTypes, setDietTypes] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [planItems, setPlanItems] = useState([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [addingSlot, setAddingSlot] = useState(null); // meal_time key or null
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [cycleStartDate, setCycleStartDate] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/menu/restaurants').then(r => r.json()),
      fetch('/api/menu/diet-types').then(r => r.json()),
      fetch('/api/admin/plan-cycle').then(r => r.json()),
    ]).then(([r, d, cycle]) => {
      if (Array.isArray(r)) {
        setRestaurants(r);
        setSelectedRestaurantId(prev => prev ?? r[0]?.id ?? null);
      }
      if (Array.isArray(d)) setDietTypes(d);
      if (cycle?.start_date) setCycleStartDate(cycle.start_date);
    }).catch(() => setError('Мэдээлэл татахад алдаа гарлаа.'));
  }, []);

  const fetchPlanData = useCallback(async () => {
    if (!selectedRestaurantId) return;
    setLoading(true);
    try {
      const [mRes, pRes] = await Promise.all([
        fetch(`/api/menu?all=true&restaurant_id=${selectedRestaurantId}`),
        fetch(`/api/admin/plan?restaurant_id=${selectedRestaurantId}`),
      ]);
      const [m, p] = await Promise.all([mRes.json(), pRes.json()]);
      if (Array.isArray(m)) setMenuItems(m);
      if (Array.isArray(p)) setPlanItems(p);
      setError('');
    } catch {
      setError('Мэдээлэл татахад алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  }, [selectedRestaurantId]);

  useEffect(() => { fetchPlanData(); }, [fetchPlanData]);

  const activeRestaurant = restaurants.find(r => r.id === selectedRestaurantId);

  // meal_time -> { category -> items[] } — нэг цагт хэд ч ангиллын хоол
  // (Main Course, Soup, Snack гэх мэт) зэрэгцэн орж болно, ангилал тус бүр
  // дотроо дээд тал нь 3 (1 үндсэн + 2 нөөц).
  const dayItemsByMealCategory = useMemo(() => {
    const map = { morning: {}, lunch: {}, evening: {} };
    planItems.filter(p => p.day_number === selectedDay).forEach(p => {
      const cat = p.category || 'Бусад';
      const bucket = map[p.meal_time];
      if (!bucket) return;
      (bucket[cat] = bucket[cat] || []).push(p);
    });
    return map;
  }, [planItems, selectedDay]);

  const assign = async (menuItemId) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/plan-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day_number: selectedDay, meal_time: addingSlot, menu_item_id: menuItemId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Нэмэхэд алдаа гарлаа.');
      setAddingSlot(null);
      fetchPlanData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const createAndAssign = async (payload) => {
    setSaving(true);
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const item = await res.json();
      if (!res.ok) throw new Error(item.error || 'Хоол нэмэхэд алдаа гарлаа.');
      await assign(item.id);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  // Хоол нэмэх/хасах бүр аль хэдийн шууд серверт хадгалагддаг (assign/removeItem) —
  // энэ товч зөвхөн admin-д "хадгалагдсан" гэдгийг тодорхой харуулах баталгаажуулалт.
  const handleSaveConfirm = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const removeItem = async (planItemId) => {
    setPlanItems(prev => prev.filter(p => p.id !== planItemId));
    try {
      const res = await fetch(`/api/admin/plan-items/${planItemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setError('Хасахад алдаа гарлаа.');
      fetchPlanData();
    }
  };

  if (loading && restaurants.length === 0) return <p style={{ color: 'var(--text-muted)' }}>Ачааллаж байна...</p>;

  return (
    <div>
      <h2 className="heading-md" style={{ marginBottom: 6 }}>12 хоногийн цэс</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 6 }}>
        Ресторан тус бүр өөрийн 12 хоногийн цэстэй — доороос ресторанаа сонгоод өдөр тус бүрийн өглөө/өдөр/оройн хоолыг тохируулна.
      </p>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 20 }}>
        Нэг цагт (жишээ нь өглөө) хэд ч ангиллын (Main Course, Soup, Snack гэх мэт) хоол зэрэгцэн
        орж болно — ямар хоол сонгосноос нь ангилал нь автоматаар тодорхойлогдоно. Ангилал тус
        бүр дотроо дээд тал нь 3 хоол: хамгийн ЭХЭЛЖ нэмсэн нь зочинд "Үндсэн" (default) сонголт
        болж, дараагийн 2 нь "Нөөц" болж зочин тухайн ангиллынхаа дотор сольж болно. Admin ямар
        ч ангиллыг нэмэлгүй орхивол тэр ангилал тухайн өдөр/цагт огт харагдахгүй.
      </p>

      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px 14px', borderRadius: 10, fontSize: '0.85rem', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Restaurant tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {restaurants.map(r => {
          const active = r.id === selectedRestaurantId;
          const cfg = r.diet_type_name ? dietStyle(r.diet_type_name) : null;
          return (
            <button
              key={r.id}
              onClick={() => setSelectedRestaurantId(r.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 'var(--r-full)',
                fontWeight: 700, fontSize: '0.85rem',
                border: `2px solid ${active ? (cfg?.color || 'var(--brand-green)') : 'var(--border)'}`,
                background: active ? (cfg?.bg || 'var(--bg-muted)') : 'var(--bg-card)',
                color: active ? (cfg?.color || 'var(--brand-green)') : 'var(--text-body)',
              }}
            >
              {cfg && <span>{cfg.emoji}</span>}
              {r.name}
              {!r.diet_type_name && <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>(ангилал сонгоогүй)</span>}
            </button>
          );
        })}
      </div>

      {/* Day selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(day => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            style={{
              width: 52, height: 48, borderRadius: 10, fontWeight: 800, fontSize: '0.88rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
              background: selectedDay === day ? 'var(--brand-green)' : 'var(--bg-muted)',
              color: selectedDay === day ? '#fff' : 'var(--text-body)',
            }}
          >
            <span>{day}</span>
            {cycleStartDate && (
              <span style={{ fontSize: '0.62rem', fontWeight: 600, opacity: 0.8 }}>
                {dayNumberToLabel(day, cycleStartDate)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Meal sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {MEAL_TIMES.map(({ key, label }) => {
          const categoryGroups = Object.entries(dayItemsByMealCategory[key]);
          return (
            <div key={key} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-dark)' }}>{label}</h3>
                <button
                  onClick={() => setAddingSlot(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                    background: 'var(--bg-muted)', fontWeight: 700, fontSize: '0.78rem',
                  }}
                >
                  <Plus size={14} /> Хоол нэмэх
                </button>
              </div>

              {categoryGroups.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Хоол сонгогдоогүй.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {categoryGroups.map(([category, items]) => (
                    <div key={category}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>
                        {category} {items.length >= 3 && <span style={{ color: 'var(--brand-green)' }}>(3/3)</span>}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {items.map((p, idx) => (
                          <div key={p.id} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 8px 6px 10px', borderRadius: 10, background: 'var(--bg-muted)',
                          }}>
                            {p.image_url && <img src={p.image_url} alt="" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover' }} />}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                  fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: 999,
                                  background: idx === 0 ? 'var(--brand-green)' : 'var(--bg-card)',
                                  color: idx === 0 ? '#fff' : 'var(--text-muted)',
                                  border: idx === 0 ? 'none' : '1px solid var(--border)',
                                }}>
                                  {SLOT_LABELS[idx] || `Нөөц ${idx}`}
                                </span>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)' }}>{p.name}</span>
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.restaurant_name} · ${Number(p.price_usd).toFixed(2)}</div>
                            </div>
                            <button
                              onClick={() => removeItem(p.id)}
                              title="Хасах"
                              style={{ width: 22, height: 22, borderRadius: 6, background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSaveConfirm}
        className="btn-primary"
        style={{ marginTop: 24, padding: '12px 28px', fontSize: '0.9rem' }}
      >
        <Check size={16} /> Хадгалах
      </button>

      {savedToast && (
        <div className="toast anim-fade-up">
          ✓ {selectedDay}-р өдрийн цэс хадгалагдлаа
        </div>
      )}

      {addingSlot && activeRestaurant && (
        <AddItemModal
          activeRestaurant={activeRestaurant}
          dietTypes={dietTypes}
          menuItems={menuItems}
          saving={saving}
          onPickExisting={assign}
          onCreateNew={createAndAssign}
          onClose={() => setAddingSlot(null)}
        />
      )}
    </div>
  );
}
