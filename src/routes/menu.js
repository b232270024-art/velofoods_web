import { Router } from 'express';
import { pool } from '../db/pool.js';
import { validateBody, createMenuItemSchema, updateMenuItemSchema } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { resolvePlanWindow, dateToDayNumber, enumerateDates } from '../services/twelveDayPlan.js';

export const menuRouter = Router();

// GET /api/menu/diet-types — бүх ангиллын жагсаалт.
// Анхаар: энэ route заавал бусад /:xxx маягийн route-ээс ӨМНӨ бичигдсэн байх
// ёстой — эс бөгөөс Express "diet-types"-г буруу параметр гэж андуурна.
menuRouter.get('/diet-types', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`SELECT id, name FROM diet_types ORDER BY name`);
  res.json(rows);
}));

// GET /api/menu/restaurants — dining outlet-уудын жагсаалт (Menu/Plan/Orders/
// Settings admin хуудсууд болон зочны ангилал сонгох дэлгэцэд ашиглана).
menuRouter.get('/restaurants', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.name, r.diet_type_id, dt.name AS diet_type_name, r.daily_order_limit
     FROM restaurants r
     LEFT JOIN diet_types dt ON dt.id = r.diet_type_id
     ORDER BY r.name`
  );
  res.json(rows);
}));

// GET /api/menu/plan — "12 хоногийн цэс" (admin-ийн тохируулсан өдөр тус
// бүрийн өглөө/өдөр/оройн хоол). Auth шаардахгүй — зочин 12-day план
// сонгохоосоо өмнө урьдчилан харах ёстой тул public.
// Optional query params: ?diet_type_id=...&restaurant_id=... — зочин сонгосон
// ангиллынхаа рестораны цэсийг л харахад ашиглана.
menuRouter.get('/plan', asyncHandler(async (req, res) => {
  const { diet_type_id, restaurant_id } = req.query;
  const params = [];
  let filter = '';
  if (diet_type_id) { params.push(diet_type_id); filter += ` AND mi.diet_type_id = $${params.length}`; }
  if (restaurant_id) { params.push(restaurant_id); filter += ` AND mi.restaurant_id = $${params.length}`; }

  const { rows } = await pool.query(
    `SELECT pi.id, pi.day_number, pi.meal_time, pi.menu_item_id, pi.sort_order,
            mi.name, mi.price_usd, mi.image_url, mi.allergens, mi.diet_type_id, mi.category, r.name AS restaurant_name
     FROM twelve_day_plan_items pi
     JOIN menu_items mi ON mi.id = pi.menu_item_id
     JOIN restaurants r ON r.id = mi.restaurant_id
     WHERE true ${filter}
     ORDER BY pi.day_number, pi.meal_time, pi.sort_order`,
    params
  );
  res.json(rows);
}));

// GET /api/menu/plan-cycle — идэвхтэй хоолны захиалгын эргэлтийн эхлэх/дуусах огноо.
// Auth шаардахгүй — зочны PlanPreview болон admin Тохиргоо хуудас хоёулаа ашиглана.
menuRouter.get('/plan-cycle', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT to_char(start_date, 'YYYY-MM-DD') AS start_date,
            to_char(end_date, 'YYYY-MM-DD') AS end_date
     FROM twelve_day_cycle_settings WHERE id = true`
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Хоолны захиалгын эргэлт тохируулагдаагүй байна.' });
  res.json(rows[0]);
}));

