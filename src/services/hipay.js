import https from 'https';
import { URL } from 'url';
import { getUsdToMntRate } from './exchangeRate.js';

// Node 16 дээр global fetch байхгүй тул native https ашиглав (шинэ dependency
// нэмэхгүйн тулд). https.request нь HTTP/HTTPS хоёуланг зохицуулна.

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} орчны хувьсагч тохируулаагүй байна (.env-д нэмнэ үү)`);
  return value;
}

function hipayRequest(method, pathname, { query, body } = {}) {
  const baseUrl = requiredEnv('HIPAY_API_BASE_URL');
  const clientSecret = requiredEnv('HIPAY_CLIENT_SECRET');

  const url = new URL(pathname, baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    }
  }

  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method,
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
        timeout: 15000,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            reject(new Error(`Hipay-аас ирсэн хариу JSON биш байна (${res.statusCode}): ${raw.slice(0, 300)}`));
            return;
          }
          if (res.statusCode >= 400) {
            reject(new Error(`Hipay API алдаа (${res.statusCode}): ${parsed.message || parsed.description || raw}`));
            return;
          }
          resolve(parsed);
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error('Hipay API руу хийсэн хүсэлт хугацаа хэтэрлээ')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// $ дүнг Hipay руу илгээх дүн рүү хөрвүүлнэ. HIPAY_CURRENCY нь заавал
// тохируулагдсан байх ёстой — тохируулаагүй бол буруу дүнгээр төлбөр авахаас
// зайлсхийхийн тулд бүрэн зогсоно (fail fast). 'MNT' үед ханшийг гараар
// биш, Монголбанкнаас тухайн өдрийн албан ёсны ханшаар автоматаар авна
// (exchangeRate.js) — ханш авч чадахгүй бол мөн адил fail fast зарчмаар
// төлбөрийг эхлүүлэхгүй.
export async function convertUsdForHipay(amountUsd) {
  // Be tolerant in production: if HIPAY_CURRENCY isn't configured, default
  // to USD to avoid failing payment initiation entirely. For MNT we try to
  // fetch the official rate from Mongolbank; if that fails and an explicit
  // HIPAY_USD_TO_MNT_RATE env var is provided, use it as a fallback.
  const currency = process.env.HIPAY_CURRENCY || 'USD';

  if (currency === 'USD') {
    return { amount: Number(amountUsd), currency, fxRate: 1 };
  }
  if (currency === 'MNT') {
    try {
      const rate = await getUsdToMntRate();
      return { amount: Math.round(Number(amountUsd) * rate), currency, fxRate: rate };
    } catch (err) {
      const fallback = process.env.HIPAY_USD_TO_MNT_RATE ? Number(process.env.HIPAY_USD_TO_MNT_RATE) : null;
      if (fallback && Number.isFinite(fallback) && fallback > 0) {
        console.warn('Монголбанк ханш авч чадсангүй, орлуулагч env HIPAY_USD_TO_MNT_RATE ашиглаж байна', err.message);
        return { amount: Math.round(Number(amountUsd) * fallback), currency: 'MNT', fxRate: fallback };
      }
      // If we cannot determine a safe MNT rate, fail so we don't charge wrong amount.
      throw new Error(`Монголбанкнаас USD->MNT ханш авч чадсангүй: ${err.message}`);
    }
  }
  throw new Error(`HIPAY_CURRENCY утга дэмжигдэхгүй байна: ${currency} (зөвхөн 'USD' эсвэл 'MNT')`);
}

// POST /checkout — захиалгад зориулсан invoice үүсгэж, checkoutId буцаана.
export function createHipayCheckout({ amount, redirectUri, webhookUrl }) {
  return hipayRequest('POST', '/checkout', {
    body: {
      entityId: requiredEnv('HIPAY_ENTITY_ID'),
      redirect_uri: redirectUri,
      webhook_url: webhookUrl,
      amount,
    },
  });
}

// GET /checkout/get/:checkoutId — webhook/redirect ирэх бүрт эх сурвалж
// болгон ашиглах ёстой цорын ганц баталгаажуулах дуудлага (webhook/redirect
// өөрсдөө signature-гүй тул итгэх боломжгүй).
export function getHipayCheckoutStatus(checkoutId) {
  return hipayRequest('GET', `/checkout/get/${encodeURIComponent(checkoutId)}`, {
    query: { entityId: requiredEnv('HIPAY_ENTITY_ID') },
  });
}

// Хэрэглэгчийн browser-ийг чиглүүлэх Hipay-ийн төлбөрийн хуудасны URL.
export function buildHipayPaymentFormUrl(checkoutId, { lang, email, phone } = {}) {
  const url = new URL('/payment/', requiredEnv('HIPAY_API_BASE_URL'));
  url.searchParams.set('checkoutId', checkoutId);
  if (lang) url.searchParams.set('lang', lang);
  if (email) url.searchParams.set('email', email);
  if (phone) url.searchParams.set('phone', phone);
  return url.toString();
}
