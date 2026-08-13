import { pool } from '../pool.js';

// Migration 013 — One-time захиалгын хүргэлтийн цагийн хүрээ (delivery time slot)
// - delivery_period ENUM (morning/midday/evening) үүсгэх
// - delivery_time_slots хүснэгт үүсгэж, 3 анхны цонхоор seed хийх
// - orders хүснэгтэд delivery_period/delivery_window_start/delivery_window_end
//   багана нэмэх (захиалга үүсэх мөчид сонгосон цонхыг царцааж хадгална)
// Ажиллуулах: node src/db/migrations/013_delivery_time_slots.js

async function migrate() {
  await pool.query(`
    DO $$
    BEGIN
      CREATE TYPE delivery_period AS ENUM ('morning', 'midday', 'evening');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  console.log('✓ delivery_period ENUM бэлэн.');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS delivery_time_slots (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      period      delivery_period NOT NULL UNIQUE,
      start_time  time NOT NULL,
      end_time    time NOT NULL,
      active      boolean NOT NULL DEFAULT true,
      sort_order  smallint NOT NULL,
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
  console.log('✓ delivery_time_slots хүснэгт бэлэн.');

  await pool.query(`
    INSERT INTO delivery_time_slots (period, start_time, end_time, sort_order) VALUES
    ('morning', '07:00', '08:00', 0),
    ('midday',  '12:00', '14:00', 1),
    ('evening', '17:00', '19:00', 2)
    ON CONFLICT (period) DO NOTHING;
  `);
  console.log('✓ Анхны 3 цонх seed хийгдлээ.');

  await pool.query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS delivery_period delivery_period,
      ADD COLUMN IF NOT EXISTS delivery_window_start time,
      ADD COLUMN IF NOT EXISTS delivery_window_end time;
  `);
  console.log('✓ orders.delivery_period/delivery_window_start/delivery_window_end багана нэмэгдлээ.');

  console.log('Migration 013 бүрэн дууслаа.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration алдаа:', err.message);
  process.exit(1);
});
