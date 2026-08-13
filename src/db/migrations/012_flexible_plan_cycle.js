import { pool } from '../pool.js';

// Migration 012 — Хоолны захиалгын план уян хатан болгох
// - twelve_day_cycle_settings-д end_date багана нэмэх (default: start_date + 11 days)
// - twelve_day_plan_items.day_number-ийн CHECK хязгаарыг 1-99 болгох (12-оос ихийг зөвшөөрөх)
// Ажиллуулах: node src/db/migrations/012_flexible_plan_cycle.js

async function migrate() {
  // 1. end_date багана нэмэх
  await pool.query(`
    ALTER TABLE twelve_day_cycle_settings
    ADD COLUMN IF NOT EXISTS end_date date;
  `);

  // 2. Одоогийн бичлэгийн end_date-г start_date + 11 days болгож тохируулах
  await pool.query(`
    UPDATE twelve_day_cycle_settings
    SET end_date = start_date + interval '11 days'
    WHERE end_date IS NULL;
  `);

  // 3. end_date NOT NULL болгох
  await pool.query(`
    ALTER TABLE twelve_day_cycle_settings
    ALTER COLUMN end_date SET NOT NULL;
  `);
  console.log('✓ twelve_day_cycle_settings.end_date багана нэмэгдлээ.');

  // 4. twelve_day_plan_items.day_number-ийн хязгаарыг сулруулах (1-99)
  // Анхны CHECK constraint-г устгаад шинэ хязгаар тавих
  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE twelve_day_plan_items DROP CONSTRAINT IF EXISTS twelve_day_plan_items_day_number_check;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    $$;
  `);
  await pool.query(`
    ALTER TABLE twelve_day_plan_items
    ADD CONSTRAINT twelve_day_plan_items_day_number_check CHECK (day_number >= 1 AND day_number <= 999);
  `);
  console.log('✓ twelve_day_plan_items.day_number хязгаар 1-999 болгогдлоо.');

  console.log('Migration 012 бүрэн дууслаа.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration алдаа:', err.message);
  process.exit(1);
});
