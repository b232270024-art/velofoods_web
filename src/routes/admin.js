import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { validateBody, updateOrderStatusSchema, adminLoginSchema, updateRestaurantSchema, createRestaurantSchema, dietTypeNameSchema, createPlanItemSchema, updatePlanCycleSchema, chatMessageSchema } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';

export const adminRouter = Router();

const ADMIN_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 12 * 60 * 60 * 1000,
};

// /dashboard-ын нэвтрэх хэсгээс дуудагдана
adminRouter.post('/login', loginLimiter, validateBody(adminLoginSchema), asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const hash = process.env.ADMIN_PASSWORD_HASH || '';

  const validUsername = Boolean(process.env.ADMIN_USERNAME) && username === process.env.ADMIN_USERNAME;
  const validPassword = hash ? await bcrypt.compare(password, hash) : false;

  if (!validUsername || !validPassword) {
    return res.status(401).json({ error: 'Нэвтрэх нэр эсвэл нууц үг буруу байна.' });
  }

  const token = jwt.sign({ role: 'admin', username }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.cookie('admin_token', token, ADMIN_COOKIE_OPTS);
  res.json({ ok: true, username });
}));

adminRouter.post('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

// Dashboard ачаалагдахад одоогийн cookie хүчинтэй эсэхийг шалгахад ашиглана
adminRouter.get('/me', (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ authenticated: false });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('not an admin token');
    res.json({ authenticated: true, username: payload.username });
  } catch {
    res.status(401).json({ authenticated: false });
  }
});

// Доорх бүх route админ session шаардана
adminRouter.use(requireAdmin);

// Зургийн upload нь тусдаа /api/upload router-т байгаа (src/routes/upload.js).

