import { Router } from 'express';
import { pool } from '../db/pool.js';
import { validateBody, chatMessageSchema, uuidPattern } from '../middleware/validation.js';

export const chatRouter = Router();

// Зочин ↔ админ чат — нэвтрэлт шаардахгүй, захиалгын ID нь өөрөө "нэвтрэх
// түлхүүр" болдог (Hipay redirect-ийн ?order_id= адилхан итгэлцлийн загвар).
// Тиймээс энэ router-т requireSession/requireAdmin ашиглахгүй — доорх бүх
// endpoint зөвхөн order_id УУИД зөв бөгөөд тухайн захиалга бодитоор байгаа
// эсэхийг шалгана.

async function findOrder(orderId) {
  if (!uuidPattern.test(orderId)) return null;
  const { rows } = await pool.query(
    'SELECT id, status, total_usd, created_at FROM orders WHERE id = $1',
    [orderId]
  );
  return rows[0] || null;
}

// Мөн widget-ийн "order id баталгаажуулах" алхамд ашиглагдана — 404 бол
// тухайн ID-тай захиалга байхгүй гэсэн үг.
chatRouter.get('/:orderId/messages', async (req, res) => {
  const order = await findOrder(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Захиалга олдсонгүй.' });

  const messages = await pool.query(
    'SELECT id, sender, message, created_at FROM chat_messages WHERE order_id = $1 ORDER BY created_at ASC',
    [order.id]
  );
  res.json({ order, messages: messages.rows });
});

chatRouter.post('/:orderId/messages', validateBody(chatMessageSchema), async (req, res) => {
  const order = await findOrder(req.params.orderId);
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
});
