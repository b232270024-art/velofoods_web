import { z } from 'zod';

export const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidSchema = (msg) => z.string().regex(uuidPattern, msg || 'Зөв UUID байх ёстой');

// Зочид/admin-д харуулах богино захиалгын дугаар — src/services/orderNumber.js-ийн
// тэмдэгтийн сантай (0/O, 1/I/L хассан) тааруулав.
export const orderNumberPattern = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const firstErrorMsg = Object.entries(fieldErrors)
        .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
        .join('; ');
      return res.status(400).json({
        error: `Ирсэн өгөгдөл буруу форматтай байна (${firstErrorMsg})`,
        details: fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}

export const createSessionSchema = z
  .object({
    guest_name: z.string().trim().min(1, 'Нэр хоосон байж болохгүй').max(100),
    order_type: z.enum(['twelve_day', 'one_time'], { message: 'order_type нь twelve_day эсвэл one_time байх ёстой' }),
    delivery_type: z.enum(['hotel', 'current_location']).nullish(),
    room_number: z.string().trim().min(1).max(20).nullish(),
    hotel_name: z.string().trim().min(1).max(150).nullish(),
    delivery_address: z.string().trim().min(1).max(300).nullish(),
    geo_lat: z.number().min(-90).max(90).nullish(),
    geo_lng: z.number().min(-180).max(180).nullish(),
    // 12 хоногийн план дээр сонгосон ангилал (зөвхөн order_type='twelve_day'
    // үед route-ийн түвшинд ашиглагдана — one_time дээр route нь NULL болгоно).
    diet_type_id: uuidSchema('diet_type_id зөв UUID байх ёстой').nullish(),
    allergy_tags: z.array(z.string().trim().max(30)).max(20).nullish(),
    allergy_other: z.string().trim().max(300).nullish(),
  })
  .superRefine((data, ctx) => {
    // 12 хоногийн план бол хүргэлт нь буудлын өрөө руу далд тогтмол
    const deliveryType = data.order_type === 'twelve_day' ? 'hotel' : data.delivery_type;

    if (data.order_type === 'one_time' && !data.delivery_type) {
      ctx.addIssue({ code: 'custom', path: ['delivery_type'], message: 'delivery_type шаардлагатай (one_time захиалгад)' });
      return;
    }

    if (deliveryType === 'hotel' && !data.room_number) {
      ctx.addIssue({ code: 'custom', path: ['room_number'], message: 'Өрөөний дугаар хоосон байж болохгүй' });
    }
    if (deliveryType === 'hotel' && !data.hotel_name) {
      ctx.addIssue({ code: 'custom', path: ['hotel_name'], message: 'Буудлын нэр хоосон байж болохгүй' });
    }
    if (deliveryType === 'current_location' && !data.delivery_address) {
      ctx.addIssue({ code: 'custom', path: ['delivery_address'], message: 'Хүргэлтийн хаяг хоосон байж болохгүй' });
    }
  });

export const createMenuItemSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).nullish(),
  category: z.string().trim().max(50).nullish(),
  diet_type_id: uuidSchema('diet_type_id зөв UUID байх ёстой'),
  price_usd: z.number().positive('Үнэ 0-ээс их байх ёстой'),
  image_url: z.string().trim().max(500).nullish(),
  calories: z.number().int().positive().nullish(),
  allergens: z.array(z.string().trim().max(50)).nullish(),
  prep_time_min: z.number().int().positive().nullish(),
  is_featured: z.boolean().nullish(),
  is_addon_recommended: z.boolean().nullish(),
  restaurant_id: uuidSchema('restaurant_id зөв UUID байх ёстой'),
  stock_limit: z.number().int().nonnegative('Лимит 0-ээс их байх ёстой').nullish(),
});

export const updateMenuItemSchema = z.object({
  name: z.string().trim().min(1).max(150).nullish(),
  description: z.string().trim().max(1000).nullish(),
  category: z.string().trim().max(50).nullish(),
  diet_type_id: uuidSchema('diet_type_id зөв UUID байх ёстой').nullish(),
  price_usd: z.number().positive('Үнэ 0-ээс их байх ёстой').nullish(),
  image_url: z.string().trim().max(500).nullish(),
  calories: z.number().int().positive().nullish(),
  allergens: z.array(z.string().trim().max(50)).nullish(),
  prep_time_min: z.number().int().positive().nullish(),
  is_featured: z.boolean().nullish(),
  is_addon_recommended: z.boolean().nullish(),
  available: z.boolean().nullish(),
  restaurant_id: uuidSchema('restaurant_id зөв UUID байх ёстой').nullish(),
  stock_limit: z.number().int().nonnegative('Лимит 0-ээс их байх ёстой').nullish(),
});

export const updateRestaurantSchema = z.object({
  name: z.string().trim().min(1, 'Нэр хоосон байж болохгүй').max(100).nullish(),
  diet_type_id: uuidSchema('diet_type_id зөв UUID байх ёстой').nullish(),
  daily_order_limit: z.number().int().nonnegative('Лимит 0-ээс их байх ёстой').nullish(),
});

