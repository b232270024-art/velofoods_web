-- Буудлын in-room dining захиалгын системийн DB схем

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS twelve_day_plan_items CASCADE;
DROP TABLE IF EXISTS twelve_day_cycle_settings CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS restaurants CASCADE;
DROP TABLE IF EXISTS diet_types CASCADE;
DROP TABLE IF EXISTS delivery_time_slots CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;

DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS session_status CASCADE;
DROP TYPE IF EXISTS session_order_type CASCADE;
DROP TYPE IF EXISTS session_delivery_type CASCADE;
DROP TYPE IF EXISTS meal_time CASCADE;
DROP TYPE IF EXISTS delivery_period CASCADE;

CREATE TYPE order_status AS ENUM ('pending', 'paid', 'cancelled', 'refunded');
CREATE TYPE session_status AS ENUM ('active', 'expired');
CREATE TYPE session_order_type AS ENUM ('twelve_day', 'one_time');
CREATE TYPE session_delivery_type AS ENUM ('hotel', 'current_location');
CREATE TYPE meal_time AS ENUM ('morning', 'lunch', 'evening');
CREATE TYPE delivery_period AS ENUM ('morning', 'midday', 'evening');

-- 2-3 өөр гал тогооны нэгж (dining outlet) ажилладаг — admin dashboard-ийн
-- Menu/Orders хуудсуудын гол filter нь энэ. Ресторан бүр яг нэг diet_type-д
-- (Halal/Vegan/...) харьяалагдана (diet_type_id, доор тодорхойлно).
CREATE TABLE restaurants (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL UNIQUE,
  diet_type_id       uuid,
  -- Тухайн ресторан өдөрт хэдэн ЗАХИАЛГА (menu item stock биш) авахыг
  -- хязгаарлана. NULL = хязгааргүй. Лимит хүрэхэд зочин шинэ захиалга өгөх
  -- үед алдаа буцна (orders.js).
  daily_order_limit  integer DEFAULT 100,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Хоолны ангилал (Halal/Vegan/...) — нэг ерөнхий жагсаалт, admin Тохиргоо
-- хуудаснаас нэмэх/нэрийг солих/устгах боломжтой.
CREATE TABLE diet_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One-time захиалгын "маргааш хэдэн цагт хүргэх вэ" сонголт — 3 тогтмол
-- цонх (өглөө/өдөр/орой), admin Тохиргоо хуудаснаас цаг хүрээ + идэвхтэй
-- эсэхийг өөрчилнө. Зочны сонголт нь захиалга үүсэх мөчид orders руу
-- царцаж хадгалагддаг тул энд хийсэн засвар зөвхөн ЦААШИДЫН захиалгад нөлөөлнө.
CREATE TABLE delivery_time_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period      delivery_period NOT NULL UNIQUE,
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  sort_order  smallint NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE restaurants ADD CONSTRAINT restaurants_diet_type_id_fkey
  FOREIGN KEY (diet_type_id) REFERENCES diet_types(id);
-- Нэг ангиллыг зөвхөн НЭГ ресторан эзэмшинэ (NULL-үүд хоорондоо мөргөлдөхгүй).
CREATE UNIQUE INDEX idx_restaurants_diet_type_unique
  ON restaurants(diet_type_id) WHERE diet_type_id IS NOT NULL;

CREATE TABLE sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name         text NOT NULL,
  room_number        text,
  hotel_name         text,   -- зочны чөлөөтэй бичсэн буудлын нэр (баталгаажуулалтгүй)
  order_type         session_order_type NOT NULL,
  delivery_type      session_delivery_type,
  delivery_address   text,
  delivery_lat       double precision,
  delivery_lng       double precision,
  location_verified  boolean NOT NULL DEFAULT false,
  geo_lat            double precision,
  geo_lng            double precision,
  status             session_status NOT NULL DEFAULT 'active',
  -- 12 хоногийн план дээр сонгосон ангилал (зөвхөн order_type='twelve_day').
  diet_type_id       uuid REFERENCES diet_types(id),
  -- Зочны мэдэгдсэн харшил/иддэггүй зүйлс — menu_items.allergens-тай ижил tag
  -- vocabulary ашиглана, admin-ийн Захиалгууд/12 хоногийн зочид хуудсанд
  -- automатаар зөрчил илрүүлэхэд ашиглагдана.
  allergy_tags       text[] DEFAULT '{}',
  allergy_other      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE TABLE menu_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text,
  category      text,
  diet_type_id  uuid NOT NULL REFERENCES diet_types(id),
  price_usd     numeric(10,2) NOT NULL CHECK (price_usd >= 0),
  image_url     text,
  calories      integer,
  allergens     text[] DEFAULT '{}',
  prep_time_min integer DEFAULT 15,
  is_featured   boolean NOT NULL DEFAULT false,
  available     boolean NOT NULL DEFAULT true,
  is_deleted    boolean NOT NULL DEFAULT false,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id),
  stock_limit   integer, -- Өдөр тутам 0-ээс дахин эхэлдэг лимит (NULL = хязгааргүй)
  -- 12 хоногийн планы сүүлийн хуудсанд "санал болгох" зууш/амттан гэж тэмдэглэнэ.
  is_addon_recommended boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_menu_items_diet  ON menu_items(diet_type_id);
CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_id);

CREATE TABLE orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL REFERENCES sessions(id),
  status           order_status NOT NULL DEFAULT 'pending',
  total_usd        numeric(10,2) NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- Зочид/admin-д харуулах, чат нээхэд ашиглах богино (8 тэмдэгт) захиалгын
  -- дугаар (src/services/orderNumber.js) — id (UUID) нь бүх FK/дотоод
  -- логикт хэвээрээ үлдэнэ, энэ багана зөвхөн хүмүүст зориулсан.
  order_number     text NOT NULL UNIQUE,
  -- Зөвхөн 12 хоногийн план захиалгад бөглөгдөнө (one_time дээр NULL) — тухайн
  -- худалдан авалтын үед тооцоологдсон огнооны цонхыг царцаана, эргэлтийн
  -- start_date дараа өөрчлөгдсөн ч хуучин захиалга өөрчлөгдөхгүй.
  plan_start_date  date,
  plan_end_date    date,
  plan_day_count   integer,
  -- Зөвхөн one_time захиалгад бөглөгдөнө (12 хоногийн план дээр NULL) — зочны
  -- сонгосон "маргаашийн хүргэлт хэдэн цагт" гэсэн хүсэлтийг захиалга үүсэх
  -- мөчид delivery_time_slots-оос ЦАРЦААЖ хадгална (admin дараа нь цагийн
  -- хүрээгээ өөрчилсөн ч аль хэдийн үүссэн захиалгын хүргэлтийн цаг хэвээрээ
  -- үлдэнэ — FK биш, шууд утга хуулж авна).
  delivery_period       delivery_period,
  delivery_window_start time,
  delivery_window_end   time
);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_session ON orders(session_id);

CREATE TABLE order_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id     uuid NOT NULL REFERENCES menu_items(id),
  guest_name       text NOT NULL,
  quantity         integer NOT NULL CHECK (quantity > 0),
  unit_price_usd   numeric(10,2) NOT NULL,
  -- Зөвхөн 12 хоногийн план захиалгад бөглөгдөнө — аль өдөр/цагийн хоол болохыг
  -- тэмдэглэнэ. is_addon=true бол сүүлийн хуудсан дээр сонгосон нэмэлт зүйл.
  plan_date        date,
  plan_meal_time   meal_time,
  is_addon         boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- Admin-ийн удирддаг "12 хоногийн цэс" — өдөр (1-12) тус бүрийн
