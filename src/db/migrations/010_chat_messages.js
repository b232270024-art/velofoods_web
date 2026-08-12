import { pool } from '../pool.js';

// Нэмэлт (additive) migration — байгаа DB-ийн өгөгдлийг устгахгүй.
// 009_twelve_day_paid_plan.js-ийн ДАРАА ажиллуулна.
// Ажиллуулах: node src/db/migrations/010_chat_messages.js
//
// chat_messages — захиалга тус бүрийн доор нээгддэг зочин ↔ админ шууд чат.
// Зочин захиалгын ID-гаараа (нэвтрэлтгүйгээр) чатыг нээнэ — order_id нь
// өөрөө "нэвтрэх түлхүүр" болдог тул (Hipay redirect-ийн ?order_id= адил)
// session-тэй холбоо шаардлагагүй. admin dashboard-ийн шинэ Чат хуудаснаас
// хариулна (src/routes/admin.js).

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id       uuid NOT NULL REFERENCES orders(id),
      sender         text NOT NULL CHECK (sender IN ('guest', 'admin')),
      message        text NOT NULL,
      read_by_admin  boolean NOT NULL DEFAULT false,
      created_at     timestamptz NOT NULL DEFAULT now()
    );
  `);
  console.log('✓ chat_messages хүснэгт бэлэн.');

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_order ON chat_messages(order_id);`);
  console.log('✓ idx_chat_messages_order индекс бэлэн.');

  console.log('Migration бүрэн дууслаа.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration алдаа:', err.message);
  process.exit(1);
});
