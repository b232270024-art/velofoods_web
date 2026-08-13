import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireSession } from '../middleware/auth.js';
import { validateBody, createOrderSchema, createPlanOrderSchema } from '../middleware/validation.js';
import { resolvePlanWindow, dateToDayNumber, enumerateDates, diffDays } from '../services/twelveDayPlan.js';
import { generateOrderNumber } from '../services/orderNumber.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const ordersRouter = Router();

// order_number давхцах магадлал бараг байхгүй ч (852 тэрбум хослол) DB-ийн
// UNIQUE constraint дээр найдаж, зөрчил гарвал SAVEPOINT-руу буцаад шинэ
// кодоор дахин оролдоно. insertFn(orderNumber) нь тухайн INSERT query-г
// гүйцэтгэнэ.
async function insertOrder(client, insertFn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const orderNumber = generateOrderNumber();
    await client.query('SAVEPOINT order_insert');
    try {
      const result = await insertFn(orderNumber);
      await client.query('RELEASE SAVEPOINT order_insert');
      return result;
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT order_insert');
      if (err.code !== '23505') throw err;
    }
  }
  throw new Error('Захиалгын дугаар үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.');
}

// items: [{ menu_item_id, quantity, guest_name }]
ordersRouter.post('/', requireSession, validateBody(createOrderSchema), asyncHandler(async (req, res) => {
  const { items } = req.body;
  const { session_id } = req.session;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const order = await insertOrder(client, (orderNumber) => client.query(
      `INSERT INTO orders (session_id, status, total_usd, order_number)
       VALUES ($1, 'pending', 0, $2) RETURNING *`,
      [session_id, orderNumber]
    ));
    const orderId = order.rows[0].id;

    let total = 0;
    const restaurantIds = new Set();
    for (const item of items) {
      // FOR UPDATE энэ menu_item мөрийг захиалга дуустал түгжинэ — зэрэгцээ
      // ирсэн захиалгууд ижил item дээр дараалан биелэх тул stock_limit
      // хэтэрч overselling болохоос сэргийлнэ.
      const menuItem = await client.query(
        'SELECT name, price_usd, stock_limit, restaurant_id FROM menu_items WHERE id = $1 FOR UPDATE',
        [item.menu_item_id]
      );
      if (menuItem.rows.length === 0) {
        throw new Error(`Menu item олдсонгүй: ${item.menu_item_id}`);
      }

      const { name, price_usd, stock_limit, restaurant_id } = menuItem.rows[0];
      restaurantIds.add(restaurant_id);

      if (stock_limit !== null) {
        // stock_limit нь өдөр бүр 0-ээс дахин эхэлдэг лимит — тул зогсоохгүйгээр
        // тухайн item-ийн "Ази/Улаанбаатарын өнөөдөр" аль хэдийн зарагдсан нийт
        // тоог тооцоод шинэ захиалгатай нийлбэрлэж лимиттэй харьцуулна.
        const soldToday = await client.query(
          `SELECT COALESCE(SUM(oi.quantity), 0)::int AS sold FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE oi.menu_item_id = $1
             AND o.status != 'cancelled'
             AND (o.created_at AT TIME ZONE 'Asia/Ulaanbaatar')::date = (now() AT TIME ZONE 'Asia/Ulaanbaatar')::date`,
          [item.menu_item_id]
        );
        const alreadySold = soldToday.rows[0].sold;
        if (alreadySold + item.quantity > stock_limit) {
          const remaining = Math.max(0, stock_limit - alreadySold);
          throw new Error(`"${name}" өнөөдрийн лимит хүрэлцэхгүй байна (үлдсэн: ${remaining}).`);
        }
      }

      const unitPrice = Number(price_usd);
      total += unitPrice * item.quantity;

      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, guest_name, quantity, unit_price_usd)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.menu_item_id, item.guest_name || 'Guest', item.quantity, unitPrice]
      );
    }

    // Ресторан тус бүрийн ӨДРИЙН ЗАХИАЛГЫН ЛИМИТ — menu item-ийн stock_limit-ээс
    // ялгаатай нь тухайн рестораны нийт хэдэн ЗАХИАЛГА (order) авахыг хязгаарлана.
    // FOR UPDATE-ээр restaurants мөрийг түгжиж, ижил рестораны зэрэгцээ
    // захиалгуудыг дараалуулснаар лимит хэтэрч overselling болохоос сэргийлнэ.
    for (const restaurantId of restaurantIds) {
      const restaurant = await client.query(
        'SELECT name, daily_order_limit FROM restaurants WHERE id = $1 FOR UPDATE',
        [restaurantId]
      );
      const { name: restaurantName, daily_order_limit } = restaurant.rows[0];

      if (daily_order_limit !== null) {
        const ordersToday = await client.query(
          `SELECT COUNT(DISTINCT o.id)::int AS n
           FROM orders o
           JOIN order_items oi ON oi.order_id = o.id
           JOIN menu_items mi ON mi.id = oi.menu_item_id
           WHERE mi.restaurant_id = $1
             AND o.id != $2
             AND o.status != 'cancelled'
             AND (o.created_at AT TIME ZONE 'Asia/Ulaanbaatar')::date = (now() AT TIME ZONE 'Asia/Ulaanbaatar')::date`,
          [restaurantId, orderId]
        );
        if (ordersToday.rows[0].n >= daily_order_limit) {
          throw new Error(`"${restaurantName}"-ийн өнөөдрийн авах захиалга дүүрсэн байна. Та маргааш захиалга өгнө үү.`);
        }
      }
    }

    await client.query('UPDATE orders SET total_usd = $1 WHERE id = $2', [total, orderId]);
    await client.query('COMMIT');

    const fullOrder = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);

    // Admin дашбоард руу realtime мэдэгдэл
    const io = req.app.get('io');
    io.to('admin').emit('order:new', fullOrder.rows[0]);

    res.status(201).json(fullOrder.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    req.app.get('logger').error('Захиалга үүсгэхэд алдаа гарлаа', { error: err.message });
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
}));