-- өглөө/өдөр/оройн хоолонд ямар menu item(ууд) орохыг тодорхойлно.
-- Ресторан/ангилал нь menu_item_id-ээр дамжуулан аль хэдийн тодорхойлогддог.
-- sort_order: 0 = үндсэн (default) сонголт, 1-2 = зочны сольж болох нөөц хоол
-- (слот бүрд дээд тал нь 3 — app-level-д admin.js POST /plan-items шалгана).
CREATE TABLE twelve_day_plan_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number    integer NOT NULL CHECK (day_number BETWEEN 1 AND 12),
  meal_time     meal_time NOT NULL,
  menu_item_id  uuid NOT NULL REFERENCES menu_items(id),
  sort_order    smallint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (day_number, meal_time, menu_item_id)
);
CREATE INDEX idx_plan_items_day ON twelve_day_plan_items(day_number);

-- 12 хоногийн идэвхтэй эргэлтийн эхлэх огноо (singleton мөр) — admin Тохиргоо
-- хуудаснаас өөрчилнө. end_date = start_date + 11 хоног (тооцоолж хадгалахгүй).
CREATE TABLE twelve_day_cycle_settings (
  id          boolean PRIMARY KEY DEFAULT true CHECK (id),
  start_date  date NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id               uuid NOT NULL REFERENCES orders(id),
  gateway_provider       text NOT NULL,
  currency               text NOT NULL DEFAULT 'USD',
  amount_usd             numeric(10,2) NOT NULL,
  fx_rate_applied        numeric(12,6),
  amount_charged_local   numeric(14,2),
  transaction_id         text NOT NULL UNIQUE,
  status                 text NOT NULL DEFAULT 'pending',
  paid_at                timestamptz
);
CREATE INDEX idx_payments_order ON payments(order_id);

-- Захиалга тус бүрийн доор нээгддэг зочин ↔ админ шууд чат — зочин
-- захиалгын ID-гаараа (нэвтрэлтгүйгээр) чатыг нээнэ, admin dashboard-ийн
-- Чат хуудаснаас хариулна. order_id нь өөрөө "нэвтрэх түлхүүр" болдог тул
-- (Hipay redirect-ийн ?order_id= адил) session-тэй холбоо шаардлагагүй.
CREATE TABLE chat_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES orders(id),
  sender         text NOT NULL CHECK (sender IN ('guest', 'admin')),
  message        text NOT NULL,
  read_by_admin  boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_messages_order ON chat_messages(order_id);

-- Initial Seed Data
INSERT INTO restaurants (id, name) VALUES
('c1111111-1111-1111-1111-111111111111', 'Ресторан 1'),
('c2222222-2222-2222-2222-222222222222', 'Ресторан 2'),
('c3333333-3333-3333-3333-333333333333', 'Ресторан 3')
ON CONFLICT (id) DO NOTHING;

INSERT INTO diet_types (id, name) VALUES
('d1111111-1111-1111-1111-111111111111', 'standard'),
('d2222222-2222-2222-2222-222222222222', 'vegetarian'),
('d3333333-3333-3333-3333-333333333333', 'vegan'),
('d4444444-4444-4444-4444-444444444444', 'halal'),
('d5555555-5555-5555-5555-555555555555', 'gluten_free')
ON CONFLICT (id) DO NOTHING;

INSERT INTO menu_items (id, name, description, category, diet_type_id, price_usd, image_url, calories, allergens, prep_time_min, is_featured, available, restaurant_id, stock_limit) VALUES
-- Halal dishes
('a1111111-1111-1111-1111-111111111111',
 'Halal Ribeye Steak 300g',
 'Tender halal-certified ribeye grilled to perfection, served with seasonal vegetables and herb sauce.',
 'Main Course', 'd4444444-4444-4444-4444-444444444444', 28.00, NULL, 620, '{gluten}', 25, true, true, 'c1111111-1111-1111-1111-111111111111', NULL),

