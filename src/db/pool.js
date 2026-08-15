import pg from 'pg';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

let isPgConnected = false;
let realPool = null;

// TLS сертификатыг бүрэн баталгаажуулж (rejectUnauthorized: true) нэг удаа
// урьдчилан холбогдож үзнэ. Railway зэрэг зарим managed Postgres нь
// self-signed сертификат ашигладаг тул үүнийг урьдчилан мэдэхгүйгээр шууд
// rejectUnauthorized: true болгочихвол production DB-рүү огт холбогдохгүй
// (сайт бүхэлдээ унах) эрсдэлтэй. Тиймээс: боломжтой бол (олон нийтийн CA-аар
// баталгаажсан сертификат) бүрэн баталгаажуулалттайгаар ажиллуулж, зөвхөн
// итгэлийн гинжийг батлах боломжгүй (self-signed) тохиолдолд л тодорхой
// анхааруулга логтойгоор хуучин (rejectUnauthorized: false) горимд буцна —
// аль ч тохиолдолд процесс/сервер унахгүй.
async function probeVerifiedSsl(connectionString) {
  const probeClient = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 5000,
  });
  try {
    await probeClient.connect();
    await probeClient.end();
    return true;
  } catch (err) {
    const msg = (err && err.message) || '';
    const isCertTrustError = ['SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(err.code) ||
      /self.signed|unable to verify|unable to get local issuer|certificate/i.test(msg);
    if (isCertTrustError) {
      console.log('⚠️ DB TLS сертификатыг олон нийтийн CA-аар баталгаажуулж чадсангүй (магадгүй self-signed) — MITM-ээс хамгаалахын тулд Railway/DB-ийн CA сертификатыг PGSSLROOTCERT-т зааж өгөхийг зөвлөж байна. Одоохондоо rejectUnauthorized:false горимд ажиллана:', msg);
    } else {
      console.log('DB TLS баталгаажуулалтын урьдчилсан шалгалт амжилтгүй (өөр шалтгаанаар, жишээ нь сүлжээ/нэвтрэлт) — rejectUnauthorized:false горимд ажиллана:', msg);
    }
    return false;
  }
}

// Railway болон бусад cloud platform дээр DATABASE_URL нь SSL шаардах тул
// sslmode=require эсвэл tls option-г автоматаар олж тогтооно.
if (process.env.DATABASE_URL) {
  const isLocalhost = process.env.DATABASE_URL.includes('localhost') ||
                      process.env.DATABASE_URL.includes('127.0.0.1');
  // Заавал PGSSLROOTCERT (эсвэл DATABASE_URL-ийн sslrootcert параметр)-аар
  // CA файл зааж өгсөн бол node-postgres үүнийг өөрөө уншиж баталгаажуулна —
  // тэр тохиолдолд урьдчилсан шалгалт хийх шаардлагагүй.
  const hasExplicitCaCert = Boolean(process.env.PGSSLROOTCERT);
  const useVerifiedSsl = isLocalhost || hasExplicitCaCert
    ? true
    : await probeVerifiedSsl(process.env.DATABASE_URL);
  if (!isLocalhost && useVerifiedSsl && !hasExplicitCaCert) {
    console.log('✅ DB TLS сертификат олон нийтийн CA-аар баталгаажлаа — rejectUnauthorized:true ашиглаж байна.');
  }
  realPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    // Query/statement-д цаг хугацааны хязгаар өгөхгүй бол сервер эсвэл сүлжээ
    // саатах үед Node хариу хүлээгээд зогсчихдог — Railway-ийн edge gateway
    // ~25с-д 502 буцаадаг ч манай процесс дотроо ХҮЛЭЭСЭЭР байдаг тул client
    // огт ойлгомжтой алдаа авдаггүй байсан. Эндээс тодорхой алдаа (500) хурдан
    // буцаахын тулд:
    statement_timeout: 15000,
    query_timeout: 20000,
    // Идэвхгүй connection 10 секундэд хаагддаг (pg-ийн анхны утга) тул удаан
    // хугацааны зайтай (admin dashboard гэх мэт) хүсэлт бүр шинэ TCP/TLS
    // холболт нээж, эхний хүсэлт удаан болдог байсан — idle-г уртасгаж,
    // TCP keep-alive асаана.
    idleTimeoutMillis: 30000,
    keepAlive: true,
    ssl: isLocalhost ? false : { rejectUnauthorized: useVerifiedSsl },
  });

  // node-postgres нь idle client сүлжээний алдаатай таарвал pool дээр 'error'
  // event ялгаруулдаг — сонсогч (listener) байхгүй бол Node үүнийг barigdaagүй
  // алдаа гэж үзээд БҮХ процессыг унагаана (payments route-той ижил урсгал дээр
  // ажилладаг websocket холболтуудыг ч хамт live-аас унагасан өмнөх production
  // incident-той яг адил эвдрэлийн хэлбэр). Энд зөвхөн логдоод, дараагийн query
  // үед pool өөрөө шинэ connection нээх тул нэмэлт сэргээх код шаардлагагүй.
  realPool.on('error', (err) => {
    console.log('⚠️ PostgreSQL pool-д idle client дээр гэнэтийн алдаа гарлаа (процесс амьд үлдэнэ):', err.message);
  });
}