// --- Ресторан нэмэх / нэр солих / ангилал оноох (Settings) -----------------
adminRouter.post('/restaurants', validateBody(createRestaurantSchema), asyncHandler(async (req, res) => {
  const { name, daily_order_limit } = req.body;
  try {
    // daily_order_limit өгөөгүй бол шинэ ресторан 100 захиалгын анхны хамгаалалттай
    // үүснэ — админ дараа нь Тохиргоо хуудаснаас өөрчилж/арилгаж (хязгааргүй) болно.
    const { rows } = await pool.query(
      'INSERT INTO restaurants (name, daily_order_limit) VALUES ($1, $2) RETURNING *',
      [name, daily_order_limit ?? 100]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Энэ нэртэй ресторан аль хэдийн байна.' });
    throw err;
  }
}));

adminRouter.patch('/restaurants/:id', validateBody(updateRestaurantSchema), asyncHandler(async (req, res) => {
  const { name, diet_type_id, daily_order_limit } = req.body;
  const hasDietTypeField = Object.prototype.hasOwnProperty.call(req.body, 'diet_type_id');
  const hasLimitField = Object.prototype.hasOwnProperty.call(req.body, 'daily_order_limit');

  if (diet_type_id) {
    const dt = await pool.query('SELECT id FROM diet_types WHERE id = $1', [diet_type_id]);
    if (dt.rows.length === 0) return res.status(400).json({ error: 'Сонгосон ангилал олдсонгүй.' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE restaurants SET
         name = COALESCE($1, name),
         diet_type_id = CASE WHEN $2::boolean THEN $3 ELSE diet_type_id END,
         daily_order_limit = CASE WHEN $5::boolean THEN $6 ELSE daily_order_limit END
       WHERE id = $4 RETURNING *`,
      [name ?? null, hasDietTypeField, diet_type_id ?? null, req.params.id, hasLimitField, daily_order_limit ?? null]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ресторан олдсонгүй.' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Энэ ангиллыг өөр ресторан аль хэдийн ашиглаж байна (эсвэл энэ нэртэй ресторан аль хэдийн бий).' });
    }
    throw err;
  }
}));

// --- Ангилал (diet type) нэмэх / нэр солих / устгах (Settings) -------------
adminRouter.post('/diet-types', validateBody(dietTypeNameSchema), asyncHandler(async (req, res) => {
  try {
    const { rows } = await pool.query(
      'INSERT INTO diet_types (name) VALUES ($1) RETURNING *',
      [req.body.name]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Энэ нэртэй ангилал аль хэдийн байна.' });
    throw err;
  }
}));

adminRouter.patch('/diet-types/:id', validateBody(dietTypeNameSchema), asyncHandler(async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE diet_types SET name = $1 WHERE id = $2 RETURNING *',
      [req.body.name, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ангилал олдсонгүй.' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Энэ нэртэй ангилал аль хэдийн байна.' });
    throw err;
  }
}));

adminRouter.delete('/diet-types/:id', asyncHandler(async (req, res) => {
  const inUse = await pool.query('SELECT count(*)::int AS n FROM menu_items WHERE diet_type_id = $1', [req.params.id]);
  if (inUse.rows[0].n > 0) {
    return res.status(400).json({ error: `Энэ ангилалыг ${inUse.rows[0].n} хоол ашиглаж байгаа тул устгах боломжгүй. Эхлээд тэдгээр хоолны ангиллыг өөрчилнө үү.` });
  }
  const { rows } = await pool.query('DELETE FROM diet_types WHERE id = $1 RETURNING id', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Ангилал олдсонгүй.' });
  res.json({ deleted: true, id: rows[0].id });
}));

// --- Dashboard-ийн үзүүлэлт (нийт хоол, захиалга, орлого, сүүлийн захиалгууд) ---
adminRouter.get('/stats', asyncHandler(async (req, res) => {
  const [menuCount, orderStats, recent] = await Promise.all([
    pool.query(`SELECT count(*)::int AS n FROM menu_items WHERE is_deleted = false`),
    pool.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status = 'paid')::int AS paid,
              COALESCE(SUM(total_usd) FILTER (WHERE status = 'paid'), 0) AS revenue
       FROM orders`
    ),
    pool.query(
      `SELECT o.id, o.status, o.total_usd, o.created_at,
              s.guest_name, s.room_number, s.hotel_name, s.delivery_address
       FROM orders o
       JOIN sessions s ON s.id = o.session_id
       ORDER BY o.created_at DESC LIMIT 8`
    ),
  ]);

  res.json({
    menuItemCount: menuCount.rows[0].n,
    totalOrders: orderStats.rows[0].total,
    paidOrders: orderStats.rows[0].paid,
    totalRevenue: Number(orderStats.rows[0].revenue),
    recentOrders: recent.rows,
  });
}));

// --- Захиалгууд (бүх статус, item/ресторан/хүргэлт/харшлын дэлгэрэнгүйтэй) ---
// ?status=paid гэх мэт filter дэмжинэ. Хамгийн сүүлийн 200-г буцаана.
adminRouter.get('/orders', asyncHandler(async (req, res) => {
  const params = [];
  let statusFilter = '';
  if (req.query.status) {
    params.push(req.query.status);
    statusFilter = ` AND o.status = $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT o.id, o.order_number, o.status, o.total_usd, o.created_at,
            o.plan_start_date, o.plan_end_date, o.plan_day_count,
            s.guest_name, s.room_number, s.hotel_name, s.delivery_address, s.delivery_type,
            s.order_type, s.diet_type_id, s.allergy_tags, s.allergy_other,
            (SELECT json_agg(json_build_object(
               'menu_item_id', oi.menu_item_id,
               'quantity', oi.quantity,
               'unit_price_usd', oi.unit_price_usd,
               'name', mi.name,
               'restaurant_name', r.name,
               'allergens', mi.allergens,
               'plan_date', oi.plan_date,
               'plan_meal_time', oi.plan_meal_time,
               'is_addon', oi.is_addon
             ) ORDER BY oi.plan_date NULLS LAST, oi.plan_meal_time)
             FROM order_items oi
             JOIN menu_items mi ON mi.id = oi.menu_item_id
             JOIN restaurants r ON r.id = mi.restaurant_id
             WHERE oi.order_id = o.id) AS items,
            (SELECT p.status FROM payments p WHERE p.order_id = o.id ORDER BY p.paid_at DESC NULLS LAST LIMIT 1) AS payment_status,
            (SELECT p.paid_at FROM payments p WHERE p.order_id = o.id ORDER BY p.paid_at DESC NULLS LAST LIMIT 1) AS paid_at
     FROM orders o
     JOIN sessions s ON s.id = o.session_id
     WHERE true ${statusFilter}
     ORDER BY o.created_at DESC
     LIMIT 200`,
    params
  );
  res.json(rows);
}));

// --- 12 хоногийн зочид (order_type='twelve_day' session-үүд, харшлын
// мэдээлэлтэй) — эдгээр зочид orders мөр огт үүсгэдэггүй тул дээрх
// /orders endpoint-д хэзээ ч харагдахгүй, тиймээс тусдаа route хэрэгтэй.
adminRouter.get('/sessions', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.guest_name, s.room_number, s.hotel_name, s.diet_type_id, dt.name AS diet_type_name,
            s.allergy_tags, s.allergy_other, s.created_at
     FROM sessions s
     LEFT JOIN diet_types dt ON dt.id = s.diet_type_id
     WHERE s.order_type = 'twelve_day'
     ORDER BY s.created_at DESC
     LIMIT 200`
  );
  res.json(rows);
}));

// --- 12 хоногийн цэс (admin-ийн удирддаг өдөр тус бүрийн хоол) -----------
// Flat list буцаана — frontend талдаа өдөр/цагаар нь ангилна.
// Optional query params: ?diet_type_id=...&restaurant_id=... — PlanManager
// сонгосон рестораныхаа цэсийг л татахад ашиглана.
adminRouter.get('/plan', asyncHandler(async (req, res) => {
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

// Тухайн (өдөр, цаг, АНГИЛАЛ)-т menu item нэмнэ. Нэг өдөр/цагт хэд ч ангиллын
// хоол зэрэгцэн орж болно (жишээ нь Main Course + Soup + Snack) — ангилал
// бүр дотроо дээд тал нь 3 хоол (1 үндсэн + 2 нөөц, sort_order 0/1/2), зочин
// эдгээрийн дундаас л сольж болно. Ангилал нь menu_items.category-гаар
// тодорхойлогддог тул admin тусад нь сонгох шаардлагагүй — ямар хоол
// сонгосноос нь автоматаар тодорхойлогдоно. Аль хэдийн нэмэгдсэн бол дахин
// давхардуулахгүй (UNIQUE constraint).
adminRouter.post('/plan-items', validateBody(createPlanItemSchema), asyncHandler(async (req, res) => {
  const { day_number, meal_time, menu_item_id } = req.body;

  const menuItem = await pool.query(
    'SELECT id, restaurant_id, category FROM menu_items WHERE id = $1 AND is_deleted = false',
    [menu_item_id]
  );
  if (menuItem.rows.length === 0) {
    return res.status(400).json({ error: 'Сонгосон хоол олдсонгүй.' });
  }
  const { restaurant_id, category } = menuItem.rows[0];

  const existing = await pool.query(
    `SELECT count(*)::int AS n FROM twelve_day_plan_items pi
     JOIN menu_items mi ON mi.id = pi.menu_item_id
     WHERE pi.day_number = $1 AND pi.meal_time = $2 AND mi.restaurant_id = $3
       AND COALESCE(mi.category, '') = COALESCE($4, '')`,
    [day_number, meal_time, restaurant_id, category]
  );
  const slotCount = existing.rows[0].n;
  if (slotCount >= 3) {
    return res.status(400).json({ error: `"${category || 'Бусад'}" ангилалд энэ цаг дээр 3-аас дээш хоол зөвшөөрөгдөхгүй (1 үндсэн + 2 нөөц).` });
  }

  const { rows } = await pool.query(
    `INSERT INTO twelve_day_plan_items (day_number, meal_time, menu_item_id, sort_order)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (day_number, meal_time, menu_item_id) DO NOTHING
     RETURNING *`,
    [day_number, meal_time, menu_item_id, slotCount]
  );
  res.status(201).json(rows[0] ?? { alreadyExists: true });
}));

// Slot-с хоол хасна, дараа нь тухайн АНГИЛЛЫН үлдсэн зүйлсийг sort_order-оор
// дахин 0..n-1 болгож дараалуулна — "үндсэн" сонголт (sort_order=0) үргэлж
// тодорхой байна (бусад ангиллын дараалалд нөлөөлөхгүй).
adminRouter.delete('/plan-items/:id', asyncHandler(async (req, res) => {
  const deleted = await pool.query(
    'DELETE FROM twelve_day_plan_items WHERE id = $1 RETURNING day_number, meal_time, menu_item_id',
    [req.params.id]
  );
  if (deleted.rows.length === 0) return res.status(404).json({ error: 'Олдсонгүй.' });
  const { day_number, meal_time } = deleted.rows[0];

  const menuItem = await pool.query('SELECT restaurant_id, category FROM menu_items WHERE id = $1', [deleted.rows[0].menu_item_id]);
  const restaurantId = menuItem.rows[0]?.restaurant_id;
  const category = menuItem.rows[0]?.category;
  if (restaurantId) {
    const remaining = await pool.query(
      `SELECT pi.id FROM twelve_day_plan_items pi
       JOIN menu_items mi ON mi.id = pi.menu_item_id
       WHERE pi.day_number = $1 AND pi.meal_time = $2 AND mi.restaurant_id = $3
         AND COALESCE(mi.category, '') = COALESCE($4, '')
       ORDER BY pi.sort_order`,
      [day_number, meal_time, restaurantId, category]
    );
    for (let i = 0; i < remaining.rows.length; i++) {
      await pool.query('UPDATE twelve_day_plan_items SET sort_order = $1 WHERE id = $2', [i, remaining.rows[i].id]);
    }
  }

  res.json({ deleted: true, id: req.params.id });
}));

// --- Хоолны захиалгын идэвхтэй эргэлт (Тохиргоо хуудаснаас өөрчилнө) -----------
adminRouter.get('/plan-cycle', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT to_char(start_date, 'YYYY-MM-DD') AS start_date,
            to_char(end_date, 'YYYY-MM-DD') AS end_date
     FROM twelve_day_cycle_settings WHERE id = true`
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Хоолны захиалгын эргэлт тохируулагдаагүй байна.' });
  res.json(rows[0]);
}));

