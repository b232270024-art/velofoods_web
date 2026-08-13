import React, { useCallback, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { RefreshCw, Clock, User, AlertTriangle, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { isWithinDateRange } from '../lib/dateRange';
import { downloadExcel } from '../lib/excelExport';
import { formatOrderNumber } from '../lib/orderNumber';
import { adminFetchJson } from '../lib/adminFetch';

const STATUS_LABEL = {
  pending:   'Хүлээгдэж буй',
  paid:      'Төлбөр төлөгдсөн',
  cancelled: 'Цуцлагдсан',
  refunded:  'Буцаагдсан',
};

const STATUS_COLOR = {
  pending:   { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b', badge: 'badge-pending' },
  paid:      { bg: '#dcfce7', text: '#166534', dot: '#22c55e', badge: 'badge-paid' },
  cancelled: { bg: '#f3f4f6', text: '#6b7280', dot: '#9ca3af', badge: 'badge-cancelled' },
  refunded:  { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444', badge: 'badge-refunded' },
};

const ALL_STATUSES = ['pending', 'paid', 'cancelled', 'refunded'];
// 'paid'-г ажилтан гараар сонгож болохгүй — зөвхөн баталгаажсан Hipay
// төлбөрөөс (settleHipayCheckout, src/routes/payments.js) л автоматаар
// тавигддаг байх ёстой, тиймээс статус солих dropdown-д зөвхөн эдгээрийг
// л зорилтот сонголт болгоно.
const ADMIN_EDITABLE_STATUSES = ['cancelled', 'refunded'];

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('mn-MN', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700,
      background: c.bg, color: c.text, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot }} />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

// Дэлгэрэнгүй мөр (expandable)
function OrderRow({ order, onChangeStatus, updating, selectedRestaurant }) {
  const [expanded, setExpanded] = useState(false);
  const items = order.items || [];
  const displayItems = selectedRestaurant === 'all'
    ? items
    : items.filter(i => i.restaurant_name === selectedRestaurant);

  if (selectedRestaurant !== 'all' && displayItems.length === 0) return null;

  const allergyTags = order.allergy_tags || [];
  const hasAllergyInfo = allergyTags.length > 0 || Boolean(order.allergy_other);
  const conflicts = displayItems
    .map(item => ({ item, hit: (item.allergens || []).filter(a => allergyTags.includes(a)) }))
    .filter(c => c.hit.length > 0);

  // Delivery info
  const deliveryInfo = order.room_number
    ? `${order.hotel_name ? order.hotel_name + ' · ' : ''}Өрөө ${order.room_number}`
    : order.delivery_address || '—';
  const deliveryTimeInfo = order.delivery_window_start && order.delivery_window_end
    ? `${order.delivery_window_start}–${order.delivery_window_end}`
    : null;

  // Restaurants involved in this order (unique)
  const restaurantNames = [...new Set(items.map(i => i.restaurant_name).filter(Boolean))];

  return (
    <>
      <tr
        onClick={() => setExpanded(p => !p)}
        style={{
          cursor: 'pointer',
          background: expanded ? 'var(--bg-muted)' : undefined,
          borderBottom: expanded ? 'none' : undefined,
          transition: 'background 0.15s',
        }}
      >
        {/* Захиалгын ID */}
        <td style={{ padding: '11px 12px', fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {formatOrderNumber(order.order_number)}
        </td>
        {/* Огноо */}
        <td style={{ padding: '11px 12px', fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {fmtDate(order.created_at)}
        </td>
        {/* Зочин */}
        <td style={{ padding: '11px 12px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-dark)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <User size={13} color="var(--brand-green-light)" />
            {order.guest_name || '—'}
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {deliveryInfo}
            {deliveryTimeInfo && (
              <span style={{ color: 'var(--brand-green-btn)', fontWeight: 700 }}> · {deliveryTimeInfo}</span>
            )}
          </div>
        </td>
        {/* Ресторан */}
        <td style={{ padding: '11px 12px', fontSize: '0.8rem', color: 'var(--text-body)' }}>
          {restaurantNames.join(', ') || '—'}
        </td>
        {/* Нийт дүн */}
        <td style={{ padding: '11px 12px', fontWeight: 900, fontSize: '0.9rem', color: 'var(--brand-green)', whiteSpace: 'nowrap' }}>
          ${Number(order.total_usd).toFixed(2)}
        </td>
        {/* Захиалгын статус */}
        <td style={{ padding: '11px 12px' }}>
          <StatusBadge status={order.status} />
        </td>
        {/* Төлбөрийн статус */}
        <td style={{ padding: '11px 12px', fontSize: '0.78rem', fontWeight: 700, color: order.payment_status === 'paid' ? '#166534' : '#92400e' }}>
          {order.payment_status === 'paid' ? '✓ Төлөгдсөн' : '✗ Төлөөгүй'}
        </td>
        {/* Статус солих */}
        <td style={{ padding: '11px 12px' }} onClick={e => e.stopPropagation()}>
          <select
            value={order.status}
            disabled={updating}
            onChange={e => onChangeStatus(order.id, e.target.value)}
            style={{
              padding: '4px 8px', borderRadius: 7, fontSize: '0.75rem', fontWeight: 700,
              border: '1px solid var(--border)', background: 'var(--bg-card)',
              opacity: updating ? 0.5 : 1, cursor: 'pointer',
            }}
          >
            {/* Одоогийн статус (жишээ нь 'paid') харагдахын тулд жагсаалтад
                байлгана, гэхдээ зорилтот сонголтоор зөвхөн ADMIN_EDITABLE_STATUSES-г
                л санал болгоно — 'paid' рүү гараар шилжих боломжгүй. */}
            {Array.from(new Set([order.status, ...ADMIN_EDITABLE_STATUSES])).map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </td>
        {/* Expand icon */}
        <td style={{ padding: '11px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </td>
      </tr>

      {/* Дэлгэрэнгүй мөр */}
      {expanded && (
        <tr>
          <td colSpan={9} style={{ padding: '0 12px 14px', background: 'var(--bg-muted)', borderBottom: '1.5px solid var(--border)' }}>
            {/* Харшилтай анхааруулга */}
            {conflicts.length > 0 && (
              <div style={{
                background: '#fef2f2', border: '1.5px solid #fecaca', color: '#991b1b',
                borderRadius: 8, padding: '9px 12px', marginBottom: 10, fontSize: '0.78rem', fontWeight: 700,
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <AlertTriangle size={14} /> ХАРШИЛТАЙ ЗӨРЧИЛДЛОО — АНХААРАХ!
                </span>
                {conflicts.map(({ item, hit }, idx) => (
                  <div key={idx}>"{item.name}" агуулна: {hit.join(', ')}</div>
                ))}
              </div>
            )}
            {hasAllergyInfo && conflicts.length === 0 && (
              <div style={{
                background: '#fffbeb', border: '1.5px solid #fde68a', color: '#92400e',
                borderRadius: 8, padding: '7px 12px', marginBottom: 10, fontSize: '0.75rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <AlertTriangle size={14} />
                <span>Зочны мэдэгдсэн харшил: {[...allergyTags, order.allergy_other].filter(Boolean).join(', ')}</span>
              </div>
            )}

            {/* Захиалсан хоолнууд */}
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: 6, marginTop: 10 }}>
              Захиалсан зүйлс:
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card)' }}>
                  <th style={{ padding: '5px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Хоол</th>
                  <th style={{ padding: '5px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>Тоо</th>
                  <th style={{ padding: '5px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Ресторан</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '5px 10px', color: 'var(--text-body)' }}>{item.name}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                    <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>{item.restaurant_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {order.paid_at && (
              <div style={{ fontSize: '0.73rem', color: 'var(--brand-green)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={11} /> Төлбөр төлөгдсөн: {fmtDate(order.paid_at)}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function OrdersBoard() {
  const [orders, setOrders] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [filterRestaurant, setFilterRestaurant] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [sortCol, setSortCol] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const socketRef = useRef(null);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await adminFetchJson('/api/admin/orders');
      if (Array.isArray(data)) { setOrders(data); setError(''); }
    } catch {
      setError('Захиалгын мэдээлэл татахад алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/menu/restaurants', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRestaurants(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchOrders();
    const socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });
    socket.on('connect_error', (err) => {
      console.warn('OrdersBoard socket connect_error', err);
    });
    socket.emit('admin:join');
    socket.on('order:new', fetchOrders);
    socket.on('order:updated', fetchOrders);
    socketRef.current = socket;
    const poll = setInterval(fetchOrders, 20000);
    return () => { socket.disconnect(); clearInterval(poll); };
  }, [fetchOrders]);

  const handleChangeStatus = async (orderId, status) => {
    setUpdatingId(orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError('Статус шинэчлэхэд алдаа гарлаа.');
      fetchOrders();
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter + sort
  const filtered = orders.filter(o => {
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    if (filterRestaurant !== 'all') {
      const items = o.items || [];
      if (!items.some(i => i.restaurant_name === filterRestaurant)) return false;
    }
    if ((filterFrom || filterTo) && !isWithinDateRange(o.created_at, filterFrom, filterTo)) return false;
    return true;
  }).sort((a, b) => {
    let aVal = a[sortCol] ?? '';
    let bVal = b[sortCol] ?? '';
    if (sortCol === 'total_usd') { aVal = Number(aVal); bVal = Number(bVal); }
    if (sortDir === 'asc') return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  });

  // Summary stats
  const stats = {
    total: filtered.length,
    pending: filtered.filter(o => o.status === 'pending').length,
    paid: filtered.filter(o => o.status === 'paid').length,
    cancelled: filtered.filter(o => o.status === 'cancelled').length,
    revenue: filtered.filter(o => o.status === 'paid').reduce((s, o) => s + Number(o.total_usd), 0),
  };

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{ opacity: 0.3, marginLeft: 3 }}>↕</span>;
    return <span style={{ marginLeft: 3 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // Одоо шүүгдэж буй захиалгуудыг Excel файл болгож татна — нэг sheet
  // захиалга тус бүрээр (summary), нөгөө нь захиалсан хоол тус бүрээр (дэлгэрэнгүй).
  const handleExportExcel = () => {
    const summaryRows = filtered.map(o => ({
      'Захиалгын ID': formatOrderNumber(o.order_number),
      'Огноо': fmtDate(o.created_at),
      'Зочин': o.guest_name || '',
      'Хүргэлт': o.room_number ? `${o.hotel_name || ''} Өрөө ${o.room_number}` : (o.delivery_address || ''),
      'Ресторан': [...new Set((o.items || []).map(i => i.restaurant_name).filter(Boolean))].join(', '),
      'Нийт үнэ ($)': Number(o.total_usd),
      'Захиалгын статус': STATUS_LABEL[o.status] || o.status,
      'Төлбөр': o.payment_status === 'paid' ? 'Төлөгдсөн' : 'Төлөөгүй',
      'Төлбөр төлөгдсөн огноо': fmtDate(o.paid_at),
    }));

    const detailRows = filtered.flatMap(o => (o.items || []).map(item => ({
      'Захиалгын ID': formatOrderNumber(o.order_number),
      'Огноо': fmtDate(o.created_at),
      'Зочин': o.guest_name || '',
      'Хоол': item.name,
      'Тоо ширхэг': item.quantity,
      'Нэгжийн үнэ ($)': Number(item.unit_price_usd ?? 0),
      'Нийлбэр ($)': Number(item.unit_price_usd ?? 0) * item.quantity,
      'Ресторан': item.restaurant_name || '',
      'Захиалгын статус': STATUS_LABEL[o.status] || o.status,
    })));

    const stamp = new Date().toISOString().slice(0, 10);
    downloadExcel(`orders_${stamp}.xlsx`, [
      { name: 'Захиалгууд', rows: summaryRows },
      { name: 'Дэлгэрэнгүй', rows: detailRows },
    ]);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 className="heading-md">Захиалгууд</h2>
        <button
          onClick={fetchOrders}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            background: 'var(--bg-muted)', border: '1px solid var(--border)',
            fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} /> Шинэчлэх
        </button>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Нийт', value: stats.total, color: 'var(--text-dark)' },
          { label: 'Хүлээгдэж буй', value: stats.pending, color: '#92400e' },
          { label: 'Төлөгдсөн', value: stats.paid, color: '#166534' },
          { label: 'Цуцлагдсан', value: stats.cancelled, color: '#6b7280' },
          { label: 'Орлого', value: `$${stats.revenue.toFixed(2)}`, color: 'var(--brand-green)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        marginBottom: 16, padding: '12px 14px',
        background: 'var(--bg-muted)', borderRadius: 10, border: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Шүүлтүүр:</span>

        {/* Ресторан filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Ресторан:</label>
          <select
            value={filterRestaurant}
            onChange={e => setFilterRestaurant(e.target.value)}
            style={{
              padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)',
              fontSize: '0.8rem', fontWeight: 700, background: 'var(--bg-card)',
            }}
          >
            <option value="all">Бүгд</option>
            {restaurants.map(r => (
              <option key={r.id} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Статус filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Статус:</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{
              padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)',
              fontSize: '0.8rem', fontWeight: 700, background: 'var(--bg-card)',
            }}
          >
            <option value="all">Бүгд</option>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>

        {/* Огнооны хязгаар filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Огноо:</label>
          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            max={filterTo || undefined}
            style={{
              padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)',
              fontSize: '0.78rem', fontWeight: 600, background: 'var(--bg-card)',
            }}
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>—</span>
          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            min={filterFrom || undefined}
            style={{
              padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)',
              fontSize: '0.78rem', fontWeight: 600, background: 'var(--bg-card)',
            }}
          />
          {(filterFrom || filterTo) && (
            <button
              onClick={() => { setFilterFrom(''); setFilterTo(''); }}
              style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'underline', background: 'transparent' }}
            >
              Цэвэрлэх
            </button>
          )}
        </div>

        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {filtered.length} захиалга
        </span>

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

      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px 14px', borderRadius: 10, fontSize: '0.85rem', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Ачааллаж байна...</p>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)',
          border: '1.5px dashed var(--border)', borderRadius: 12, fontSize: '0.9rem',
        }}>
          Захиалга олдсонгүй
        </div>
      ) : (
        /* Table */
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)', borderBottom: '2px solid var(--border)' }}>
                {[
                  { label: 'ID', col: 'order_number' },
                  { label: 'Огноо', col: 'created_at' },
                  { label: 'Зочин / Хүргэлт', col: 'guest_name' },
                  { label: 'Ресторан', col: null },
                  { label: 'Дүн', col: 'total_usd' },
                  { label: 'Захиалгын статус', col: 'status' },
                  { label: 'Төлбөр', col: 'payment_status' },
                  { label: 'Өөрчлөх', col: null },
                  { label: '', col: null },
                ].map(({ label, col }, i) => (
                  <th
                    key={i}
                    onClick={col ? () => toggleSort(col) : undefined}
                    style={{
                      padding: '10px 12px', textAlign: 'left',
                      fontFamily: 'Outfit, sans-serif', fontWeight: 800,
                      fontSize: '0.75rem', color: 'var(--text-muted)',
                      cursor: col ? 'pointer' : 'default',
                      userSelect: 'none', whiteSpace: 'nowrap',
                    }}
                  >
                    {label}{col && <SortIcon col={col} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <OrderRow
                  key={o.id}
                  order={o}
                  onChangeStatus={handleChangeStatus}
                  updating={updatingId === o.id}
                  selectedRestaurant={filterRestaurant}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