export const createRestaurantSchema = z.object({
  name: z.string().trim().min(1, 'Нэр хоосон байж болохгүй').max(100),
  daily_order_limit: z.number().int().nonnegative('Лимит 0-ээс их байх ёстой').nullish(),
});

export const dietTypeNameSchema = z.object({
  name: z.string().trim().min(1, 'Нэр хоосон байж болохгүй').max(50),
});

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menu_item_id: uuidSchema('menu_item_id зөв UUID байх ёстой'),
        quantity: z.number().int().positive('Тоо ширхэг 0-ээс их бүхэл тоо байх ёстой').max(100, 'Нэг захиалгаар хамгийн ихдээ 100 ширхэг авах боломжтой'),
        guest_name: z.string().trim().min(1).max(100).nullish(),
      })
    )
    .min(1, 'Захиалгад дор хаяж нэг зүйл байх ёстой'),
  // Зочны сонгосон "маргааш хэдэн цагт хүргэх вэ" цонх (delivery_time_slots.id).
  delivery_time_slot_id: uuidSchema('delivery_time_slot_id зөв UUID байх ёстой'),
});

// 'paid'-г зориудаар хассан — энэ статусыг зөвхөн баталгаажсан Hipay
// төлбөрийн урсгал (settleHipayCheckout, src/routes/payments.js) л
// тавьдаг байх ёстой, dashboard-ийн ажилтан гараар тавьж болохгүй.
export const updateOrderStatusSchema = z.object({
  status: z.string().transform(v => v.toLowerCase()).pipe(z.enum(['cancelled', 'refunded'])),
});

export const createPlanItemSchema = z.object({
  day_number: z.number().int().min(1, 'Өдөр 1-ээс их байх ёстой').max(365, 'Өдөр 365-аас бага байх ёстой'),
  meal_time: z.enum(['morning', 'lunch', 'evening'], { message: 'meal_time нь morning/lunch/evening байх ёстой' }),
  menu_item_id: uuidSchema('menu_item_id зөв UUID байх ёстой'),
});

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Огноо YYYY-MM-DD хэлбэртэй байх ёстой');

// POST /api/orders/plan — 12 хоногийн зочны сонголтууд. Үнэ болон сонголт хоёуланг
// нь серверт (админы twelve_day_plan_items-тэй тулгаж) дахин баталгаажуулна —
// энд зөвхөн формат шалгана.
export const createPlanOrderSchema = z.object({
  selections: z
    .array(
      z.object({
        plan_date: dateStringSchema,
        meal_time: z.enum(['morning', 'lunch', 'evening'], { message: 'meal_time нь morning/lunch/evening байх ёстой' }),
        menu_item_id: uuidSchema('menu_item_id зөв UUID байх ёстой'),
      })
    )
    .min(1, 'Дор хаяж нэг сонголт байх ёстой')
    .max(200, 'Сонголтын тоо хэтэрхий их байна'),
  addon_menu_item_id: uuidSchema('addon_menu_item_id зөв UUID байх ёстой').nullish(),
});

const timeStringSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Цаг HH:MM хэлбэртэй байх ёстой');

// PATCH /api/admin/delivery-time-slots/:id — admin эхлэх/дуусах цаг эсвэл
// идэвхтэй эсэхийг өөрчилнө. day/period солигдохгүй (3 цонх тогтмол) —
// зөвхөн цаг хүрээ болон идэвхжилтийг тохируулна.
export const updateDeliveryTimeSlotSchema = z.object({
  start_time: timeStringSchema.nullish(),
  end_time: timeStringSchema.nullish(),
  active: z.boolean().nullish(),
});

export const updatePlanCycleSchema = z.object({
  start_date: dateStringSchema,
  end_date: dateStringSchema,
}).refine(data => data.end_date >= data.start_date, {
  message: 'end_date нь start_date-ээс хожуу байх ёстой',
  path: ['end_date'],
});

export const adminLoginSchema = z.object({
  username: z.string().trim().min(1, 'Нэвтрэх нэр хоосон байж болохгүй').max(100),
  password: z.string().min(1, 'Нууц үг хоосон байж болохгүй').max(200),
});

// Зочин ↔ админ чатын нэг мессеж (chat.js болон admin.js хоёулаа ашиглана)
export const chatMessageSchema = z.object({
  message: z.string().trim().min(1, 'Мессеж хоосон байж болохгүй').max(1000, 'Мессеж хэт урт байна'),
});

// Зөвхөн 'hipay'-г л зөвшөөрнө — бусад gateway (2c2p/airwallex/bank/qpay)
// хараахан бодитоор холбогдоогүй тул зөвшөөрвөл /webhook/:provider-ийг
// (баталгаажуулалтгүй) ашиглаж хэн ч мөнгөгүйгээр захиалгыг "paid" болгож
// чадна (src/routes/payments.js).
export const paymentInitiateSchema = z.object({
  order_id: uuidSchema('order_id зөв UUID байх ёстой'),
  gateway_provider: z.string().transform(v => v.toLowerCase()).pipe(z.enum(['hipay'])),
});