// GET /api/menu/plan-window?diet_type_id=... — зочинд ХАРАГДАХ бодит огнооны
// цонх (өнөөдрөөс хамааран 12-аас цөөн байж болно, "1 хоногийн өмнө захиалах"
// дүрмийн дагуу) + өдөр/цаг слот бүрд admin-ийн тохируулсан АНГИЛАЛ тус
// бүрийн ≤3 сонголт (`meals.morning = { "Main Course": [...], "Soup": [...] }`
// гэх мэт — ямар ч тооны ангилал зэрэгцэн орж болно). Auth шаардахгүй —
// session үүсэхээс ӨМНӨ зочин планаа урьдчилан харах ёстой.
menuRouter.get('/plan-window', asyncHandler(async (req, res) => {
  const { diet_type_id } = req.query;
  const window = await resolvePlanWindow();

  if (!window.available) {
    return res.json({ available: false, start_date: null, end_date: window.endDate, day_count: 0, days: [] });
  }

  const dates = enumerateDates(window.firstAvailableDate, window.endDate);
  const dayNumbers = dates.map(d => dateToDayNumber(d, window.cycleStartDate));

  const params = [dayNumbers];
  let filter = '';
  if (diet_type_id) { params.push(diet_type_id); filter = ` AND mi.diet_type_id = $2`; }

  const { rows } = await pool.query(
    `SELECT pi.day_number, pi.meal_time, pi.sort_order, mi.id AS menu_item_id,
            mi.name, mi.description, mi.price_usd, mi.image_url, mi.allergens,
            COALESCE(mi.category, '') AS category
     FROM twelve_day_plan_items pi
     JOIN menu_items mi ON mi.id = pi.menu_item_id
     WHERE pi.day_number = ANY($1::int[]) AND mi.is_deleted = false ${filter}
     ORDER BY pi.day_number, pi.meal_time, mi.category, pi.sort_order`,
    params
  );

  const dayNumberToDate = Object.fromEntries(dates.map((d, i) => [dayNumbers[i], d]));
  const days = dates.map(date => ({ date, meals: { morning: {}, lunch: {}, evening: {} } }));
  const dayByDate = Object.fromEntries(days.map(d => [d.date, d]));

  for (const row of rows) {
    const date = dayNumberToDate[row.day_number];
    if (!date) continue;
    const mealGroup = dayByDate[date].meals[row.meal_time];
    if (!mealGroup[row.category]) mealGroup[row.category] = [];
    mealGroup[row.category].push({
      menu_item_id: row.menu_item_id,
      name: row.name,
      description: row.description,
      price_usd: row.price_usd,
      image_url: row.image_url,
      allergens: row.allergens,
      sort_order: row.sort_order,
    });
  }

  res.json({
    available: true,
    start_date: window.firstAvailableDate,
    end_date: window.endDate,
    day_count: window.dayCount,
    days,
  });
}));

// GET /api/menu — fetch menu items.
// Optional query params: ?diet_type_id=...&category=Main+Course&restaurant_id=...
// ?all=true includes items marked unavailable (used by the admin dashboard) —
// soft-deleted items are still excluded either way. In admin (?all=true) mode we
// also attach sold_today — Ази/Улаанбаатарын өнөөдрийн (00:00-оос хойших)
// зарагдсан тоо — stock_limit-тэй хамт "X/Y өнөөдөр" харуулахад ашиглана.
menuRouter.get('/', asyncHandler(async (req, res) => {
  const { diet_type_id, category, restaurant_id, all } = req.query;

  const soldTodayExpr = all === 'true'
    ? `, COALESCE((
         SELECT SUM(oi.quantity) FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE oi.menu_item_id = mi.id
           AND o.status != 'cancelled'
           AND (o.created_at AT TIME ZONE 'Asia/Ulaanbaatar')::date = (now() AT TIME ZONE 'Asia/Ulaanbaatar')::date
       ), 0) AS sold_today`
    : '';

  let query = `
    SELECT mi.id, mi.name, mi.description, mi.category,
           mi.diet_type_id, dt.name AS diet_type_name,
           mi.price_usd, mi.image_url, mi.calories, mi.allergens,
           mi.prep_time_min, mi.is_featured, mi.is_addon_recommended, mi.available,
           mi.restaurant_id, mi.stock_limit, r.name AS restaurant_name
           ${soldTodayExpr}
    FROM menu_items mi
    JOIN restaurants r ON r.id = mi.restaurant_id
    JOIN diet_types dt ON dt.id = mi.diet_type_id
    WHERE mi.is_deleted = false
  `;
  const params = [];

  if (all !== 'true') {
    query += ` AND mi.available = true`;
  }

  if (diet_type_id) {
    params.push(diet_type_id);
    query += ` AND mi.diet_type_id = $${params.length}`;
  }

  if (category) {
    params.push(category);
    query += ` AND mi.category = $${params.length}`;
  }

  if (restaurant_id) {
    params.push(restaurant_id);
    query += ` AND mi.restaurant_id = $${params.length}`;
  }

  query += ` ORDER BY mi.is_featured DESC, mi.category, mi.name`;

  const { rows } = await pool.query(query, params);
  res.json(rows);
}));

// DELETE /api/menu/item/:id — soft delete
menuRouter.delete('/item/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE menu_items SET is_deleted = true, available = false WHERE id = $1 RETURNING id',
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Menu item not found.' });
  res.json({ deleted: true, id: rows[0].id });
}));