adminRouter.patch('/plan-cycle', validateBody(updatePlanCycleSchema), asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.body;
  const { rows } = await pool.query(
    `UPDATE twelve_day_cycle_settings SET start_date = $1, end_date = $2, updated_at = now() WHERE id = true
     RETURNING to_char(start_date, 'YYYY-MM-DD') AS start_date,
               to_char(end_date, 'YYYY-MM-DD') AS end_date`,
    [start_date, end_date]
  );
  res.json(rows[0]);
}));

// Ажилтан захиалгын статус солих — зөвхөн cancelled/refunded (updateOrderStatusSchema
// 'paid'-г зөвшөөрдөггүй). 'paid' статус зөвхөн settleHipayCheckout-оор
// (src/routes/payments.js), Hipay-аас баталгаажсаны дараа л тавигдана.
adminRouter.patch('/orders/:id/status', validateBody(updateOrderStatusSchema), asyncHandler(async (req, res) => {
  const { status } = req.body;
  const { rows } = await pool.query(
    'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Захиалга олдсонгүй.' });

  const io = req.app.get('io');
  io.to('admin').emit('order:updated', rows[0]);

  res.json(rows[0]);
}));

// --- Зочин ↔ админ чат (src/routes/chat.js-ийн admin тал) -----------------
// Зочин талд requireSession/order эзэмшлийн шалгалт байхгүй (order_id өөрөө
// түлхүүр) тул эндээс ч бид зөвхөн order_id-аар нэгтгэж харуулна.