// In-Memory Database Store as fallback if PostgreSQL is not configured or offline.
// ⚠️ Зөвхөн DATABASE_URL тохируулаагүй/холбогдоогүй үед л ашиглагдана — бодит
// route-уудын SQL-тэй бүрэн синк биш (жишээ нь hotels-той холбоотой хэсгүүд
// hotels table устсаны дараа хэзээ ч дуудагдахгүй тул хассан). Хөгжүүлэлтэд
// үргэлж бодит Postgres (.env-ийн DATABASE_URL) ашиглахыг зөвлөнө.
const inMemoryDb = {
  sessions: [],
  menu_items: [
    { id: uuidv4(), name: 'Стейк (Ribeye Steak 300g)', category: 'Гол хоол', price_usd: 28.00, available: true },
    { id: uuidv4(), name: 'Цезарь Салат (Caesar Salad)', category: 'Зууш & Салат', price_usd: 12.50, available: true },
    { id: uuidv4(), name: 'Клуб Сендвич (Club Sandwich)', category: 'Зууш & Салат', price_usd: 14.00, available: true },
    { id: uuidv4(), name: 'Бургер ба Фри (Cheeseburger & Fries)', category: 'Гол хоол', price_usd: 16.50, available: true },
    { id: uuidv4(), name: 'Улаан дарс (Red Wine - Pinot Noir)', category: 'Уух зүйлс', price_usd: 10.00, available: true },
    { id: uuidv4(), name: 'Шинэхэн Жимсний Шүүс (Fresh Juice)', category: 'Уух зүйлс', price_usd: 6.00, available: true },
    { id: uuidv4(), name: 'Чизкейк (New York Cheesecake)', category: 'Дессерт', price_usd: 8.50, available: true }
  ],
  orders: [],
  order_items: [],
  payments: []
};

// Check PostgreSQL connection with retry
async function tryConnect(attempt = 1) {
  if (!realPool) return;
  try {
    await realPool.query('SELECT 1');
    isPgConnected = true;
    console.log('✅ PostgreSQL өгөгдлийн сантай амжилттай холбогдлоо.');
  } catch (err) {
    const maxAttempts = 5;
    if (attempt < maxAttempts) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`⚠️ PostgreSQL холболт амжилтгүй (${attempt}/${maxAttempts}). ${delay}ms-д дахин оролдоно... [${err.message}]`);
      setTimeout(() => tryConnect(attempt + 1), delay);
    } else {
      console.log(`❌ PostgreSQL ${maxAttempts} удаа оролдсоны дараа холбогдож чадсангүй. In-Memory сан руу шилжлээ. Алдаа: ${err.message}`);
    }
  }
}
tryConnect();

