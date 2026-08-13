import React, { useEffect, useState } from 'react';
import { Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { Crosshair, MapPin, Loader2 } from 'lucide-react';
import { detectCurrentPosition, reverseGeocode } from '../lib/geocode';

const DEFAULT_CENTER = { lat: 47.9184, lng: 106.9177 }; // Ulaanbaatar

// Дугуй пин — teardrop хэлбэрийн зурагтай харьцуулахад center-anchor нь
// байгалиараа зөв цэг дээр тохирдог тул google.maps.Point-оор тусгайлан
// anchor тооцоолох шаардлагагүй (энэ нь module ачаалагдах үед window.google
// хараахан бэлэн болоогүй байж болзошгүй тул эрсдэлтэй байсан).
const PIN_ICON_URL = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">' +
  '<circle cx="15" cy="15" r="12" fill="#3D7A5A" stroke="white" stroke-width="3"/>' +
  '<circle cx="15" cy="15" r="4" fill="white"/>' +
  '</svg>'
);

// <Map>-ийн defaultCenter/defaultZoom нь зөвхөн эхний mount дээр л хэрэглэгддэг
// (Leaflet-ийн газрын зургийг гараар нэг л удаа init хийдэгтэй адил) тул
// гаднаас (жишээ нь "Одоогийн байршил илрүүлэх" товч) geo өөрчлөгдөх бүрд
// газрын зургийг дахин төвлөрүүлэхийн тулд газрын зургийн instance-г
// useMap()-ээр аваад panTo хийх шаардлагатай.
function MapRecenter({ geo }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !geo) return;
    map.panTo(geo);
    map.setZoom(16);
  }, [map, geo]);
  return null;
}

export function LocationPicker({ geo, address, onLocationChange, tr }) {
  const [detecting, setDetecting] = useState(false);
  const [status, setStatus] = useState('');

  const resolveAndEmit = async (lat, lng) => {
    setStatus(tr.locationResolving);
    try {
      const result = await reverseGeocode(lat, lng);
      onLocationChange({ lat, lng, address: result.address });
      setStatus(tr.locationConfirmed);
    } catch {
      onLocationChange({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      setStatus(tr.locationConfirmed);
    }
  };

  const handleDetect = async () => {
    setDetecting(true);
    setStatus(tr.locationDetecting);
    try {
      const { lat, lng } = await detectCurrentPosition();
      await resolveAndEmit(lat, lng);
    } catch {
      setStatus(tr.locationDetectFail);
    } finally {
      setDetecting(false);
    }
  };

  const markerPosition = geo || DEFAULT_CENTER;

  return (
    <div className="card" style={{ padding: '22px 24px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={18} color="var(--brand-green)" />
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem' }}>
            {tr.locationPickerTitle}
          </h3>
        </div>
        <button
          id="detect-location-btn"
          type="button"
          onClick={handleDetect}
          disabled={detecting}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10,
            background: 'var(--brand-green)', color: 'white',
            fontSize: '0.8rem', fontWeight: 700,
            opacity: detecting ? 0.7 : 1,
          }}
        >
          {detecting ? <Loader2 size={15} className="spin-icon" /> : <Crosshair size={15} />}
          {detecting ? tr.locationDetecting : tr.locationDetectBtn}
        </button>
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        {tr.locationPickerHint}
      </p>

      <div
        id="location-map"
        style={{
          width: '100%', height: 260, borderRadius: 'var(--r-md)',
          overflow: 'hidden', border: '1px solid var(--border)',
          marginBottom: 14,
        }}
      >
        <Map
          defaultCenter={markerPosition}
          defaultZoom={geo ? 16 : 12}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          style={{ width: '100%', height: '100%' }}
          onClick={(e) => {
            if (!e.detail.latLng) return;
            resolveAndEmit(e.detail.latLng.lat, e.detail.latLng.lng);
          }}
        >
          <MapRecenter geo={geo} />
          <Marker
            position={markerPosition}
            draggable
            icon={PIN_ICON_URL}
            onDragEnd={(e) => {
              if (!e.latLng) return;
              resolveAndEmit(e.latLng.lat(), e.latLng.lng());
            }}
          />
        </Map>
      </div>

      {status && (
        <p style={{ fontSize: '0.78rem', color: 'var(--brand-green-btn)', fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          <MapPin size={13} /> {status}
        </p>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: 6 }}>
          {tr.guestAddressLabel}
        </label>
        <textarea
          id="location-address-input"
          value={address}
          onChange={e => onLocationChange({ lat: geo?.lat ?? null, lng: geo?.lng ?? null, address: e.target.value })}
          placeholder={tr.guestAddressPlaceholder}
          rows={2}
          style={{
            width: '100%', padding: '10px 14px',
            borderRadius: 10, border: '1.5px solid var(--border)',
            fontSize: '0.88rem', outline: 'none', resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>{tr.guestAddressEditHint}</p>
      </div>
    </div>
  );
}
