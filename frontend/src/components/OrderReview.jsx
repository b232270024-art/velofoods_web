import React from 'react';
import { AlertTriangle, ChevronLeft, MapPin, User } from 'lucide-react';
import { LocationPicker } from './LocationPicker';
import { DeliveryTimeSlotPicker } from './DeliveryTimeSlotPicker';

export function OrderReview({
  cart, session, deliveryType,
  pendingGuestName, pendingAddress, pendingGeo, onLocationChange,
  timeSlots, selectedTimeSlotId, onSelectTimeSlot,
  agreeTerms, onToggleAgree, onOpenTerms,
  onPay, isSubmitting, onEditDetails, onBack, tr,
}) {
  const total = cart.reduce((s, i) => s + Number(i.price_usd) * i.quantity, 0);

  // 'current_location' orders defer session creation until the map picker below
  // has a confirmed address — until then, fall back to the not-yet-submitted values.
  const needsLocation = deliveryType === 'current_location' && !session;
  const guestName = session?.guest_name || pendingGuestName;
  const addressText = session?.delivery_address || pendingAddress;
  const needsTimeSlot = timeSlots && timeSlots.length > 0;
  const canPay = agreeTerms && (!needsLocation || (pendingAddress.trim() && pendingGeo)) && (!needsTimeSlot || selectedTimeSlotId);

  return (
    <div className="anim-fade-up" style={{ maxWidth: 640, margin: '0 auto', padding: '40px 0 100px' }}>
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
        {tr.back}
      </button>

      <h2 className="heading-lg" style={{ marginBottom: 24 }}>{tr.reviewTitle}</h2>

      {/* Current-location delivery: confirm the drop-off point right here, no popup */}
      {needsLocation && (
        <LocationPicker
          geo={pendingGeo}
          address={pendingAddress}
          onLocationChange={onLocationChange}
          tr={tr}
        />
      )}

      {/* Tomorrow's delivery time window — placed right below the location map */}
      <DeliveryTimeSlotPicker
        slots={timeSlots}
        selectedId={selectedTimeSlotId}
        onSelect={onSelectTimeSlot}
        tr={tr}
      />

      {/* Red refund warning */}
      <div style={{
        display: 'flex', gap: 12,
        background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--r-md)',
        padding: '16px 18px', marginBottom: 24,
      }}>
        <AlertTriangle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ color: '#991b1b', fontSize: '0.85rem', lineHeight: 1.65, fontWeight: 500 }}>
          {tr.refundWarning}
        </p>
      </div>

      {/* Order items */}
      <div className="card" style={{ padding: '24px 26px', marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', marginBottom: 16 }}>
          {tr.reviewItemsTitle}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {cart.map(item => (
            <div
              key={item.menu_item_id}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '0.9rem', color: 'var(--text-body)' }}>
                <strong style={{ color: 'var(--text-dark)' }}>{item.quantity}×</strong> {item.name}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9rem' }}>
                ${(Number(item.price_usd) * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, paddingTop: 4 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{tr.cartSubtotal}</span>
          <span key={total} className="anim-bump" style={{ fontWeight: 900, fontSize: '1.35rem', color: 'var(--brand-green)' }}>
            ${total.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Delivery info */}
      <div className="card" style={{ padding: '20px 26px', marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={16} color="var(--brand-green-light)" />
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-dark)' }}>{guestName}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <MapPin size={16} color="var(--brand-green-light)" style={{ marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-body)' }}>
                {deliveryType === 'current_location'
                  ? (addressText || tr.locationPickerHint)
                  : `${session?.hotel_name || ''}${session?.room_number ? ` — ${tr.room} ${session.room_number}` : ''}`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onEditDetails}
            style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: 8,
              background: 'var(--bg-muted)', border: '1px solid var(--border)',
              fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)',
            }}
          >
            {tr.reviewEditBtn}
          </button>
        </div>
      </div>

      {/* Terms checkbox */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24, cursor: 'pointer' }}>
        <input
          id="agree-terms-checkbox"
          type="checkbox"
          className="checkbox-custom"
          checked={agreeTerms}
          onChange={e => onToggleAgree(e.target.checked)}
          style={{ marginTop: 2 }}
        />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-body)', lineHeight: 1.6 }}>
          {tr.agreeTermsPrefix}{' '}
          <button
            type="button"
            id="open-terms-btn"
            onClick={onOpenTerms}
            style={{
              background: 'none', color: 'var(--brand-green-btn)',
              fontWeight: 700, textDecoration: 'underline', fontSize: '0.85rem',
              padding: 0, display: 'inline',
            }}
          >
            {tr.agreeTermsLink}
          </button>
        </span>
      </label>

      {needsLocation && !(pendingAddress.trim() && pendingGeo) && (
        <p style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 600, marginBottom: 10 }}>
          {tr.locationRequiredHint}
        </p>
      )}

      {needsTimeSlot && !selectedTimeSlotId && (
        <p style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 600, marginBottom: 10 }}>
          {tr.deliveryTimeRequiredHint}
        </p>
      )}

      <button
        id="pay-now-btn"
        onClick={onPay}
        disabled={!canPay || isSubmitting}
        className={canPay && !isSubmitting ? 'anim-pulse-glow' : ''}
        style={{
          width: '100%', padding: 17, borderRadius: 14,
          fontWeight: 800, fontSize: '1rem',
          background: !canPay
            ? '#d1d5db'
            : isSubmitting ? '#a7f3d0' : 'linear-gradient(135deg, #3D7A5A, #1A3C34)',
          color: 'white',
          cursor: (!canPay || isSubmitting) ? 'not-allowed' : 'pointer',
          transition: 'background 0.25s ease, box-shadow 0.25s ease',
        }}
      >
        {isSubmitting ? tr.cartPlacing : tr.payNowBtn}
      </button>
    </div>
  );
}
