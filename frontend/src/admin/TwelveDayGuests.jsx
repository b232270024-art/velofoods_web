import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, User, AlertTriangle, ChevronDown, ChevronUp, Clock, CalendarRange, CreditCard, Download } from 'lucide-react';
import { dietStyle } from '../components/MenuSection';
import { isWithinDateRange } from '../lib/dateRange';
import { downloadExcel } from '../lib/excelExport';

const MEAL_LABEL = { morning: 'Өглөө', lunch: 'Өдөр', evening: 'Орой' };

const ORDER_STATUS_LABEL = { pending: 'Хүлээгдэж буй', paid: 'Төлбөр төлөгдсөн', cancelled: 'Цуцлагдсан', refunded: 'Буцаагдсан' };
const ORDER_STATUS_COLOR = {
  pending: { bg: '#fef3c7', text: '#92400e' },
  paid: { bg: '#dcfce7', text: '#166534' },
  cancelled: { bg: '#f3f4f6', text: '#6b7280' },
  refunded: { bg: '#fee2e2', text: '#991b1b' },
};

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('mn-MN', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// 'YYYY-MM-DD' -> 'сарын/өдөр' богино формат, TZ-гүй (энэ бол хуанлийн огноо, цаг биш).
// admin /orders нь date багануудыг бүтэн ISO timestamp хэлбэрээр буцаадаг
// (жишээ нь '2026-08-17T05:00:00.000Z') тул эхний 10 тэмдэгтийг (огнооны
// хэсгийг) л авна — өөрөөр '17T05:00:00.000Z' гэж задарч NaN болдог байсан.
function fmtPlanDate(dateStr) {
  if (!dateStr) return '—';
  const [, m, d] = dateStr.slice(0, 10).split('-');
  return `${Number(m)}/${Number(d)}`;
}

function StatusBadge({ status }) {
  const c = ORDER_STATUS_COLOR[status] || ORDER_STATUS_COLOR.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999,
      background: c.bg, color: c.text, fontSize: '0.73rem', fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {ORDER_STATUS_LABEL[status] || status}
    </span>
  );
}

