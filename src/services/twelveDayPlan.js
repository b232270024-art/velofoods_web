import { pool } from '../db/pool.js';

// 12 хоногийн планы "аль огноог зочинд харуулах вэ" тооцооллыг нэг газар
// төвлөрүүлнэ — GET /api/menu/plan-window (урьдчилан харуулах) болон
// POST /api/orders/plan (захиалга үүсгэх, клиентээс ирсэн огноог итгэмжлэхгүй
// серверт дахин тооцоолох) хоёулаа ижил дүрмээр ажиллах ёстой.
//
// Он-сар-өдрийг зөвхөн 'YYYY-MM-DD' string хэлбэрээр дамжуулж, Date.UTC-ээр
// тооцоолно — ингэснээр локал timezone-ийн урвуулалтгүйгээр цэвэр хуанлийн
// өдрийн арифметик хийгдэнэ. "Өнөөдөр" гэдгийг Asia/Ulaanbaatar-аар Postgres-с
// шууд асууна (бусад хэсэгт ч TZ тооцоог Postgres-д даатгадаг зуршилтай нийцнэ).

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function diffDays(fromStr, toStr) {
  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const [ty, tm, td] = toStr.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}

export async function getUbToday() {
  const { rows } = await pool.query(
    `SELECT to_char((now() AT TIME ZONE 'Asia/Ulaanbaatar')::date, 'YYYY-MM-DD') AS today`
  );
  return rows[0].today;
}

export async function getCycleDates() {
  const { rows } = await pool.query(
    `SELECT to_char(start_date, 'YYYY-MM-DD') AS start_date,
            to_char(end_date, 'YYYY-MM-DD') AS end_date
     FROM twelve_day_cycle_settings WHERE id = true`
  );
  if (rows.length === 0) throw new Error('Хоолны захиалгын эргэлт тохируулагдаагүй байна.');
  return { startDate: rows[0].start_date, endDate: rows[0].end_date };
}

// Backward compat alias
export async function getCycleStartDate() {
  const { startDate } = await getCycleDates();
  return startDate;
}

// { available, cycleStartDate, firstAvailableDate, endDate, dayCount }
// Дүрэм: захиалга өгсөн өдрөө зочин авч чадахгүй тул хамгийн эрт авах боломжтой
// огноо нь "маргааш" — гэхдээ эргэлт хараахан эхлээгүй бол эргэлтийн эхлэх
// огноогоор эхэлнэ (жишээ нь эргэлт 8.17-нд эхлэх бол 8.16-нд захиалсан зочин
// 8.17-оос буюу бүтэн 12 хоногийг авна).
export async function resolvePlanWindow() {
  const [today, { startDate: cycleStartDate, endDate }] = await Promise.all([getUbToday(), getCycleDates()]);
  const tomorrow = addDays(today, 1);
  const firstAvailableDate = tomorrow > cycleStartDate ? tomorrow : cycleStartDate;

  if (firstAvailableDate > endDate) {
    return { available: false, cycleStartDate, firstAvailableDate: null, endDate, dayCount: 0 };
  }
  const dayCount = diffDays(firstAvailableDate, endDate) + 1;
  return { available: true, cycleStartDate, firstAvailableDate, endDate, dayCount };
}

export function dateToDayNumber(dateStr, cycleStartDate) {
  return diffDays(cycleStartDate, dateStr) + 1;
}

export function enumerateDates(startDate, endDate) {
  const dates = [];
  let cur = startDate;
  while (cur <= endDate) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

export { addDays, diffDays };
