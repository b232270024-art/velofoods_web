import { pool } from '../pool.js';

// Нэмэлт (additive) migration — байгаа өгөгдлийг устгахгүй.
// 013_delivery_time_slots.js-ийн ДАРАА ажиллуулна.
// Ажиллуулах: node src/db/migrations/014_general_chat.js
//
// Одоог хүртэл chat зөвхөн захиалгатай холбоотой байсан (order_id NOT NULL).
// Захиалга хийгээгүй/өөр шалтгаанаар бичих зочдод зориулж guest_token
// (клиент талд үүсгэсэн UUID, localStorage-д хадгалагдана — order_number
// адил "нэвтрэх түлхүүр" загвар) ашигласан "ерөнхий" thread нэмнэ.
// order_id, guest_token хоёрын яг НЭГ нь тавигдсан байх ёстой.

async function migrate() {
  await pool.query(`ALTER TABLE chat_messages ALTER COLUMN order_id DROP NOT NULL;`);
  console.log('✓ chat_messages.order_id NULL зөвшөөрөгдөх боллоо.');

  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS guest_token uuid;`);
  console.log('✓ chat_messages.guest_token багана нэмэгдлээ.');

  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_thread_check
        CHECK ((order_id IS NOT NULL AND guest_token IS NULL) OR (order_id IS NULL AND guest_token IS NOT NULL));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  console.log('✓ chat_messages_thread_check constraint бэлэн.');

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_guest_token ON chat_messages(guest_token);`);
  console.log('✓ idx_chat_messages_guest_token индекс бэлэн.');

  console.log('Migration бүрэн дууслаа.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration алдаа:', err.message);
  process.exit(1);
});
