import { pool } from '../pool.js';
import { generateOrderNumber } from '../../services/orderNumber.js';

// Нэмэлт (additive) migration — байгаа DB-ийн өгөгдлийг устгахгүй.
// 010_chat_messages.js-ийн ДАРАА ажиллуулна.
// Ажиллуулах: node src/db/migrations/011_order_number.js
//
// orders.order_number — зочид/admin-д харуулах, чат нээхэд ашиглах богино
// (8 тэмдэгт) захиалгын дугаар. orders.id (UUID) хэвээрээ бүх FK/дотоод
// логикт үлдэнэ — энэ багана зөвхөн хүмүүст зориулсан дэлгэц/оролт.

async function migrate() {
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number text;`);
  console.log('✓ orders.order_number багана нэмэгдлээ.');

  const missing = await pool.query('SELECT id FROM orders WHERE order_number IS NULL');
  for (const { id } of missing.rows) {
    let assigned = false;
    while (!assigned) {
      const code = generateOrderNumber();
      try {
        await pool.query('UPDATE orders SET order_number = $1 WHERE id = $2', [code, id]);
        assigned = true;
      } catch (err) {
        if (err.code !== '23505') throw err; // давхардсан код гарвал дахин үүсгэнэ
      }
    }
  }
  console.log(`✓ Одоо байгаа ${missing.rows.length} захиалгад order_number оноолоо.`);

  await pool.query(`ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);`);
  console.log('✓ order_number NOT NULL + UNIQUE index бэлэн.');

  console.log('Migration бүрэн дууслаа.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration алдаа:', err.message);
  process.exit(1);
});
