#!/usr/bin/env node
// Локал хөгжүүлэлтийн DB-д 12 хоногийн план (twelve_day_plan_items) болон
// нэмэлт (addon) хоолны жишээ өгөгдөл нэмнэ — эс бөгөөс шинэ clone хийсэн
// эсвэл цэвэр DB дээр PlanPreview хуудас "боломжгүй" гэж харагдаж, эргэн
// давтан гараар SQL бичих шаардлагатай болдог байсан.
//
// Идэмпотент: хэдэн ч удаа ажиллуулж болно, давхардуулахгүй (нэр/UNIQUE
// шалгаад л дутуугаа нэмнэ, одоо байгаа өгөгдлийг устгаж/дарж бичихгүй).
//
// Ашиглах: npm run seed  (эсвэл node scripts/seed-local.mjs)

import { pool } from '../src/db/pool.js';

const DEMO_RESTAURANT_NAME = 'Demo Kitchen (local seed)';
const DEMO_ITEM_PREFIX = 'Demo:';

async function findMenuItemByName(name) {
  const { rows } = await pool.query('SELECT id, price_usd FROM menu_items WHERE name = $1 LIMIT 1', [name]);
  return rows[0] || null;
}

async function main() {
  console.log('Seed эхэллээ...');

  // 1. 'standard' diet_type-г ол (schema.sql-ийн анхны migration-аар
  // үргэлж үүсдэг тул байхгүй бол алдаа шиднэ — админ дашбоардаас Тохиргоо
  // хуудсаар шинэ ангилал үүсгэсэн байх шаардлагатай гэдгийг илэрхийлнэ).
  const dietRes = await pool.query("SELECT id FROM diet_types WHERE name = 'standard' LIMIT 1");
  if (dietRes.rows.length === 0) {
    throw new Error("'standard' diet_type олдсонгүй — эхлээд migrate ажиллуулсан эсэхээ шалгана уу (npm run migrate).");
  }
  const dietTypeId = dietRes.rows[0].id;

  // 2. Demo ресторан — diet_type тус бүрт ганц л ресторан байх ёстой
  // (UNIQUE index) тул 'standard'-д өмнө нь өөр ресторан аль хэдийн
  // холбогдсон бол шинээр үүсгэхгүй, тэрийг нь ашиглана.
  let restaurantId;
  const existingRestForDiet = await pool.query(
    'SELECT id, name FROM restaurants WHERE diet_type_id = $1 LIMIT 1',
    [dietTypeId]
  );
  if (existingRestForDiet.rows.length > 0) {
    restaurantId = existingRestForDiet.rows[0].id;
    console.log(`'standard' ангилалд аль хэдийн '${existingRestForDiet.rows[0].name}' ресторан холбогдсон байна — түүнийг ашиглана.`);
  } else {
    const rest = await pool.query(
      `INSERT INTO restaurants (name, diet_type_id) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET diet_type_id = EXCLUDED.diet_type_id
       RETURNING id`,
      [DEMO_RESTAURANT_NAME, dietTypeId]
    );
    restaurantId = rest.rows[0].id;
    console.log(`'${DEMO_RESTAURANT_NAME}' ресторан үүслээ/шинэчлэгдлээ.`);
  }

  // 3. Өглөө/Өдөр/Орой тус бүрийн үндсэн хоол (байхгүй бол л нэмнэ).
  const coreItems = [
    { name: `${DEMO_ITEM_PREFIX} Breakfast Bowl`, category: 'Breakfast', price: 8 },
    { name: `${DEMO_ITEM_PREFIX} Lunch Plate`, category: 'Lunch', price: 10 },
    { name: `${DEMO_ITEM_PREFIX} Dinner Special`, category: 'Dinner', price: 12 },
  ];
  const coreIds = {};
  for (const item of coreItems) {
    let existing = await findMenuItemByName(item.name);
    if (!existing) {
      const ins = await pool.query(
        `INSERT INTO menu_items (name, category, diet_type_id, price_usd, restaurant_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, price_usd`,
        [item.name, item.category, dietTypeId, item.price, restaurantId]
      );
      existing = ins.rows[0];
      console.log(`Menu item үүслээ: ${item.name} ($${item.price})`);
    }
    coreIds[item.category] = existing.id;
  }

  // 4. 2 нэмэлт (addon) санал болгох зүйл.
  const addonItems = [
    { name: `${DEMO_ITEM_PREFIX} Extra Cheesecake`, category: 'Dessert', price: 5 },
    { name: `${DEMO_ITEM_PREFIX} Fresh Juice`, category: 'Drink', price: 3 },
  ];
  for (const item of addonItems) {
    const existing = await findMenuItemByName(item.name);
    if (!existing) {
      await pool.query(
        `INSERT INTO menu_items (name, category, diet_type_id, price_usd, restaurant_id, is_addon_recommended)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [item.name, item.category, dietTypeId, item.price, restaurantId]
      );
      console.log(`Addon menu item үүслээ: ${item.name} ($${item.price})`);
    }
  }

  // 5. 12 хоног x 3 цаг (Өглөө/Өдөр/Орой) — өдөр бүр ижил 3 хоолыг заана
  // (жинхэнэ ялгаатай цэс биш, зөвхөн PlanPreview/захиалгын урсгалыг локал
  // дээр турших боломжтой болгоход хангалттай). UNIQUE(day_number,
  // meal_time, menu_item_id) constraint-д тулгуурлаж ON CONFLICT DO NOTHING.
  const mealToCategory = { morning: 'Breakfast', lunch: 'Lunch', evening: 'Dinner' };
  let planItemsAdded = 0;
  for (let day = 1; day <= 12; day++) {
    for (const [mealTime, category] of Object.entries(mealToCategory)) {
      const res = await pool.query(
        `INSERT INTO twelve_day_plan_items (day_number, meal_time, menu_item_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (day_number, meal_time, menu_item_id) DO NOTHING
         RETURNING id`,
        [day, mealTime, coreIds[category]]
      );
      if (res.rows.length > 0) planItemsAdded++;
    }
  }
  console.log(`twelve_day_plan_items: ${planItemsAdded} шинэ мөр нэмэгдлээ (нийт 12 хоног x 3 цаг = 36 байх ёстой).`);

  // 6. Эргэлтийн эхлэх огноо (singleton мөр) — байхгүй бол л (жишээ нь
  // цоо шинэ DB) өнөөдрөөр эхлүүлнэ.
  await pool.query(
    `INSERT INTO twelve_day_cycle_settings (id, start_date) VALUES (true, CURRENT_DATE)
     ON CONFLICT (id) DO NOTHING`
  );

  console.log('\n✅ Seed дууслаа. "npm run dev" асаагаад 12 хоногийн планыг локал дээр шалгаж болно.');
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed амжилтгүй боллоо:', err.message);
  process.exit(1);
});