// Захиалга тус бүрийн сүүлийн мессеж + уншаагүй тооноор эрэмбэлсэн жагсаалт.
adminRouter.get('/chat/threads', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT cm.order_id,
            o.order_number, o.status AS order_status, o.total_usd,
            s.guest_name,
            last_msg.message AS last_message,
            last_msg.sender AS last_sender,
            last_msg.created_at AS last_message_at,
            COALESCE(unread.n, 0)::int AS unread_count
     FROM (SELECT DISTINCT order_id FROM chat_messages) cm
     JOIN orders o ON o.id = cm.order_id
     JOIN sessions s ON s.id = o.session_id
     JOIN LATERAL (
       SELECT message, sender, created_at FROM chat_messages
       WHERE order_id = cm.order_id ORDER BY created_at DESC LIMIT 1
     ) last_msg ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS n FROM chat_messages
       WHERE order_id = cm.order_id AND sender = 'guest' AND read_by_admin = false
     ) unread ON true
     ORDER BY last_msg.created_at DESC
     LIMIT 200`
  );
  res.json(rows);
}));

// Тухайн захиалгын бүх мессеж + захиалгын дэлгэрэнгүй — уншсанд тооцож
// (read_by_admin=true) тэмдэглэнэ.
adminRouter.get('/chat/:orderId/messages', asyncHandler(async (req, res) => {
  const order = await pool.query(
    `SELECT o.id, o.order_number, o.status, o.total_usd, o.created_at, s.guest_name, s.room_number, s.hotel_name
     FROM orders o JOIN sessions s ON s.id = o.session_id WHERE o.id = $1`,
    [req.params.orderId]
  );
  if (order.rows.length === 0) return res.status(404).json({ error: 'Захиалга олдсонгүй.' });

  const messages = await pool.query(
    'SELECT id, sender, message, created_at FROM chat_messages WHERE order_id = $1 ORDER BY created_at ASC',
    [req.params.orderId]
  );
  await pool.query(
    `UPDATE chat_messages SET read_by_admin = true WHERE order_id = $1 AND sender = 'guest' AND read_by_admin = false`,
    [req.params.orderId]
  );

  res.json({ order: order.rows[0], messages: messages.rows });
}));

adminRouter.post('/chat/:orderId/messages', validateBody(chatMessageSchema), asyncHandler(async (req, res) => {
  const order = await pool.query('SELECT id FROM orders WHERE id = $1', [req.params.orderId]);
  if (order.rows.length === 0) return res.status(404).json({ error: 'Захиалга олдсонгүй.' });

  const { message } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO chat_messages (order_id, sender, message)
     VALUES ($1, 'admin', $2) RETURNING id, order_id, sender, message, created_at`,
    [req.params.orderId, message]
  );
  const row = rows[0];

  const io = req.app.get('io');
  io.to(`chat:${req.params.orderId}`).emit('chat:message', row);
  io.to('admin').emit('chat:message', row);

  res.status(201).json(row);
}));
