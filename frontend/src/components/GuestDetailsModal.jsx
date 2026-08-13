import React, { useState } from 'react';
import { MapPin, User, DoorClosed, AlertCircle, Hotel, X } from 'lucide-react';

const ALLERGEN_OPTIONS = ['gluten', 'dairy', 'nuts', 'eggs', 'fish', 'sesame'];

// deliveryType: 'hotel' | 'current_location' | null (null => implicit hotel, used by the
// 12-day plan flow where delivery is always to the guest's room).
// For 'current_location', this modal only collects the guest's name — the actual
// location is captured with a map picker on the order review screen (no second popup).
// For 'hotel' (incl. implicit 12-day), the guest just types which hotel + room they're
// in — one shared site/QR now serves guests across many different real hotels, so there's
// no hotel record to resolve or GPS-verify against; whatever the guest types is used as-is.
export function GuestDetailsModal({ isOpen, tr, deliveryType, onSubmit, onClose }) {
  const [name, setName] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [room, setRoom] = useState('');
  const [allergyTags, setAllergyTags] = useState([]);
  const [allergyOther, setAllergyOther] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isCurrentLocation = deliveryType === 'current_location';

  const toggleAllergen = (tag) => {
    setAllergyTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError(tr.checkinError); return; }
    if (!isCurrentLocation && (!hotelName.trim() || !room.trim())) { setError(tr.checkinError); return; }

    setError('');
    setLoading(true);
    try {
      await onSubmit({
        guest_name: name.trim(),
        hotel_name: isCurrentLocation ? null : hotelName.trim(),
        room_number: isCurrentLocation ? null : room.trim(),
        delivery_address: null,
        allergy_tags: allergyTags,
        allergy_other: allergyOther.trim() || null,
      });
    } catch (err) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(17,24,39,0.65)',
      backdropFilter: 'blur(10px)',
      zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div className="anim-fade-up" style={{
        background: 'var(--bg-card)', borderRadius: 'var(--r-xl)',
        maxWidth: 440, width: '100%',
        padding: '36px 32px',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--bg-muted)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-body)',
            }}
          >
            <X size={16} />
          </button>
        )}

        <div style={{
          width: 72, height: 72, borderRadius: 16,
          overflow: 'hidden',
          margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <img src="/velofoods.jpeg" alt="Velofoods" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        <h2 style={{
          textAlign: 'center', fontFamily: 'Outfit, sans-serif',
          fontWeight: 800, fontSize: '1.5rem', color: 'var(--text-dark)',
          marginBottom: 6,
        }}>
          {tr.checkinTitle}
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 28 }}>
          {tr.checkinSubtitle}
        </p>

        {error && (
          <div style={{
            background: '#fef2f2', color: '#991b1b',
            padding: '10px 14px', borderRadius: 12,
            fontSize: '0.85rem', marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: 6 }}>
              {tr.checkinNameLabel}
            </label>
            <div style={{ position: 'relative' }}>
              <User size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                id="checkin-name"
                type="text"
                placeholder={tr.checkinNamePlaceholder}
                value={name}
                onChange={e => setName(e.target.value)}
                required
                style={{
                  width: '100%', padding: '12px 14px 12px 42px',
                  borderRadius: 12, border: '1.5px solid var(--border)',
                  fontSize: '0.95rem', outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--brand-green-light)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          </div>

          {isCurrentLocation ? (
            <div style={{
              background: 'var(--bg-muted)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '12px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
              marginBottom: 28,
            }}>
              <MapPin size={20} color="var(--brand-green-light)" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-body)', lineHeight: 1.5 }}>
                {tr.guestLocationNextStepHint}
              </p>
            </div>
          ) : (
            <>
              {/* Hotel name — guest types it freely, nothing to look up or verify */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: 6 }}>
                  {tr.checkinHotelNameLabel}
                </label>
                <div style={{ position: 'relative' }}>
                  <Hotel size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    id="checkin-hotel-name"
                    type="text"
                    placeholder={tr.checkinHotelNamePlaceholder}
                    value={hotelName}
                    onChange={e => setHotelName(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '12px 14px 12px 42px',
                      borderRadius: 12, border: '1.5px solid var(--border)',
                      fontSize: '0.95rem', outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--brand-green-light)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
              </div>

              {/* Room */}
              <div style={{ marginBottom: 28 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: 6 }}>
                  {tr.checkinRoomLabel}
                </label>
                <div style={{ position: 'relative' }}>
                  <DoorClosed size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    id="checkin-room"
                    type="text"
                    placeholder={tr.checkinRoomPlaceholder}
                    value={room}
                    onChange={e => setRoom(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '12px 14px 12px 42px',
                      borderRadius: 12, border: '1.5px solid var(--border)',
                      fontSize: '0.95rem', outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--brand-green-light)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
              </div>
            </>
          )}

          {/* Allergens — optional, never blocks submit */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: 2 }}>
              {tr.allergySectionTitle}
            </label>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 10 }}>
              {tr.allergySectionHint}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {ALLERGEN_OPTIONS.map(tag => {
                const active = allergyTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleAllergen(tag)}
                    style={{
                      padding: '7px 14px', borderRadius: 'var(--r-full)',
                      fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                      border: `1.5px solid ${active ? 'var(--brand-green-light)' : 'var(--border)'}`,
                      background: active ? 'var(--bg-muted)' : 'var(--bg-card)',
                      color: active ? 'var(--brand-green)' : 'var(--text-body)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {tr[`allergyOption${tag.charAt(0).toUpperCase()}${tag.slice(1)}`]}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              placeholder={tr.allergyOtherPlaceholder}
              value={allergyOther}
              onChange={e => setAllergyOther(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px',
                borderRadius: 12, border: '1.5px solid var(--border)',
                fontSize: '0.88rem', outline: 'none',
              }}
            />
          </div>

          <button
            id="checkin-submit"
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading
                ? '#a7f3d0'
                : 'linear-gradient(135deg, #3D7A5A, #1A3C34)',
              color: 'white',
              padding: '15px', borderRadius: 14,
              fontWeight: 800, fontSize: '1rem',
              boxShadow: loading ? 'none' : 'var(--shadow-glow)',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? tr.checkinLoading : tr.checkinSubmit}
          </button>
        </form>
      </div>
    </div>
  );
}
