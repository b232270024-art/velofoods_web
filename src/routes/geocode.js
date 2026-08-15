import { Router } from 'express';
import https from 'https';
import { asyncHandler } from '../middleware/errorHandler.js';

export const geocodeRouter = Router();

function httpGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    // timeout байхгүй бол Google/Nominatim саатах үед хүсэлт мөнхөд хариу
    // хүлээгээд зогсдог байсан (hipay.js/exchangeRate.js-д байдаг адил хамгаалалт
    // энд байхгүй байсан цоорхой) — 8с-д хариу ирэхгүй бол тодорхой алдаа шидэж,
    // reverseGeocodeGoogle/Nominatim-ийн catch нь fallback/404 руу шилждэг.
    const req = https.get(url, { headers, timeout: 8000 }, (r) => {
      let body = '';
      r.on('data', (chunk) => { body += chunk; });
      r.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (err) { reject(err); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Geocoding хүсэлт хугацаа хэтэрлээ')));
    req.on('error', reject);
  });
}

// Google-ийн хаягийн нэршил Nominatim-аас илүү нарийвчлалтай (ялангуяа Монголд) тул
// түрүүлж үзнэ. API түлхүүр зөвхөн backend-д хадгалагдана — frontend рүү дамждаггүй.
async function reverseGeocodeGoogle(lat, lng) {
  const key = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}&language=mn`;
  const data = await httpGetJson(url);
  if (data.status !== 'OK' || !data.results?.length) return null;
  return { address: data.results[0].formatted_address, raw: data.results[0] };
}

async function reverseGeocodeNominatim(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
  const data = await httpGetJson(url, { 'User-Agent': 'hotel-dining-backend/1.0 (reverse-geocode)' });
  if (!data || data.error) return null;
  return { address: data.display_name, raw: data.address ?? null };
}

// "Одоогийн байршил"-аар хүргүүлэх зочны координатыг уншигдах хаяг болгож хөрвүүлнэ.
// Эхлээд Google Geocoding API (GOOGLE_GEOCODING_API_KEY тохируулсан бол), тэр ажиллахгүй
// бол Nominatim (OpenStreetMap, үнэгүй, key шаардахгүй) руу автоматаар шилжинэ.
geocodeRouter.get('/reverse', asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat, lng параметр буруу байна.' });
  }

  let result = null;
  try {
    result = await reverseGeocodeGoogle(lat, lng);
  } catch { /* Google амжилтгүй бол Nominatim-руу шилжинэ */ }

  if (!result) {
    try {
      result = await reverseGeocodeNominatim(lat, lng);
    } catch { /* доор 404 буцна */ }
  }

  if (!result) {
    return res.status(404).json({ error: 'Хаяг тодорхойлж чадсангүй.' });
  }

  res.json({ address: result.address, raw: result.raw, lat, lng });
}));