// 12 хоногийн зочны сонголтуудаас (болон сонголт бол 1 нэмэлт зүйлээс) захиалга
// үүсгэнэ. Үнэ болон сонголтын хүчинтэй эсэхийг бүхэлд нь СЕРВЕРТ дахин
// тооцоолж баталгаажуулна — клиентээс ирсэн юуг ч (огноо, үнэ) итгэмжлэхгүй.
ordersRouter.post('/plan', requireSession, validateBody(createPlanOrderSchema), asyncHandler(async (req, res) => {
  const { selections, addon_menu_item_id } = req.body;
  const { session_id } = req.session;

  const sessionRes = await pool.query(
    'SELECT id, guest_name, order_type, diet_type_id FROM sessions WHERE id = $1',
    [session_id]
  );
  if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Session олдсонгүй.' });
  const session = sessionRes.rows[0];
  if (session.order_type !== 'twelve_day') {
    return res.status(400).json({ error: 'Энэ session 12 хоногийн төрлийн захиалгад зориулагдаагүй байна.' });
  }
  if (!session.diet_type_id) {
    return res.status(400).json({ error: 'Session дээр ангилал сонгогдоогүй байна.' });
  }

  const window = await resolvePlanWindow();
  if (!window.available) {
    return res.status(400).json({ error: 'Одоогоор идэвхтэй 12 хоногийн эргэлт байхгүй байна.' });
  }

  const uniqueDates = [...new Set(selections.map(s => s.plan_date))].sort();
  if (uniqueDates.length === 0) {
    return res.status(400).json({ error: 'Сонголт олдсонгүй.' });
  }
  const startDateStr = uniqueDates[0];
  const endDateStr = uniqueDates[uniqueDates.length - 1];
  
  if (startDateStr < window.firstAvailableDate) {
    return res.status(400).json({ error: 'Захиалга хийх хамгийн эрт боломжтой огнооноос өмнө байна.' });
  }

  if (diffDays(startDateStr, endDateStr) > 60) {
    return res.status(400).json({ error: 'Захиалгын үргэлжлэх хугацаа хэт урт байна (дээд тал нь 60 өдөр).' });
  }

  // Get max day number from DB for this diet type to know how to modulo
  const maxDayRes = await pool.query(
    `SELECT COALESCE(MAX(day_number), 0)::int as max_day 
     FROM twelve_day_plan_items pi
     JOIN menu_items mi ON mi.id = pi.menu_item_id
     WHERE mi.diet_type_id = $1 AND mi.is_deleted = false`,
    [session.diet_type_id]
  );
  const maxDayNum = maxDayRes.rows[0].max_day || 12;

  const expectedDates = [];
  const startDt = new Date(startDateStr);
  const endDt = new Date(endDateStr);
  for (let dt = startDt; dt <= endDt; dt.setUTCDate(dt.getUTCDate() + 1)) {
    expectedDates.push(dt.toISOString().slice(0, 10));
  }
  
  const dayNumberToDate = {};
  const queryDayNumbers = [];
  
  for (const date of expectedDates) {
    const diff = diffDays(startDateStr, date);
    const dayNum = (diff % maxDayNum) + 1;
    dayNumberToDate[dayNum] = dayNumberToDate[dayNum] || [];
    dayNumberToDate[dayNum].push(date);
    if (!queryDayNumbers.includes(dayNum)) queryDayNumbers.push(dayNum);
  }

  const configured = await pool.query(
    `SELECT pi.day_number, pi.meal_time, COALESCE(mi.category, '') AS category,
            mi.id AS menu_item_id, mi.price_usd
     FROM twelve_day_plan_items pi
     JOIN menu_items mi ON mi.id = pi.menu_item_id
     WHERE pi.day_number = ANY($1::int[]) AND mi.diet_type_id = $2 AND mi.is_deleted = false`,
    [queryDayNumbers, session.diet_type_id]
  );

  // "date|meal" -> Map(menu_item_id -> { category, price }); 
  const optionsByDateMeal = new Map();
  const expectedBucketKeys = new Set();
  for (const row of configured.rows) {
    const datesForDay = dayNumberToDate[row.day_number] || [];
    for (const date of datesForDay) {
      const dmKey = `${date}|${row.meal_time}`;
      if (!optionsByDateMeal.has(dmKey)) optionsByDateMeal.set(dmKey, new Map());
      optionsByDateMeal.get(dmKey).set(row.menu_item_id, { category: row.category, price: Number(row.price_usd) });
      expectedBucketKeys.add(`${dmKey}|${row.category}`);
    }
  }

  if (selections.length !== expectedBucketKeys.size) {
    return res.status(400).json({ error: 'Сонголтын тоо тухайн үеийн өдөр/цаг/ангиллын тоотой таарахгүй байна.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const seenBuckets = new Set();
    const resolvedItems = [];
    let total = 0;

    for (const sel of selections) {
      const dmKey = `${sel.plan_date}|${sel.meal_time}`;
      // Сонголт нь admin-ийн тухайн (өдөр, цаг, ангилал) слотод зөвшөөрсөн
      // (1 үндсэн + ≤2 нөөц) хоолнуудын нэг мөн эсэхийг шалгана — ангилал нь
      // menu_item_id-ээр дамжин implicit тодорхойлогдоно.
      const match = optionsByDateMeal.get(dmKey)?.get(sel.menu_item_id);
      if (!match) throw new Error(`Буруу сонголт: ${sel.plan_date} ${sel.meal_time}`);

      const bucketKey = `${dmKey}|${match.category}`;
      if (seenBuckets.has(bucketKey)) throw new Error(`Давхардсан сонголт: ${bucketKey}`);
      seenBuckets.add(bucketKey);

      total += match.price;
      resolvedItems.push({ menu_item_id: sel.menu_item_id, plan_date: sel.plan_date, meal_time: sel.meal_time, unitPrice: match.price });
    }
    if (seenBuckets.size !== expectedBucketKeys.size) {
      throw new Error('Зарим өдөр/цаг/ангилалд сонголт дутуу байна.');
    }

    let addonUnitPrice = null;
    if (addon_menu_item_id) {
      const addon = await client.query(
        `SELECT price_usd FROM menu_items
         WHERE id = $1 AND is_addon_recommended = true AND is_deleted = false AND available = true`,
        [addon_menu_item_id]
      );
      if (addon.rows.length === 0) throw new Error('Сонгосон нэмэлт зүйл боломжгүй байна.');
      addonUnitPrice = Number(addon.rows[0].price_usd);
      total += addonUnitPrice;
    }

    const orderRes = await insertOrder(client, (orderNumber) => client.query(
      `INSERT INTO orders (session_id, status, total_usd, plan_start_date, plan_end_date, plan_day_count, order_number)
       VALUES ($1, 'pending', $2, $3, $4, $5, $6) RETURNING id`,
      [session_id, total, startDateStr, endDateStr, expectedDates.length, orderNumber]
    ));
    const orderId = orderRes.rows[0].id;

    for (const item of resolvedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, guest_name, quantity, unit_price_usd, plan_date, plan_meal_time, is_addon)
         VALUES ($1, $2, $3, 1, $4, $5, $6, false)`,
        [orderId, item.menu_item_id, session.guest_name, item.unitPrice, item.plan_date, item.meal_time]
      );
    }

    if (addon_menu_item_id) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, guest_name, quantity, unit_price_usd, plan_date, plan_meal_time, is_addon)
         VALUES ($1, $2, $3, 1, $4, $5, NULL, true)`,
        [orderId, addon_menu_item_id, session.guest_name, addonUnitPrice, startDateStr]
      );
    }

    await client.query('COMMIT');

    const fullOrder = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);

    const io = req.app.get('io');
    io.to('admin').emit('order:new', fullOrder.rows[0]);

    res.status(201).json(fullOrder.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    req.app.get('logger').error('12 хоногийн захиалга үүсгэхэд алдаа гарлаа', { error: err.message });
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
}));

ordersRouter.get('/:id', requireSession, async (req, res) => {
  const order = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (order.rows.length === 0) return res.status(404).json({ error: 'Захиалга олдсонгүй.' });

  const items = await pool.query(
    `SELECT oi.*, mi.name FROM order_items oi
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE oi.order_id = $1
     ORDER BY oi.plan_date NULLS LAST, oi.plan_meal_time`,
    [req.params.id]
  );
    res.json({ ...order.rows[0], items: items.rows });
  });