// POST /api/menu — add a new menu item (admin)
menuRouter.post('/', requireAdmin, validateBody(createMenuItemSchema), asyncHandler(async (req, res) => {
  const { name, description, category, diet_type_id, price_usd, image_url, calories, allergens, prep_time_min, is_featured, is_addon_recommended, restaurant_id, stock_limit } = req.body;

  const restaurant = await pool.query(
    'SELECT id, diet_type_id FROM restaurants WHERE id = $1',
    [restaurant_id]
  );
  if (restaurant.rows.length === 0) {
    return res.status(400).json({ error: 'Сонгосон ресторан олдсонгүй.' });
  }
  const restaurantDietTypeId = restaurant.rows[0].diet_type_id;
  if (restaurantDietTypeId && restaurantDietTypeId !== diet_type_id) {
    return res.status(400).json({ error: 'Сонгосон ресторан зөвхөн өөрийн ангиллын хоол хадгалж болно.' });
  }

  const dietType = await pool.query('SELECT id FROM diet_types WHERE id = $1', [diet_type_id]);
  if (dietType.rows.length === 0) {
    return res.status(400).json({ error: 'Сонгосон ангилал олдсонгүй.' });
  }

  const { rows } = await pool.query(
    `INSERT INTO menu_items
       (name, description, category, diet_type_id, price_usd, image_url, calories, allergens, prep_time_min, is_featured, is_addon_recommended, restaurant_id, stock_limit)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      name,
      description ?? null,
      category ?? null,
      diet_type_id,
      price_usd,
      image_url ?? null,
      calories ?? null,
      allergens ?? [],
      prep_time_min ?? 15,
      is_featured ?? false,
      is_addon_recommended ?? false,
      restaurant_id,
      stock_limit ?? null,
    ]
  );
  res.status(201).json(rows[0]);
}));

// PATCH /api/menu/item/:id — update a menu item (image_url, price, availability, etc.)
menuRouter.patch('/item/:id', requireAdmin, validateBody(updateMenuItemSchema), asyncHandler(async (req, res) => {
  const { name, description, category, diet_type_id, price_usd, image_url, calories, allergens, prep_time_min, is_featured, is_addon_recommended, available, restaurant_id, stock_limit } = req.body;

  // Ресторан/ангилал 1:1 lock-ийг зөвхөн эдгээр 2 талбарын аль нэгийг нь
  // бодитоор өөрчлөх гэж байгаа үед л шалгана — жишээ нь зөвхөн `available`-г
  // солих (PATCH { available }) хуучин зөрчилтэй item дээр ч гэсэн ажиллах ёстой.
  if (Object.prototype.hasOwnProperty.call(req.body, 'restaurant_id') ||
      Object.prototype.hasOwnProperty.call(req.body, 'diet_type_id')) {
    const current = await pool.query(
      'SELECT restaurant_id, diet_type_id FROM menu_items WHERE id = $1',
      [req.params.id]
    );
    if (current.rows.length === 0) return res.status(404).json({ error: 'Menu item not found.' });

    const effectiveRestaurantId = restaurant_id ?? current.rows[0].restaurant_id;
    const effectiveDietTypeId = diet_type_id ?? current.rows[0].diet_type_id;

    const restaurant = await pool.query(
      'SELECT id, diet_type_id FROM restaurants WHERE id = $1',
      [effectiveRestaurantId]
    );
    if (restaurant.rows.length === 0) {
      return res.status(400).json({ error: 'Сонгосон ресторан олдсонгүй.' });
    }
    if (restaurant.rows[0].diet_type_id && restaurant.rows[0].diet_type_id !== effectiveDietTypeId) {
      return res.status(400).json({ error: 'Сонгосон ресторан зөвхөн өөрийн ангиллын хоол хадгалж болно.' });
    }
  }

  if (diet_type_id) {
    const dietType = await pool.query('SELECT id FROM diet_types WHERE id = $1', [diet_type_id]);
    if (dietType.rows.length === 0) {
      return res.status(400).json({ error: 'Сонгосон ангилал олдсонгүй.' });
    }
  }

  const { rows } = await pool.query(
    `UPDATE menu_items SET
      name          = COALESCE($1, name),
      description   = COALESCE($2, description),
      category      = COALESCE($3, category),
      diet_type_id  = COALESCE($4, diet_type_id),
      price_usd     = COALESCE($5, price_usd),
      image_url     = COALESCE($6, image_url),
      calories      = COALESCE($7, calories),
      allergens     = COALESCE($8, allergens),
      prep_time_min = COALESCE($9, prep_time_min),
      is_featured   = COALESCE($10, is_featured),
      is_addon_recommended = COALESCE($11, is_addon_recommended),
      available     = COALESCE($12, available),
      restaurant_id = COALESCE($13, restaurant_id),
      stock_limit   = CASE WHEN $14::boolean THEN $15 ELSE stock_limit END
    WHERE id = $16 AND is_deleted = false
    RETURNING *`,
    [
      name, description, category, diet_type_id, price_usd, image_url, calories,
      allergens, prep_time_min, is_featured, is_addon_recommended, available, restaurant_id,
      Object.prototype.hasOwnProperty.call(req.body, 'stock_limit'), stock_limit,
      req.params.id,
    ]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Menu item not found.' });
  res.json(rows[0]);
}));
