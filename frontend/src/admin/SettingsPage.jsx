import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Check, X, Plus, Trash2, AlertTriangle } from 'lucide-react';

function EditableRow({ item, editingId, draftName, onStartEdit, onDraftChange, onSave, onCancel, onDelete, saving }) {
  const isEditing = editingId === item.id;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', borderRadius: 10, background: 'var(--bg-muted)',
    }}>
      {isEditing ? (
        <>
          <input
            value={draftName}
            onChange={e => onDraftChange(e.target.value)}
            autoFocus
            style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.87rem' }}
          />
          <button onClick={() => onSave(item.id)} disabled={saving} title="Хадгалах"
            style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand-green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={15} />
          </button>
          <button onClick={onCancel} title="Цуцлах"
            style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
        </>
      ) : (
        <>
          <span style={{ flex: 1, fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-dark)' }}>{item.name}</span>
          <button onClick={() => onStartEdit(item)} title="Нэр солих"
            style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Pencil size={14} />
          </button>
          {onDelete && (
            <button onClick={() => onDelete(item)} title="Устгах"
              style={{ width: 32, height: 32, borderRadius: 8, background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={14} />
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function SettingsPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [dietTypes, setDietTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingRestId, setEditingRestId] = useState(null);
  const [restDraft, setRestDraft] = useState('');
  const [newRestName, setNewRestName] = useState('');

  const [editingDietId, setEditingDietId] = useState(null);
  const [dietDraft, setDietDraft] = useState('');
  const [newDietName, setNewDietName] = useState('');

  const [cycleStartDate, setCycleStartDate] = useState('');
  const [cycleEndDate, setCycleEndDate] = useState('');
  const [cycleDraft, setCycleDraft] = useState('');
  const [cycleSaving, setCycleSaving] = useState(false);
  const [cycleSaved, setCycleSaved] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [rRes, dRes, cRes] = await Promise.all([
        fetch('/api/menu/restaurants'),
        fetch('/api/menu/diet-types'),
        fetch('/api/admin/plan-cycle'),
      ]);
      const [r, d, c] = await Promise.all([rRes.json(), dRes.json(), cRes.json()]);
      if (Array.isArray(r)) setRestaurants(r);
      if (Array.isArray(d)) setDietTypes(d);
      if (c?.start_date) {
        setCycleStartDate(c.start_date);
        setCycleEndDate(c.end_date);
        setCycleDraft(c.start_date);
      }
      setError('');
    } catch {
      setError('Мэдээлэл татахад алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // 12 хоногийн идэвхтэй эргэлтийн эхлэх огноог шинэчилнэ (end_date =
  // start_date + 11 хоног, серверт тооцоологдоно). Зөвхөн ЦААШИДЫН шинэ
  // захиалгад нөлөөлнө — аль хэдийн үүссэн захиалгын plan_start_date/
  // plan_end_date царцсан хэвээр байна.
  const saveCycleStartDate = async (e) => {
    e.preventDefault();
    if (!cycleDraft) return;
    setCycleSaving(true);
    try {
      const res = await fetch('/api/admin/plan-cycle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: cycleDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Хадгалахад алдаа гарлаа.');
      setCycleStartDate(data.start_date);
      setCycleEndDate(data.end_date);
      setCycleSaved(true);
      setTimeout(() => setCycleSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setCycleSaving(false);
    }
  };

  // --- Ресторан ---
  const addRestaurant = async (e) => {
    e.preventDefault();
    if (!newRestName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRestName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Нэмэхэд алдаа гарлаа.');
      setRestaurants(prev => [...prev, data]);
      setNewRestName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveRestaurant = async (id) => {
    if (!restDraft.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/restaurants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: restDraft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Хадгалахад алдаа гарлаа.');
      setRestaurants(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
      setEditingRestId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const assignRestaurantDietType = async (id, dietTypeId) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/restaurants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diet_type_id: dietTypeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Хадгалахад алдаа гарлаа.');
      setRestaurants(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Тухайн рестораны өдрийн ЗАХИАЛГЫН лимит (menu item stock биш — нийт
  // "хэдэн захиалга" авахыг хязгаарлана). Хоосон = хязгааргүй.
  const saveRestaurantLimit = async (id, rawValue) => {
    const daily_order_limit = rawValue === '' ? null : Number(rawValue);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/restaurants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daily_order_limit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Хадгалахад алдаа гарлаа.');
      setRestaurants(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Ангилал (diet type) ---
  const addDietType = async (e) => {
    e.preventDefault();
    if (!newDietName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/diet-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDietName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Нэмэхэд алдаа гарлаа.');
      setDietTypes(prev => [...prev, data]);
      setNewDietName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveDietType = async (id) => {
    if (!dietDraft.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/diet-types/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: dietDraft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Хадгалахад алдаа гарлаа.');
      setDietTypes(prev => prev.map(d => d.id === id ? data : d));
      setEditingDietId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteDietType = async (item) => {
    if (!window.confirm(`"${item.name}" ангиллыг устгах уу?`)) return;
    try {
      const res = await fetch(`/api/admin/diet-types/${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Устгахад алдаа гарлаа.');
      setDietTypes(prev => prev.filter(d => d.id !== item.id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2 className="heading-md" style={{ marginBottom: 20 }}>Тохиргоо</h2>

      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px 14px', borderRadius: 10, fontSize: '0.85rem', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.9rem', marginBottom: 4 }}>
          12 хоногийн эргэлт
        </h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          Идэвхтэй эргэлтийн эхлэх огноо — дуусах огноо автоматаар +11 хоногоор тооцоологдоно.
          Зочин захиалга өгөх өдрөөсөө хамааран энэ цонхны дотор л (1 хоногийн өмнө захиалах
          дүрмээр) хоолоо авах боломжтой болно.
        </p>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-start',
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
          padding: '9px 12px', marginBottom: 14,
        }}>
          <AlertTriangle size={15} color="#92400e" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: '0.76rem', color: '#92400e', fontWeight: 600, lineHeight: 1.5 }}>
            Анхаар: энэ огноог өөрчлөх нь зөвхөн ЦААШИД шинээр захиалах зочдод нөлөөлнө — өмнө нь
            төлбөр төлж худалдаж авсан захиалгын хугацаа, үнэ өөрчлөгдөхгүй.
          </p>
        </div>
        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Ачааллаж байна...</p>
        ) : (
          <form onSubmit={saveCycleStartDate} style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                Эхлэх огноо
              </label>
              <input
                type="date"
                value={cycleDraft}
                onChange={e => setCycleDraft(e.target.value)}
                required
                style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.85rem' }}
              />
            </div>
            <button type="submit" disabled={cycleSaving || cycleDraft === cycleStartDate} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              {cycleSaving ? 'Хадгалж байна...' : 'Хадгалах'}
            </button>
            {cycleStartDate && cycleEndDate && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Одоогийн эргэлт: <strong style={{ color: 'var(--text-dark)' }}>{cycleStartDate} — {cycleEndDate}</strong> (12 хоног)
              </span>
            )}
            {cycleSaved && <span style={{ fontSize: '0.8rem', color: 'var(--brand-green)', fontWeight: 700 }}>✓ Хадгалагдлаа</span>}
          </form>
        )}
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.9rem', marginBottom: 4 }}>
          Ресторанууд
        </h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14 }}>
          Menu болон Захиалгууд хуудсанд ашиглагдах dining outlet-уудыг эндээс нэмэх/нэр солих боломжтой. Ресторан бүр яг нэг ангилалд харьяалагдана — ангилал оноосны дараа тухайн рестораны бүх хоол зөвхөн энэ ангилалд захиалагдана. "Өдрийн лимит" талбар нь тухайн ресторан өдөрт хэдэн ЗАХИАЛГА (order) авахыг хязгаарлана — лимит хүрмэгц зочид "Өнөөдрийн авах захиалга дүүрсэн, маргааш захиалга өгнө үү" гэсэн алдаа харагдана. Хоосон = хязгааргүй.
        </p>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Ачааллаж байна...</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {restaurants.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <EditableRow
                      item={r}
                      editingId={editingRestId}
                      draftName={restDraft}
                      onStartEdit={(item) => { setEditingRestId(item.id); setRestDraft(item.name); }}
                      onDraftChange={setRestDraft}
                      onSave={saveRestaurant}
                      onCancel={() => setEditingRestId(null)}
                      saving={saving}
                    />
                  </div>
                  <select
                    value={r.diet_type_id || ''}
                    onChange={e => assignRestaurantDietType(r.id, e.target.value || null)}
                    disabled={saving}
                    style={{ padding: '9px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.82rem', flexShrink: 0 }}
                  >
                    <option value="">Ангилал сонгоогүй</option>
                    {dietTypes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <input
                    key={`${r.id}-${r.daily_order_limit ?? 'null'}`}
                    type="number"
                    min="0"
                    defaultValue={r.daily_order_limit ?? ''}
                    placeholder="Өдрийн лимит"
                    title="Өдөрт хэдэн захиалга авахыг хязгаарлана. Хоосон = хязгааргүй."
                    disabled={saving}
                    onBlur={e => {
                      const raw = e.target.value.trim();
                      if (raw === String(r.daily_order_limit ?? '')) return;
                      saveRestaurantLimit(r.id, raw);
                    }}
                    style={{ width: 100, padding: '9px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.82rem', flexShrink: 0 }}
                  />
                </div>
              ))}
            </div>
            <form onSubmit={addRestaurant} style={{ display: 'flex', gap: 8 }}>
              <input
                value={newRestName}
                onChange={e => setNewRestName(e.target.value)}
                placeholder="Шинэ рестораны нэр"
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.87rem' }}
              />
              <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                <Plus size={15} /> Нэмэх
              </button>
            </form>
          </>
        )}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.9rem', marginBottom: 4 }}>
          Ангилал
        </h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14 }}>
          Хоолны ангилал (Halal, Vegan, гэх мэт) — бүх буудал дундаа нэг жагсаалт. Ашиглагдаж буй ангиллыг устгах боломжгүй.
        </p>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Ачааллаж байна...</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {dietTypes.map(d => (
                <EditableRow
                  key={d.id}
                  item={d}
                  editingId={editingDietId}
                  draftName={dietDraft}
                  onStartEdit={(item) => { setEditingDietId(item.id); setDietDraft(item.name); }}
                  onDraftChange={setDietDraft}
                  onSave={saveDietType}
                  onCancel={() => setEditingDietId(null)}
                  onDelete={deleteDietType}
                  saving={saving}
                />
              ))}
            </div>
            <form onSubmit={addDietType} style={{ display: 'flex', gap: 8 }}>
              <input
                value={newDietName}
                onChange={e => setNewDietName(e.target.value)}
                placeholder="Шинэ ангиллын нэр"
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.87rem' }}
              />
              <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                <Plus size={15} /> Нэмэх
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
