import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { MessageCircle, X, Send, ArrowLeft } from 'lucide-react';
import { formatOrderNumber, normalizeOrderNumber } from '../lib/orderNumber';

const ORDER_NUMBER_KEY = 'chat_order_id';

export function ChatWidget({ tr }) {
  const [open, setOpen] = useState(false);
  // Богино захиалгын дугаар (зураасгүй, жишээ нь "4XK9P2QW") — гэрчлэлт
  // амжилттай болсны дараа тавигдана, гэхдээ дотоод socket room/message-ийн
  // харьцуулалт хэвээрээ бодит UUID (order.id) дээр тулгуурлана (resolvedOrderIdRef).
  const [orderNumber, setOrderNumber] = useState(null);
  const [messages, setMessages] = useState([]);
  const [gateInput, setGateInput] = useState('');
  const [gateError, setGateError] = useState('');
  const [gateLoading, setGateLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(false);

  const socketRef = useRef(null);
  const resolvedOrderIdRef = useRef(null);
  const openRef = useRef(false);
  const scrollRef = useRef(null);

  useEffect(() => { openRef.current = open; }, [open]);

  // Socket connection lives for the widget's whole lifetime — mirrors the
  // per-feature socket pattern already used in App.jsx / OrdersBoard.jsx.
  useEffect(() => {
    const socket = io(window.location.origin);
    socketRef.current = socket;
    socket.on('chat:message', (row) => {
      if (row.order_id !== resolvedOrderIdRef.current) return;
      // The guest's own socket is a member of chat:<orderId>, so a message it
      // just sent (and already appended optimistically below) echoes back here
      // too — skip it by id instead of appending a visible duplicate.
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
      if (row.sender === 'admin' && !openRef.current) setUnread(true);
    });
    return () => socket.disconnect();
  }, []);

  // Resume a cached thread (same browser) without re-asking for the order number.
  // `ignore` guards against React StrictMode's dev-mode double-invoke firing
  // this fetch twice on mount and racing itself.
  useEffect(() => {
    const cached = localStorage.getItem(ORDER_NUMBER_KEY);
    if (!cached) return;
    let ignore = false;
    fetch(`/api/chat/${cached}/messages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (ignore) return;
        if (!data) { localStorage.removeItem(ORDER_NUMBER_KEY); return; }
        resolvedOrderIdRef.current = data.order.id;
        setOrderNumber(data.order.order_number);
        setMessages(data.messages);
        socketRef.current?.emit('chat:join', data.order.id);
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const handleToggle = () => {
    setOpen((o) => !o);
    setUnread(false);
  };

  const handleGateSubmit = async (e) => {
    e.preventDefault();
    const code = normalizeOrderNumber(gateInput);
    if (!code) return;
    setGateLoading(true);
    setGateError('');
    try {
      const res = await fetch(`/api/chat/${code}/messages`);
      // Server errors (invalid format / not found) are Mongolian admin-facing
      // strings, not part of this guest-facing i18n set — always show the
      // translated copy here instead of surfacing the raw server message.
      if (!res.ok) throw new Error(tr.chatGateNotFound);
      const data = await res.json();
      localStorage.setItem(ORDER_NUMBER_KEY, data.order.order_number);
      resolvedOrderIdRef.current = data.order.id;
      setOrderNumber(data.order.order_number);
      setMessages(data.messages);
      socketRef.current?.emit('chat:join', data.order.id);
      setGateInput('');
    } catch {
      setGateError(tr.chatGateNotFound);
    } finally {
      setGateLoading(false);
    }
  };

  const handleChangeOrder = () => {
    localStorage.removeItem(ORDER_NUMBER_KEY);
    resolvedOrderIdRef.current = null;
    setOrderNumber(null);
    setMessages([]);
    setGateInput('');
    setGateError('');
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    try {
      const res = await fetch(`/api/chat/${orderNumber}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      // The socket echo of this same message can arrive over the already-open
      // connection before this HTTP response resolves — dedupe by id so
      // whichever lands second is a no-op instead of a visible duplicate.
      if (res.ok) setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    } catch { /* ignore — guest can retry */ }
    finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={handleToggle}
        title={tr.chatFabLabel}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 260,
          width: 58, height: 58, borderRadius: '50%',
          background: 'var(--brand-green)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
        {unread && !open && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 12, height: 12, borderRadius: '50%',
            background: '#ef4444', border: '2px solid var(--bg-white)',
          }} />
        )}
      </button>

      {open && (
        <div className="anim-fade-up" style={{
          position: 'fixed', bottom: 92, right: 24, zIndex: 260,
          width: 340, maxWidth: 'calc(100vw - 32px)',
          height: 460, maxHeight: 'calc(100vh - 140px)',
          background: 'var(--bg-card)', borderRadius: 'var(--r-md)',
          boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 18px', background: 'var(--brand-green)', color: '#fff',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {orderNumber && (
              <button onClick={handleChangeOrder} title={tr.chatChangeOrderBtn} style={{ color: '#fff', background: 'transparent', display: 'flex' }}>
                <ArrowLeft size={18} />
              </button>
            )}
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.95rem' }}>
              {tr.chatHeaderTitle}
            </span>
            {orderNumber && (
              <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: '0.75rem', opacity: 0.85 }}>
                {formatOrderNumber(orderNumber)}
              </span>
            )}
          </div>

          {!orderNumber ? (
            <form onSubmit={handleGateSubmit} style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{tr.chatGateTitle}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{tr.chatGateDesc}</p>
              <input
                value={gateInput}
                onChange={(e) => setGateInput(e.target.value.toUpperCase())}
                placeholder={tr.chatGatePlaceholder}
                autoFocus
                style={{
                  padding: '10px 12px', borderRadius: 8,
                  border: '1.5px solid var(--border)', fontSize: '0.85rem',
                  color: 'var(--text-dark)', background: 'var(--bg-white)',
                }}
              />
              {gateError && <p style={{ color: '#dc2626', fontSize: '0.8rem' }}>{gateError}</p>}
              <button
                type="submit"
                disabled={gateLoading || !gateInput.trim()}
                className="btn-primary"
                style={{ padding: '10px 16px', fontSize: '0.85rem', opacity: gateLoading || !gateInput.trim() ? 0.6 : 1 }}
              >
                {gateLoading ? tr.loading : tr.chatGateSubmitBtn}
              </button>
            </form>
          ) : (
            <>
              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: 4 }}>
                  {tr.chatGreeting}
                </p>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.sender === 'guest' ? 'flex-end' : 'flex-start',
                      maxWidth: '82%',
                      background: m.sender === 'guest' ? 'var(--brand-green)' : 'var(--bg-muted)',
                      color: m.sender === 'guest' ? '#fff' : 'var(--text-dark)',
                      padding: '8px 12px', borderRadius: 12,
                      fontSize: '0.85rem', lineHeight: 1.4, wordBreak: 'break-word',
                    }}
                  >
                    {m.message}
                  </div>
                ))}
              </div>

              <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={tr.chatInputPlaceholder}
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 8,
                    border: '1.5px solid var(--border)', fontSize: '0.85rem',
                    color: 'var(--text-dark)', background: 'var(--bg-white)',
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  title={tr.chatSendBtn}
                  style={{
                    width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                    background: 'var(--brand-green)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: sending || !draft.trim() ? 0.6 : 1,
                  }}
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