// Нэг 12 хоногийн захиалгын дэлгэрэнгүй мөр (expandable)
function OrderRow({ order, restaurantByDiet }) {
  const [expanded, setExpanded] = useState(false);
  const allergyTags = order.allergy_tags || [];
  const hasAllergyInfo = allergyTags.length > 0 || Boolean(order.allergy_other);
  const items = order.items || [];
  const coreItems = items.filter(i => !i.is_addon).sort((a, b) => {
    if (a.plan_date !== b.plan_date) return (a.plan_date || '').localeCompare(b.plan_date || '');
    return (a.plan_meal_time || '').localeCompare(b.plan_meal_time || '');
  });
  const addonItems = items.filter(i => i.is_addon);

  const conflicts = items
    .map(item => ({ item, hit: (item.allergens || []).filter(a => allergyTags.includes(a)) }))
    .filter(c => c.hit.length > 0);

  const dietCfg = order.diet_type_id && restaurantByDiet[order.diet_type_id]?.diet_type_name
    ? dietStyle(restaurantByDiet[order.diet_type_id].diet_type_name)
    : null;
  const restaurant = order.diet_type_id ? restaurantByDiet[order.diet_type_id] : null;

  const deliveryInfo = order.room_number
    ? `${order.hotel_name ? order.hotel_name + ' · ' : ''}Өрөө ${order.room_number}`
    : order.delivery_address || '—';

  return (
    <>
      <tr
        onClick={() => setExpanded(p => !p)}
        style={{ cursor: 'pointer', background: expanded ? 'var(--bg-muted)' : undefined, transition: 'background 0.15s' }}
      >
        <td style={{ padding: '11px 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }} title={order.id}>
          {order.id.slice(0, 8)}…
        </td>
        <td style={{ padding: '11px 12px', fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Clock size={12} /> {fmtDate(order.created_at)}
          </div>
        </td>

        <td style={{ padding: '11px 12px' }}>
          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <User size={13} color="var(--brand-green-light)" />
            {order.guest_name || '—'}
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}>{deliveryInfo}</div>
        </td>

        <td style={{ padding: '11px 12px', fontSize: '0.82rem', color: 'var(--text-body)' }}>
          {restaurant ? <span style={{ fontWeight: 700 }}>{restaurant.name}</span> : '—'}
          {dietCfg && (
            <div style={{ marginTop: 4 }}>
              <span style={{
                display: 'inline-flex', padding: '2px 9px', borderRadius: 999,
                background: dietCfg.bg, color: dietCfg.color, fontSize: '0.7rem', fontWeight: 700,
              }}>
                {dietCfg.label}
              </span>
            </div>
          )}
        </td>

        <td style={{ padding: '11px 12px', fontSize: '0.8rem', color: 'var(--text-body)', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <CalendarRange size={12} color="var(--text-muted)" />
            {fmtPlanDate(order.plan_start_date)}–{fmtPlanDate(order.plan_end_date)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {order.plan_day_count ?? '—'} хоног{addonItems.length > 0 ? ' + нэмэлт' : ''}
          </div>
        </td>

        <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 800, fontSize: '0.88rem', color: 'var(--brand-green)', whiteSpace: 'nowrap' }}>
          ${Number(order.total_usd).toFixed(2)}
        </td>

        <td style={{ padding: '11px 12px' }}>
          <StatusBadge status={order.status} />
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CreditCard size={11} />
            {order.paid_at ? fmtDate(order.paid_at) : 'Төлөөгүй'}
          </div>
        </td>

        <td style={{ padding: '11px 12px', fontSize: '0.78rem' }}>
          {conflicts.length > 0 ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
              background: '#fef2f2', color: '#991b1b', fontSize: '0.73rem', fontWeight: 700,
            }}>
              <AlertTriangle size={12} /> {conflicts.length}
            </span>
          ) : hasAllergyInfo ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
              background: '#fffbeb', color: '#92400e', fontSize: '0.73rem', fontWeight: 700,
            }}>
              <AlertTriangle size={12} /> Мэдэгдсэн
            </span>
          ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>}
        </td>

        <td style={{ padding: '11px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={9} style={{ padding: '0 12px 16px', background: 'var(--bg-muted)', borderBottom: '1.5px solid var(--border)' }}>
            {conflicts.length > 0 && (
              <div style={{
                background: '#fef2f2', border: '1.5px solid #fecaca', color: '#991b1b',
                borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: '0.78rem', fontWeight: 700,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <AlertTriangle size={14} /> ХАРШИЛТАЙ ЗӨРЧИЛДЛОО — АНХААРАХ!
                </div>
                {conflicts.map(({ item, hit }, idx) => (
                  <div key={idx} style={{ fontWeight: 600, marginBottom: 2 }}>
                    {fmtPlanDate(item.plan_date)} · "{item.name}" агуулна: <strong>{hit.join(', ')}</strong>
                  </div>
                ))}
              </div>
            )}

            {hasAllergyInfo && conflicts.length === 0 && (
              <div style={{
                background: '#fffbeb', border: '1.5px solid #fde68a', color: '#92400e',
                borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: '0.75rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <AlertTriangle size={14} />
                <span>Зочны мэдэгдсэн харшил: {[...allergyTags, order.allergy_other].filter(Boolean).join(', ')}</span>
              </div>
            )}

            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)', marginTop: 10, marginBottom: 6 }}>
              Зочны сонгосон 12 хоногийн цэс ({coreItems.length} хоол):
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card)' }}>
                  <th style={{ padding: '5px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Огноо</th>
                  <th style={{ padding: '5px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Цаг</th>
                  <th style={{ padding: '5px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Хоол</th>
                  <th style={{ padding: '5px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Харшил</th>
                </tr>
              </thead>
              <tbody>
                {coreItems.map((item, idx) => {
                  const hit = (item.allergens || []).filter(a => allergyTags.includes(a));
                  return (
                    <tr key={idx} style={{ borderTop: '1px solid var(--border)', background: hit.length > 0 ? '#fef2f2' : undefined }}>
                      <td style={{ padding: '5px 10px', fontWeight: 700, color: 'var(--brand-green)' }}>{fmtPlanDate(item.plan_date)}</td>
                      <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>{MEAL_LABEL[item.plan_meal_time] || item.plan_meal_time}</td>
                      <td style={{ padding: '5px 10px', color: 'var(--text-body)' }}>{item.name}</td>
                      <td style={{ padding: '5px 10px', color: hit.length > 0 ? '#991b1b' : 'var(--text-muted)', fontWeight: hit.length > 0 ? 700 : 400 }}>
                        {hit.length > 0 ? hit.join(', ') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {addonItems.length > 0 && (
              <div style={{
                marginTop: 12, padding: '8px 12px', borderRadius: 8,
                background: '#fff7ed', border: '1px solid #fed7aa', fontSize: '0.78rem', color: '#9a3412', fontWeight: 700,
              }}>
                + Нэмэлт санал: {addonItems.map(a => `${a.name} ($${Number(a.unit_price_usd ?? 0).toFixed(2)})`).join(', ')}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function TwelveDayGuests() {
  const [orders, setOrders] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterRestaurant, setFilterRestaurant] = useState('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [sortDir, setSortDir] = useState('desc');

  const fetchAll = useCallback(async () => {
    try {
      const [oRes, rRes] = await Promise.all([
        fetch('/api/admin/orders', { credentials: 'include' }),
        fetch('/api/menu/restaurants', { credentials: 'include' }),
      ]);
      const [o, r] = await Promise.all([oRes.json(), rRes.json()]);
      if (Array.isArray(o)) setOrders(o.filter(x => x.order_type === 'twelve_day'));
      if (Array.isArray(r)) setRestaurants(r.filter(x => x.diet_type_id));
      setError('');
    } catch {
      setError('Мэдээлэл татахад алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const restaurantByDiet = Object.fromEntries(restaurants.map(r => [r.diet_type_id, r]));

  const filtered = orders.filter(o => {
    if (filterRestaurant !== 'all') {
      const rest = restaurants.find(r => r.id === filterRestaurant);
      if (!rest || o.diet_type_id !== rest.diet_type_id) return false;
    }
    if ((filterFrom || filterTo) && !isWithinDateRange(o.created_at, filterFrom, filterTo)) return false;
    return true;
  }).sort((a, b) => {
    const aT = new Date(a.created_at).getTime();
    const bT = new Date(b.created_at).getTime();
    return sortDir === 'desc' ? bT - aT : aT - bT;
  });

  const hasConflict = (o) => {
    const allergyTags = o.allergy_tags || [];
    if (allergyTags.length === 0) return false;
    return (o.items || []).some(item => (item.allergens || []).some(a => allergyTags.includes(a)));
  };

  const statsByRestaurant = restaurants.map(r => {
    const restOrders = orders.filter(o => o.diet_type_id === r.diet_type_id);
    return {
      ...r,
      count: restOrders.length,
      revenue: restOrders.reduce((s, o) => s + Number(o.total_usd || 0), 0),
      withConflicts: restOrders.filter(hasConflict).length,
    };
  });

  const totalConflicts = filtered.filter(hasConflict).length;
  const totalRevenue = filtered.reduce((s, o) => s + Number(o.total_usd || 0), 0);

  // Одоо шүүгдэж буй 12 хоногийн захиалгуудыг Excel файл болгож татна — нэг
  // sheet захиалга тус бүрээр (summary), нөгөө нь өдөр тус бүрийн хоолоор (дэлгэрэнгүй).
  const handleExportExcel = () => {
    const summaryRows = filtered.map(o => {
      const restaurant = o.diet_type_id ? restaurantByDiet[o.diet_type_id] : null;
      return {
        'Захиалгын ID': o.id,
        'Захиалсан огноо': fmtDate(o.created_at),
        'Зочин': o.guest_name || '',
        'Хүргэлт': o.room_number ? `${o.hotel_name || ''} Өрөө ${o.room_number}` : (o.delivery_address || ''),
        'Ресторан': restaurant?.name || '',
        'Ангилал': restaurant ? restaurantByDiet[o.diet_type_id]?.diet_type_name || '' : '',
        'Эхлэх огноо': fmtPlanDate(o.plan_start_date),
        'Дуусах огноо': fmtPlanDate(o.plan_end_date),
        'Хоногийн тоо': o.plan_day_count ?? '',
        'Нийт үнэ ($)': Number(o.total_usd),
        'Захиалгын статус': ORDER_STATUS_LABEL[o.status] || o.status,
        'Төлбөр төлөгдсөн огноо': o.paid_at ? fmtDate(o.paid_at) : '',
        'Харшлын зөрчил': hasConflict(o) ? 'Тийм' : 'Үгүй',
      };
    });

    const detailRows = filtered.flatMap(o => (o.items || []).map(item => ({
      'Захиалгын ID': o.id,
      'Зочин': o.guest_name || '',
      'Огноо': fmtPlanDate(item.plan_date),
      'Цаг': MEAL_LABEL[item.plan_meal_time] || item.plan_meal_time || '',
      'Хоол': item.name,
      'Нэгжийн үнэ ($)': Number(item.unit_price_usd ?? 0),
      'Нэмэлт эсэх': item.is_addon ? 'Тийм' : 'Үгүй',
      'Захиалгын статус': ORDER_STATUS_LABEL[o.status] || o.status,
    })));

    const stamp = new Date().toISOString().slice(0, 10);
    downloadExcel(`twelve_day_orders_${stamp}.xlsx`, [
      { name: 'Захиалгууд', rows: summaryRows },
      { name: 'Дэлгэрэнгүй', rows: detailRows },
    ]);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 12 }}>
        <h2 className="heading-md">12 хоногийн захиалгууд</h2>
        <button
          onClick={fetchAll}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
            background: 'var(--bg-muted)', border: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 700,
          }}
        >
          <RefreshCw size={14} /> Шинэчлэх
        </button>
      </div>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
        Зочдын бодит худалдаж авсан 12 хоногийн захиалгууд — хэзээ захиалсан, хэдэн өдрийнх,
        хэзээ төлсөн, харшлын зөрчил зэрэг тодорхой харагдана.
      </p>

      {!loading && restaurants.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
          <div
            className="card"
            onClick={() => setFilterRestaurant('all')}
            style={{ padding: '14px 16px', cursor: 'pointer', border: filterRestaurant === 'all' ? '2px solid var(--brand-green)' : '2px solid transparent', transition: 'all 0.2s' }}
          >
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-dark)' }}>{orders.length}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Нийт захиалга</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--brand-green)', fontWeight: 700, marginTop: 4 }}>${totalRevenue.toFixed(2)}</div>
            {totalConflicts > 0 && (
              <div style={{ fontSize: '0.72rem', color: '#991b1b', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={11} /> {totalConflicts} харшлын зөрчил
              </div>
            )}
          </div>

          {statsByRestaurant.map(r => {
            const cfg = dietStyle(r.diet_type_name);
            const active = filterRestaurant === r.id;
            return (
              <div
                key={r.id}
                className="card"
                onClick={() => setFilterRestaurant(active ? 'all' : r.id)}
                style={{
                  padding: '14px 16px', cursor: 'pointer',
                  border: `2px solid ${active ? cfg.color : 'transparent'}`,
                  background: active ? cfg.bg : 'var(--bg-card)', transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: active ? cfg.color : 'var(--text-dark)' }}>{r.name}</div>
                    <div style={{ fontSize: '0.68rem', color: cfg.color, fontWeight: 600 }}>{cfg.label}</div>
                  </div>
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: active ? cfg.color : 'var(--text-dark)', lineHeight: 1 }}>{r.count}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>захиалга · ${r.revenue.toFixed(2)}</div>
                {r.withConflicts > 0 && (
                  <div style={{
                    marginTop: 8, padding: '4px 8px', borderRadius: 6, background: '#fef2f2', color: '#991b1b',
                    fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <AlertTriangle size={11} /> {r.withConflicts} зөрчил
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14, padding: '10px 14px',
          background: 'var(--bg-muted)', borderRadius: 10, border: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Шүүлтүүр:</span>
          <select
            value={filterRestaurant}
            onChange={e => setFilterRestaurant(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 700, background: 'var(--bg-card)', cursor: 'pointer' }}
          >
            <option value="all">Бүх ресторан</option>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            style={{
              padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.78rem', fontWeight: 700,
              background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            Огноо {sortDir === 'desc' ? '↓ Шинэ эхэнд' : '↑ Хуучин эхэнд'}
          </button>

          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            max={filterTo || undefined}
            style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.78rem', fontWeight: 600, background: 'var(--bg-card)' }}
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>—</span>
          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            min={filterFrom || undefined}
            style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.78rem', fontWeight: 600, background: 'var(--bg-card)' }}
          />
          {(filterFrom || filterTo) && (
            <button
              onClick={() => { setFilterFrom(''); setFilterTo(''); }}
              style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'underline', background: 'transparent' }}
            >
              Цэвэрлэх
            </button>
          )}

          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{filtered.length} захиалга</span>

          <button
            onClick={handleExportExcel}
            disabled={filtered.length === 0}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              background: 'var(--brand-green)', color: '#fff',
              fontSize: '0.8rem', fontWeight: 700, cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
              opacity: filtered.length === 0 ? 0.5 : 1,
            }}
          >
            <Download size={14} /> Excel татах
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px 14px', borderRadius: 10, fontSize: '0.85rem', marginBottom: 16 }}>{error}</div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Ачааллаж байна...</p>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', border: '1.5px dashed var(--border)', borderRadius: 12, fontSize: '0.9rem' }}>
          {orders.length === 0 ? 'Одоогоор 12 хоногийн захиалга алга.' : 'Сонгосон рестораны захиалга байхгүй.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)', borderBottom: '2px solid var(--border)' }}>
                {['ID', 'Захиалсан огноо', 'Зочин / Хүргэлт', 'Ресторан / Ангилал', 'Хугацаа', 'Нийт үнэ', 'Төлбөр', 'Харшил', ''].map((label, i) => (
                  <th key={i} style={{
                    padding: '10px 12px', textAlign: 'left', fontFamily: 'Outfit, sans-serif', fontWeight: 800,
                    fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap',
                  }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <OrderRow key={order.id} order={order} restaurantByDiet={restaurantByDiet} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
