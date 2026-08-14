import React, { useCallback, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { Send, MessageCircle } from 'lucide-react';
import { formatOrderNumber } from '../lib/orderNumber';
import { adminFetchJson } from '../lib/adminFetch';

const STATUS_LABEL = {
  pending:   'Хүлээгдэж буй',
  paid:      'Төлбөр төлөгдсөн',
  cancelled: 'Цуцлагдсан',
  refunded:  'Буцаагдсан',
};

const STATUS_COLOR = {
  pending:   { bg: '#fef3c7', text: '#92400e' },
  paid:      { bg: '#dcfce7', text: '#166534' },
  cancelled: { bg: '#f3f4f6', text: '#6b7280' },
  refunded:  { bg: '#fee2e2', text: '#991b1b' },
};

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
      display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
      borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
      background: c.bg, color: c.text, whiteSpace: 'nowrap',
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function ChatPage() {
  const [threads, setThreads] = useState([]);
  // Захиалгатай ('order') болон захиалгагүй ('general', guest_token) thread
  // хоёулаа /api/admin/chat/threads-с нэг жагсаалтад ирнэ (thread_id, type талбартай).
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [selectedThreadType, setSelectedThreadType] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);

  const selectedThreadIdRef = useRef(null);
  const scrollRef = useRef(null);
  useEffect(() => { selectedThreadIdRef.current = selectedThreadId; }, [selectedThreadId]);

  const fetchThreads = useCallback(() => {
    adminFetchJson('/api/admin/chat/threads')
      .then((data) => { if (Array.isArray(data)) setThreads(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchThreads();
    const socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });
    socket.on('connect_error', (err) => {
      console.warn('Admin ChatPage socket connect_error', err);
    });
    socket.emit('admin:join');
    socket.on('chat:message', (row) => {
      fetchThreads();
      const rowThreadId = row.order_id || row.guest_token;
      if (rowThreadId === selectedThreadIdRef.current) {
        // Our own reply already appears optimistically in handleSend — this
        // room-broadcast echoes it back, so skip it by id to avoid a duplicate.
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
      }
    });
    return () => socket.disconnect();
  }, [fetchThreads]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSelectThread = async (threadId, type) => {
    setSelectedThreadId(threadId);
    setSelectedThreadType(type);
    setMessages([]);
    setOrderDetail(null);
    setLoadingThread(true);
    try {
      const url = type === 'general' ? `/api/admin/chat/general/${threadId}/messages` : `/api/admin/chat/${threadId}/messages`;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages);
        setOrderDetail(type === 'order' ? data.order : null);
        setThreads((prev) => prev.map((t) => (t.thread_id === threadId ? { ...t, unread_count: 0 } : t)));
      }
    } finally {
      setLoadingThread(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending || !selectedThreadId) return;
    setSending(true);
    setDraft('');
    try {
      const url = selectedThreadType === 'general'
        ? `/api/admin/chat/general/${selectedThreadId}/messages`
        : `/api/admin/chat/${selectedThreadId}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      // The 'admin' room echo of this same message can arrive before this
      // HTTP response resolves — dedupe by id to avoid a visible duplicate.
      if (res.ok) setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 16 }}>
      {/* Thread list */}
      <div className="card" style={{ width: 300, flexShrink: 0, overflowY: 'auto', padding: 0 }}>
        {threads.length === 0 ? (
          <p style={{ padding: 20, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Одоогоор чат байхгүй байна.</p>
        ) : (
          threads.map((t) => (
            <button
              key={t.thread_id}
              onClick={() => handleSelectThread(t.thread_id, t.type)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '14px 16px', borderBottom: '1px solid var(--border)',
                background: selectedThreadId === t.thread_id ? 'var(--bg-muted)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-dark)' }}>
                  {t.type === 'general' ? 'Ерөнхий чат' : t.guest_name}
                </span>
                {t.unread_count > 0 && (
                  <span style={{
                    background: '#ef4444', color: '#fff', borderRadius: 999,
                    fontSize: '0.7rem', fontWeight: 800, padding: '1px 7px',
                  }}>
                    {t.unread_count}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                {t.type === 'general' ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
                    borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
                    background: '#e0e7ff', color: '#3730a3', whiteSpace: 'nowrap',
                  }}>
                    Захиалгагүй
                  </span>
                ) : (
                  <>
                    <StatusBadge status={t.order_status} />
                    <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {formatOrderNumber(t.order_number)}
                    </span>
                  </>
                )}
              </div>
              <p style={{
                fontSize: '0.78rem', color: 'var(--text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {t.last_sender === 'admin' ? 'Та: ' : ''}{t.last_message}
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{fmtDate(t.last_message_at)}</p>
            </button>
          ))
        )}
      </div>

      {/* Conversation */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, minWidth: 0 }}>
        {!selectedThreadId ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 10 }}>
            <MessageCircle size={32} />
            <p style={{ fontSize: '0.9rem' }}>Зүүн талаас чат сонгоно уу.</p>
          </div>
        ) : (
          <>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              {selectedThreadType === 'general' ? (
                <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Ерөнхий чат (захиалгагүй)</span>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{orderDetail?.guest_name}</span>
                    {orderDetail && <StatusBadge status={orderDetail.status} />}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {formatOrderNumber(orderDetail?.order_number)}
                  </p>
                  {orderDetail && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {orderDetail.room_number ? `${orderDetail.hotel_name || ''} Өрөө ${orderDetail.room_number} · ` : ''}
                      ${Number(orderDetail.total_usd).toFixed(2)}
                    </p>
                  )}
                </>
              )}
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loadingThread ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Ачааллаж байна...</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.sender === 'admin' ? 'flex-end' : 'flex-start',
                      maxWidth: '70%',
                      background: m.sender === 'admin' ? 'var(--brand-green)' : 'var(--bg-muted)',
                      color: m.sender === 'admin' ? '#fff' : 'var(--text-dark)',
                      padding: '9px 13px', borderRadius: 12,
                      fontSize: '0.87rem', lineHeight: 1.4, wordBreak: 'break-word',
                    }}
                  >
                    {m.message}
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSend} style={{ display: 'flex', gap: 10, padding: 16, borderTop: '1px solid var(--border)' }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Хариулт бичих..."
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 8,
                  border: '1.5px solid var(--border)', fontSize: '0.9rem',
                }}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="btn-primary"
                style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 6, opacity: sending || !draft.trim() ? 0.6 : 1 }}
              >
                <Send size={16} /> Илгээх
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
