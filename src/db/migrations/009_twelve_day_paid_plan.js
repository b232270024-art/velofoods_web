import { pool } from '../pool.js';

// Нэмэлт (additive) migration — байгаа DB-ийн өгөгдлийг устгахгүй.
// 008_restaurant_daily_order_limit.js-ийн ДАРАА ажиллуулна.
// Ажиллуулах: node src/db/migrations/009_twelve_day_paid_plan.js
//
// "12 хоногийн план"-г үнэгүй бүртгэлээс бодит, огноот, төлбөртэй захиалга
// болгоход шаардлагатай схем:
//  - twelve_day_cycle_settings: идэвхтэй эргэлтийн эхлэх огноо (admin Тохиргоо
//    хуудаснаас өөрчилнө; end_date = start_date + 11 хоног).
//  - twelve_day_plan_items.sort_order: слот (өдөр/цаг) тус бүрт 1 үндсэн (0) +
//    2 нөөц (1,2) хоол зөвшөөрнө.
//  - orders/order_items: тухайн худалдан авалтын үед царцаасан огнооны цонх,
//    өдөр/цаг тус бүрийн бодит сонголт, нэмэлт (addon) зүйл тэмдэглэгээ.
//  - menu_items.is_addon_recommended: сүүлийн хуудсанд "санал болгох" зүйл.

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS twelve_day_cycle_settings (
      id          boolean PRIMARY KEY DEFAULT true CHECK (id),
      start_date  date NOT NULL,
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    INSERT INTO twelve_day_cycle_settings (id, start_date)
    VALUES (true, '2026-08-17')
    ON CONFLICT (id) DO NOTHING;
  `);
  console.log('✓ twelve_day_cycle_settings хүснэгт бэлэн (эхлэх огноо 2026-08-17).');

  await pool.query(`ALTER TABLE twelve_day_plan_items ADD COLUMN IF NOT EXISTS sort_order smallint NOT NULL DEFAULT 0;`);
  console.log('✓ twelve_day_plan_items.sort_order багана нэмэгдлээ.');

  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS plan_start_date date;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS plan_end_date date;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS plan_day_count integer;`);
  console.log('✓ orders.plan_start_date/plan_end_date/plan_day_count багана нэмэгдлээ.');

  await pool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS plan_date date;`);
  await pool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS plan_meal_time meal_time;`);
  await pool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_addon boolean NOT NULL DEFAULT false;`);
  console.log('✓ order_items.plan_date/plan_meal_time/is_addon багана нэмэгдлээ.');

  await pool.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_addon_recommended boolean NOT NULL DEFAULT false;`);
  console.log('✓ menu_items.is_addon_recommended багана нэмэгдлээ.');

  console.log('Migration бүрэн дууслаа.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration алдаа:', err.message);
  process.exit(1);
});
