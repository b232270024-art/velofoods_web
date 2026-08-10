import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';

export function emptyItemForm(restaurants, dietTypes) {
  return {
    name: '', category: '', diet_type_id: dietTypes?.[0]?.id || '',
    price_usd: '', description: '', prep_time_min: '', is_featured: false,
    is_addon_recommended: false,
    restaurant_id: restaurants[0]?.id || '', image_url: '',
  };
}

export function ItemForm({ initial, restaurants, dietTypes, onCancel, onSave, saving }) {
  const [form, setForm] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  // Сонгосон ресторан аль хэдийн нэг ангилалд түгжигдсэн бол (Settings-с
  // оноосон diet_type_id) шинэ/засварлаж буй хоолны ангиллыг үүнд автоматаар
  // тааруулж, dropdown-г идэвхгүй болгоно. useEffect ашигласны шалтгаан:
  // PlanManager-ийн "Шинэ хоол нэмэх" (ganц ресторантайгаар нээгддэг) үед ч
  // энэ lock анх ачаалахад л (onChange хүлээхгүйгээр) хэрэгжих ёстой.
  useEffect(() => {
    const restaurant = restaurants.find(r => r.id === form.restaurant_id);
    if (restaurant?.diet_type_id && form.diet_type_id !== restaurant.diet_type_id) {
      setForm(f => ({ ...f, diet_type_id: restaurant.diet_type_id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.restaurant_id, restaurants]);

  const lockedRestaurant = restaurants.find(r => r.id === form.restaurant_id);
  const dietLocked = Boolean(lockedRestaurant?.diet_type_id);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price_usd || !form.restaurant_id || !form.diet_type_id) return;
    onSave({
      name: form.name.trim(),
      category: form.category.trim() || null,
      diet_type_id: form.diet_type_id,
      price_usd: Number(form.price_usd),
      description: form.description.trim() || null,
      prep_time_min: form.prep_time_min ? Number(form.prep_time_min) : null,
      is_featured: !!form.is_featured,
      is_addon_recommended: !!form.is_addon_recommended,
      restaurant_id: form.restaurant_id,
      image_url: form.image_url.trim() || null,
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Зураг оруулахад алдаа гарлаа.');
      setForm(f => ({ ...f, image_url: data.url }));
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 16, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
      <input placeholder="Нэр *" value={form.name} onChange={set('name')} required
        style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.88rem' }} />
      <input placeholder="Ангилал (жишээ: Гол хоол)" value={form.category} onChange={set('category')}
        style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.88rem' }} />
      <input placeholder="Үнэ (USD) *" type="number" step="0.01" min="0" value={form.price_usd} onChange={set('price_usd')} required
        style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.88rem' }} />

      <div>
        <select value={form.diet_type_id} onChange={set('diet_type_id')} required disabled={dietLocked}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.88rem', opacity: dietLocked ? 0.7 : 1 }}>
          <option value="" disabled>Ангилал сонгох *</option>
          {dietTypes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {dietLocked && (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
            🔒 {lockedRestaurant.name} зөвхөн {lockedRestaurant.diet_type_name} ангилалд харьяалагдана
          </div>
        )}
      </div>

      <select value={form.restaurant_id} onChange={set('restaurant_id')} required
        style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.88rem' }}>
        <option value="" disabled>Ресторан сонгох *</option>
        {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>

      <input placeholder="Бэлтгэх хугацаа (мин)" type="number" min="0" value={form.prep_time_min} onChange={set('prep_time_min')}
        style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.88rem' }} />

      <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-body)' }}>
        <input type="checkbox" checked={form.is_featured} onChange={set('is_featured')} /> Онцлох
      </label>

      <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-body)' }}>
        <input type="checkbox" checked={form.is_addon_recommended} onChange={set('is_addon_recommended')} />
        Санал болгох (12 хоногийн планы сүүлийн хуудсан дээр нэмэлт зууш/амттан болгон санал болгоно)
      </label>

      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>Зураг:</span>
        <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} style={{ fontSize: '0.8rem' }} />
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>эсвэл</span>
        <input
          placeholder="Зургийн URL paste хийх"
          value={form.image_url}
          onChange={set('image_url')}
          style={{ flex: 1, minWidth: 180, padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.82rem' }}
        />
        {form.image_url && <img src={form.image_url} alt="preview" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} />}
        {uploading && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Оруулж байна...</span>}
      </div>

      <textarea placeholder="Тайлбар" value={form.description} onChange={set('description')} rows={2}
        style={{ gridColumn: '1 / -1', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.88rem', fontFamily: 'inherit', resize: 'vertical' }} />

      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
        <button type="submit" disabled={saving || uploading} className="btn-primary" style={{ padding: '9px 20px', fontSize: '0.85rem' }}>
          {saving ? 'Хадгалж байна...' : 'Хадгалах'}
        </button>
        <button type="button" onClick={onCancel} style={{
          padding: '9px 20px', borderRadius: 8, background: 'var(--bg-muted)',
          fontWeight: 700, fontSize: '0.85rem',
        }}>
          Цуцлах
        </button>
      </div>
    </form>
  );
}

function ItemRow({ item, restaurants, onEdit, onDelete, onToggleAvailable }) {
  const limitLabel = item.stock_limit !== null
    ? `${item.sold_today ?? 0}/${item.stock_limit} өнөөдөр`
    : null;
  const restaurant = restaurants.find(r => r.id === item.restaurant_id);
  const mismatched = Boolean(restaurant?.diet_type_id && restaurant.diet_type_id !== item.diet_type_id);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderBottom: '1px solid var(--border)',
      opacity: item.available ? 1 : 0.55,
    }}>
      {item.image_url
        ? <img src={item.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
        : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-muted)', flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{item.name}</span>
          {item.is_featured && <span style={{ fontSize: '0.7rem' }} title="Онцлох">⭐</span>}
          {item.is_addon_recommended && <span style={{ fontSize: '0.7rem' }} title="Санал болгох нэмэлт зүйл">🍰</span>}
          {mismatched && (
            <span
              title={`${restaurant.name} нь ${restaurant.diet_type_name} ангилалд харьяалагддаг ч энэ хоол ${item.diet_type_name}-д бүртгэгдсэн байна`}
              style={{ fontSize: '0.68rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: 999 }}
            >
              ⚠ Зөрүүтэй ангилал
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {item.category || '—'} · {item.diet_type_name} · {item.restaurant_name}
          {limitLabel && ` · ${limitLabel}`}
        </div>
      </div>
      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--brand-green)', minWidth: 64, textAlign: 'right' }}>
        ${Number(item.price_usd).toFixed(2)}
      </span>
      <button onClick={() => onToggleAvailable(item)} title={item.available ? 'Нуух' : 'Харуулах'}
        style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {item.available ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>
      <button onClick={() => onEdit(item)} title="Засах"
        style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Pencil size={14} />
      </button>
      <button onClick={() => onDelete(item)} title="Устгах"
        style={{ width: 32, height: 32, borderRadius: 8, background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function MenuManager() {
  const [items, setItems] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [dietTypes, setDietTypes] = useState([]);
  const [restaurantFilter, setRestaurantFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [itemsRes, restaurantsRes, dietTypesRes] = await Promise.all([
        fetch('/api/menu?all=true'),
        fetch('/api/menu/restaurants'),
        fetch('/api/menu/diet-types'),
      ]);
      const itemsData = await itemsRes.json();
      const restaurantsData = await restaurantsRes.json();
      const dietTypesData = await dietTypesRes.json();
      if (Array.isArray(itemsData)) setItems(itemsData);
      if (Array.isArray(restaurantsData)) setRestaurants(restaurantsData);
      if (Array.isArray(dietTypesData)) setDietTypes(dietTypesData);
      setError('');
    } catch {
      setError('Цэсний мэдээлэл татахад алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async (payload) => {
    setSaving(true);
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Хоол нэмэхэд алдаа гарлаа.');
      setAdding(false);
      fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (payload) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/menu/item/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Шинэчлэхэд алдаа гарлаа.');
      setEditingItem(null);
      fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailable = async (item) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, available: !i.available } : i));
    try {
      const res = await fetch(`/api/menu/item/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: !item.available }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError('Шинэчлэхэд алдаа гарлаа.');
      fetchAll();
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`"${item.name}"-г устгах уу?`)) return;
    setItems(prev => prev.filter(i => i.id !== item.id));
    try {
      const res = await fetch(`/api/menu/item/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setError('Устгахад алдаа гарлаа.');
      fetchAll();
    }
  };

  const visibleItems = restaurantFilter === 'All' ? items : items.filter(i => i.restaurant_id === restaurantFilter);
  const grouped = visibleItems.reduce((acc, item) => {
    const cat = item.category || 'Бусад';
    (acc[cat] = acc[cat] || []).push(item);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 className="heading-md">Цэсний удирдлага</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={restaurantFilter}
            onChange={e => setRestaurantFilter(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 700, background: 'var(--bg-muted)' }}
          >
            <option value="All">Бүх ресторан</option>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {!adding && !editingItem && (
            <button onClick={() => setAdding(true)} className="btn-primary" style={{ padding: '9px 18px', fontSize: '0.85rem' }}>
              <Plus size={16} /> Хоол нэмэх
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px 14px', borderRadius: 10, fontSize: '0.85rem', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {adding && (
        <ItemForm initial={emptyItemForm(restaurants, dietTypes)} restaurants={restaurants} dietTypes={dietTypes} onCancel={() => setAdding(false)} onSave={handleCreate} saving={saving} />
      )}

      {editingItem && (
        <ItemForm
          restaurants={restaurants}
          dietTypes={dietTypes}
          initial={{
            name: editingItem.name,
            category: editingItem.category || '',
            diet_type_id: editingItem.diet_type_id,
            price_usd: editingItem.price_usd,
            description: editingItem.description || '',
            prep_time_min: editingItem.prep_time_min || '',
            is_featured: editingItem.is_featured || false,
            is_addon_recommended: editingItem.is_addon_recommended || false,
            restaurant_id: editingItem.restaurant_id,
            image_url: editingItem.image_url || '',
          }}
          onCancel={() => setEditingItem(null)}
          onSave={handleUpdate}
          saving={saving}
        />
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Ачааллаж байна...</p>
      ) : visibleItems.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Одоогоор хоол алга.</p>
      ) : (
        Object.entries(grouped).map(([cat, catItems]) => (
          <div key={cat} className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'var(--bg-muted)', fontWeight: 800, fontSize: '0.85rem' }}>
              {cat} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>({catItems.length})</span>
            </div>
            {catItems.map(item => (
              <ItemRow key={item.id} item={item} restaurants={restaurants} onEdit={setEditingItem} onDelete={handleDelete} onToggleAvailable={handleToggleAvailable} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