('a2222222-2222-2222-2222-222222222222',
 'Halal Chicken Tikka',
 'Juicy halal chicken marinated in yogurt and spices, grilled on skewers.',
 'Main Course', 'd4444444-4444-4444-4444-444444444444', 18.00, NULL, 430, '{}', 20, true, true, 'c1111111-1111-1111-1111-111111111111', 20),

-- Vegetarian dishes
('a3333333-3333-3333-3333-333333333333',
 'Caesar Salad',
 'Crisp romaine lettuce, parmesan, croutons and house Caesar dressing. Vegetarian-friendly.',
 'Salad & Appetizer', 'd2222222-2222-2222-2222-222222222222', 12.50, NULL, 280, '{gluten,dairy}', 10, false, true, 'c2222222-2222-2222-2222-222222222222', NULL),

('a4444444-4444-4444-4444-444444444444',
 'Garden Buddha Bowl',
 'Quinoa, roasted chickpeas, avocado, sweet potato and tahini drizzle.',
 'Main Course', 'd3333333-3333-3333-3333-333333333333', 16.00, NULL, 480, '{sesame}', 15, true, true, 'c2222222-2222-2222-2222-222222222222', NULL),

('a5555555-5555-5555-5555-555555555555',
 'Grilled Veggie Platter',
 'Seasonal grilled vegetables with hummus and warm pita bread.',
 'Appetizer', 'd2222222-2222-2222-2222-222222222222', 13.50, NULL, 320, '{gluten}', 12, false, true, 'c2222222-2222-2222-2222-222222222222', NULL),

-- Vegan dishes
('a6666666-6666-6666-6666-666666666666',
 'Vegan Mushroom Risotto',
 'Creamy arborio rice with wild mushrooms, truffle oil and fresh herbs. 100% plant-based.',
 'Main Course', 'd3333333-3333-3333-3333-333333333333', 17.50, NULL, 390, '{}', 20, true, true, 'c2222222-2222-2222-2222-222222222222', NULL),

-- Gluten-free dishes
('a7777777-7777-7777-7777-777777777777',
 'Grilled Salmon Fillet',
 'Atlantic salmon with lemon butter, capers and steamed vegetables. Naturally gluten-free.',
 'Main Course', 'd5555555-5555-5555-5555-555555555555', 24.00, NULL, 520, '{fish}', 18, true, true, 'c3333333-3333-3333-3333-333333333333', NULL),

('a8888888-8888-8888-8888-888888888888',
 'Fresh Fruit Smoothie Bowl',
 'Blended açaí, banana and mixed berries topped with granola and fresh fruits.',
 'Dessert & Drinks', 'd3333333-3333-3333-3333-333333333333', 9.00, NULL, 290, '{nuts}', 5, false, true, 'c3333333-3333-3333-3333-333333333333', NULL),

('a9999999-9999-9999-9999-999999999999',
 'New York Cheesecake',
 'Classic creamy cheesecake on a graham cracker crust with berry compote.',
 'Dessert & Drinks', 'd2222222-2222-2222-2222-222222222222', 8.50, NULL, 380, '{gluten,dairy,eggs}', 5, false, true, 'c3333333-3333-3333-3333-333333333333', NULL),

('b1111111-1111-1111-1111-111111111111',
 'Freshly Squeezed Orange Juice',
 'Chilled fresh orange juice. Vegan, gluten-free.',
 'Dessert & Drinks', 'd3333333-3333-3333-3333-333333333333', 6.00, NULL, 110, '{}', 3, false, true, 'c3333333-3333-3333-3333-333333333333', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO twelve_day_cycle_settings (id, start_date) VALUES (true, '2026-08-17')
ON CONFLICT (id) DO NOTHING;

INSERT INTO delivery_time_slots (period, start_time, end_time, sort_order) VALUES
('morning', '07:00', '08:00', 0),
('midday',  '12:00', '14:00', 1),
('evening', '17:00', '19:00', 2)
ON CONFLICT (period) DO NOTHING;