async function handleInMemoryQuery(text, params = []) {
  const sql = text.trim().replace(/\s+/g, ' ');

  // 3. INSERT INTO sessions
  if (sql.startsWith('INSERT INTO sessions')) {
    const newSession = {
      id: uuidv4(),
      hotel_id: params[0],
      guest_name: params[1],
      room_number: params[2],
      location_verified: Boolean(params[3]),
      geo_lat: params[4] || null,
      geo_lng: params[5] || null,
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString()
    };
    inMemoryDb.sessions.push(newSession);
    return { rows: [newSession] };
  }

  // 4. SELECT menu_items
  if (sql.includes('FROM menu_items WHERE hotel_id = $1')) {
    const items = inMemoryDb.menu_items.filter(m => m.hotel_id === params[0] || true);
    return { rows: items };
  }

  // 5. INSERT INTO menu_items
  if (sql.startsWith('INSERT INTO menu_items')) {
    const newItem = {
      id: uuidv4(),
      hotel_id: params[0],
      name: params[1],
      category: params[2],
      price_usd: params[3],
      available: true
    };
    inMemoryDb.menu_items.push(newItem);
    return { rows: [newItem] };
  }

  // 6. SELECT price_usd FROM menu_items
  if (sql.includes('FROM menu_items WHERE id = $1')) {
    const item = inMemoryDb.menu_items.find(m => m.id === params[0]);
    return { rows: item ? [item] : [] };
  }

  // 7. INSERT INTO orders
  if (sql.startsWith('INSERT INTO orders')) {
    const newOrder = {
      id: uuidv4(),
      session_id: params[0],
      hotel_id: params[1],
      status: 'pending',
      total_usd: 0,
      created_at: new Date().toISOString()
    };
    inMemoryDb.orders.push(newOrder);
    return { rows: [newOrder] };
  }

  // 8. INSERT INTO order_items
  if (sql.startsWith('INSERT INTO order_items')) {
    const newOrderItem = {
      id: uuidv4(),
      order_id: params[0],
      menu_item_id: params[1],
      guest_name: params[2],
      quantity: params[3],
      unit_price_usd: params[4]
    };
    inMemoryDb.order_items.push(newOrderItem);
    return { rows: [newOrderItem] };
  }

  // 9. UPDATE orders SET total_usd = $1 WHERE id = $2
  if (sql.startsWith('UPDATE orders SET total_usd = $1')) {
    const order = inMemoryDb.orders.find(o => o.id === params[1]);
    if (order) order.total_usd = params[0];
    return { rows: order ? [order] : [] };
  }

  // 10. UPDATE orders SET status = $1 WHERE id = $2
  if (sql.startsWith('UPDATE orders SET status = $1')) {
    const order = inMemoryDb.orders.find(o => o.id === params[1]);
    if (order) order.status = params[0];
    return { rows: order ? [order] : [] };
  }

  // 11. SELECT * FROM orders WHERE id = $1
  if (sql.includes('FROM orders WHERE id = $1')) {
    const order = inMemoryDb.orders.find(o => o.id === params[0]);
    return { rows: order ? [order] : [] };
  }

  // 12. SELECT orders live
  if (sql.includes('FROM orders o')) {
    const rows = inMemoryDb.orders
      .filter(o => o.status !== 'cancelled')
      .map(o => {
        const sess = inMemoryDb.sessions.find(s => s.id === o.session_id) || {};
        return {
          id: o.id,
          status: o.status,
          total_usd: o.total_usd,
          created_at: o.created_at,
          room_number: sess.room_number || '305',
          guest_name: sess.guest_name || 'Guest'
        };
      });
    return { rows };
  }

  // 13. INSERT INTO payments
  if (sql.startsWith('INSERT INTO payments')) {
    const newPay = {
      id: uuidv4(),
      order_id: params[0],
      gateway_provider: params[1],
      currency: 'USD',
      amount_usd: params[2],
      transaction_id: params[3],
      status: 'pending'
    };
    inMemoryDb.payments.push(newPay);
    return { rows: [newPay] };
  }

  // 14. UPDATE payments
  if (sql.startsWith('UPDATE payments')) {
    const pay = inMemoryDb.payments.find(p => p.transaction_id === params[3]);
    if (pay) pay.status = params[0];
    return { rows: pay ? [pay] : [] };
  }

  return { rows: [] };
}

// Холболтын алдааны кодууд — эдгээр гарвал дахин холбогдоно
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT',
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
]);

export const pool = {
  query: async (text, params) => {
    if (realPool) {
      try {
        const res = await realPool.query(text, params);
        if (!isPgConnected) {
          isPgConnected = true;
          console.log('✅ PostgreSQL өгөгдлийн сантай амжилттай холбогдлоо.');
        }
        return res;
      } catch (err) {
        const isConnErr = CONNECTION_ERROR_CODES.has(err.code) ||
                         (err.message && (err.message.includes('connect ECONNREFUSED') ||
                                          err.message.includes('terminating connection') ||
                                          err.message.includes('Connection terminated')));
        // Холбогдоогүй үед буюу connection алдаа гарвал in-memory fallback
        if (!isPgConnected || isConnErr) {
          if (isPgConnected) {
            console.log('⚠️ PostgreSQL холболт тасарсан тул санах ойн сан руу шилжлээ. Дахин холбогдоно...');
            isPgConnected = false;
            // Background-д дахин холбогдоно
            setTimeout(() => tryConnect(), 2000);
          }
          return handleInMemoryQuery(text, params);
        }
        // Query алдаа (syntax, constraint гэх мэт) — шидэж гаргана
        throw err;
      }
    }
    return handleInMemoryQuery(text, params);
  },
  connect: async () => {
    if (isPgConnected && realPool) {
      try {
        const client = await realPool.connect();
        return client;
      } catch (err) {
        // Fallback mock client
      }
    }

    return {
      query: async (text, params) => handleInMemoryQuery(text, params),
      release: () => {}
    };
  },
  end: async () => {
    if (realPool) await realPool.end();
  }
};
