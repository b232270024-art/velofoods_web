import { Router } from 'express';
import { pool } from '../db/pool.js';
import { validateBody, chatMessageSchema, orderNumberPattern, uuidPattern } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const chatRouter = Router();

// Зочин ↔ админ чат — нэвтрэлт шаардахгүй, богино захиалгын дугаар (order_number)
// нь өөрөө "нэвтрэх түлхүүр" болдог (Hipay redirect-ийн ?order_id= адилхан
// итгэлцлийн загвар — гэхдээ энд UUID биш, зочинд харуулсан богино кодоор
// хайна). Тиймээс энэ router-т requireSession/requireAdmin ашиглахгүй — доорх
// бүх endpoint зөвхөн код зөв форматтай бөгөөд тухайн захиалга бодитоор
// байгаа эсэхийг шалгана. Дотоод холбоос (chat_messages.order_id, socket
// room) хэвээрээ UUID (order.id) дээр тулгуурлана.

async function findOrder(codeInput) {
  const code = (codeInput || '').trim().toUpperCase();
  if (!orderNumberPattern.test(code)) return null;
  const { rows } = await pool.query(
    'SELECT id, order_number, status, total_usd, created_at FROM orders WHERE order_number = $1',
    [code]
  );
  return rows[0] || null;
}

// Мөн widget-ийн "захиалгын дугаар баталгаажуулах" алхамд ашиглагдана — 404
// бол тухайн дугаартай захиалга байхгүй гэсэн үг.
chatRouter.get('/:orderNumber/messages', asyncHandler(async (req, res) => {
  const order = await findOrder(req.params.orderNumber);
  if (!order) return res.status(404).json({ error: 'Захиалга олдсонгүй.' });

  const messages = await pool.query(
    'SELECT id, sender, message, created_at FROM chat_messages WHERE order_id = $1 ORDER BY created_at ASC',
    [order.id]
  );
  res.json({ order, messages: messages.rows });
}));

chatRouter.post('/:orderNumber/messages', validateBody(chatMessageSchema), asyncHandler(async (req, res) => {
  const order = await findOrder(req.params.orderNumber);
  if (!order) return res.status(404).json({ error: 'Захиалга олдсонгүй.' });

  const { message } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO chat_messages (order_id, sender, message)
     VALUES ($1, 'guest', $2) RETURNING id, order_id, sender, message, created_at`,
    [order.id, message]
  );
  const row = rows[0];

  const io = req.app.get('io');
  io.to('admin').emit('chat:message', row);
  io.to(`chat:${order.id}`).emit('chat:message', row);

  res.status(201).json(row);
}));

// Захиалгагүй "ерөнхий" чат — клиент талд үүсгэсэн guest_token (UUID,
// localStorage-д хадгалагдана) нь order_number-тэй адил "нэвтрэх түлхүүр"
// болдог тул энд ч requireSession шаардахгүй. Socket room нэрийг order-based
// чаттай ижил хэлбэрээр (chat:<id>) ашигладаг тул index.js-ийн chat:join
// handler-т өөрчлөлт хийх шаардлагагүй — guest_token нь өөрөө UUID.
chatRouter.get('/general/:guestToken/messages', asyncHandler(async (req, res) => {
  const { guestToken } = req.params;
  if (!uuidPattern.test(guestToken)) return res.status(400).json({ error: 'Буруу guest_token.' });

  const messages = await pool.query(
    'SELECT id, sender, message, created_at FROM chat_messages WHERE guest_token = $1 ORDER BY created_at ASC',
    [guestToken]
  );
  res.json({ messages: messages.rows });
}));

chatRouter.post('/general/:guestToken/messages', validateBody(chatMessageSchema), asyncHandler(async (req, res) => {
  const { guestToken } = req.params;
  if (!uuidPattern.test(guestToken)) return res.status(400).json({ error: 'Буруу guest_token.' });

  const { message } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO chat_messages (guest_token, sender, message)
     VALUES ($1, 'guest', $2) RETURNING id, guest_token, sender, message, created_at`,
    [guestToken, message]
  );
  const row = rows[0];

  const io = req.app.get('io');
  io.to('admin').emit('chat:message', row);
  io.to(`chat:${guestToken}`).emit('chat:message', row);

  res.status(201).json(row);
}));
