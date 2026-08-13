import https from 'https';

// Монголбанкны (Bank of Mongolia) вэбсайт өөрөө ашигладаг, боловч албан ёсоор
// баримтжуулаагүй дотоод endpoint: www.mongolbank.mn/mn/currency-rates
// хуудасны frontend JS-ээс олдсон. Тухайн өдрийн Монголбанкнаас албан ёсоор
// зарласан хамгийн сүүлийн USD ханшийг буцаадаг тул HIPAY_USD_TO_MNT_RATE-ийг
// гараар тохируулах шаардлагагүй болгож, автоматаар авахад ашиглав.
const MONGOLBANK_HOST = 'www.mongolbank.mn';
const MONGOLBANK_PATH = '/mn/currency-rates/data';

// Монголбанк ажлын өдөр бүр (амралтын өдөр/баяраас бусад) л ханшаа шинэчилдэг
// тул шинэ хүсэлт бүрд дуудахгүйгээр 1 цагийн турш кэшилнэ.
const CACHE_TTL_MS = 60 * 60 * 1000;
// Fetch бүтэлгүйтвэл (сүлжээ тасрах, Монголбанк format-аа өөрчлөх гэх мэт)
// хамгийн сүүлд амжилттай авсан ханшийг 24 цагийн дотор хэрэглэсээр байж
// болно — үүнээс хуучирвал итгэх боломжгүй гэж үзнэ.
const STALE_FALLBACK_MS = 24 * 60 * 60 * 1000;

let cache = null; // { rate, rateDate, fetchedAt }

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

function fetchLatestUsdRate() {
  const today = toDateStr(new Date());
  const weekAgo = toDateStr(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000));
  // Монголбанкны сайт startDate/endDate-г JSON body-оор биш, query string-ээр
  // хүлээж авдаг (тэдний own frontend-ийн main.min.js-ээс баталгаажуулсан —
  // bom.http нь эдгээрийг axios-ийн `params`-аар дамжуулдаг, `data` нь хоосон).
  // Body-оор илгээвэл сервер огноог огт хүлээж авахгүй тул "Тохирох үр дүн
  // олдсонгүй" гэсэн хариу өгдөг байсан нь энэ АРГ буруу байсны шалтгаан.

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: MONGOLBANK_HOST,
        path: `${MONGOLBANK_PATH}?startDate=${encodeURIComponent(weekAgo)}&endDate=${encodeURIComponent(today)}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': 0,
        },
        timeout: 10000,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            reject(new Error(`Монголбанкны хариу JSON биш байна (${res.statusCode}): ${raw.slice(0, 200)}`));
            return;
          }

          const rows = parsed?.data;
          if (res.statusCode >= 400 || !parsed?.success || !Array.isArray(rows) || rows.length === 0) {
            reject(new Error(`Монголбанкнаас ханшийн мэдээлэл ирсэнгүй (${res.statusCode})`));
            return;
          }

          const latest = rows[rows.length - 1];
          const rate = Number(String(latest.USD).replace(/,/g, ''));
          if (!Number.isFinite(rate) || rate <= 0) {
            reject(new Error(`Монголбанкны USD ханшийг задлахад алдаа гарлаа: ${latest.USD}`));
            return;
          }

          resolve({ rate, rateDate: latest.RATE_DATE });
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error('Монголбанк руу хийсэн хүсэлт хугацаа хэтэрлээ')));
    req.on('error', reject);
    req.end();
  });
}

// Монголбанкнаас өнөөдрийн (эсвэл хамгийн сүүлийн ажлын өдрийн) албан ёсны
// USD->MNT ханшийг автоматаар авна. Гараар тохируулах хувьсагч шаардахгүй.
export async function getUsdToMntRate() {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rate;
  }

  try {
    const { rate, rateDate } = await fetchLatestUsdRate();
    cache = { rate, rateDate, fetchedAt: now };
    return rate;
  } catch (err) {
    if (cache && now - cache.fetchedAt < STALE_FALLBACK_MS) {
      return cache.rate;
    }
    throw new Error(`Монголбанкнаас өдрийн USD ханш авч чадсангүй: ${err.message}`);
  }
}
