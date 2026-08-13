import { Router } from 'express';
import { pool } from '../db/pool.js';
import { validateBody, paymentInitiateSchema } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  createHipayCheckout,
  getHipayCheckoutStatus,
  buildHipayPaymentFormUrl,
  convertUsdForHipay,
} from '../services/hipay.js';

export const paymentsRouter = Router();

// Захиалгын үнийг доллараар авч, сонгосон gateway руу илгээх мөчид
// дуудагдана. Одоогоор зөвхөн hipay бодитоор холбогдсон
// (paymentInitiateSchema бусад gateway_provider утгыг зөвшөөрдөггүй).
paymentsRouter.post('/initiate', validateBody(paymentInitiateSchema), asyncHandler(async (req, res) => {
  const debugApi = process.env.DEBUG_API_ERRORS === '1';
  try {
    const { order_id, gateway_provider } = req.body;

    const order = await pool.query('SELECT * FROM orders WHERE id = $1', [order_id]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Захиалга олдсонгүй.' });

  if (gateway_provider === 'hipay') {
    const logger = req.app.get('logger');
    let amount, currency, fxRate;
    try {
      ({ amount, currency, fxRate } = await convertUsdForHipay(order.rows[0].total_usd));
    } catch (err) {
      req.app.get('logger').error('Hipay-д дүн хөрвүүлэхэд алдаа', { order_id, error: err.message });
      // 502/503/504 ашиглахгүй — Railway/Cloudflare зэрэг edge заримдаа эдгээр
      // "gateway" статустай хариултын JSON body-г өөрийн HTML алдааны
      // хуудсаар орлуулдаг тул frontend дээр "JSON.parse: unexpected
      // character" алдаа гарч, бодит алдааны мессеж хэрэглэгчид харагдахгүй
      // болдог байсан. 500-г edge intercept хийдэггүй тул body баталгаатай хүрнэ.
      return res.status(500).json({ error: 'Hipay тохиргоо эсвэл ханш авахад алдаа гарлаа.', details: err.message });
    }

    logger.info('Hipay checkout эхлүүлж байна', { order_id, amount, currency });

    let checkout;
    try {
      checkout = await createHipayCheckout({
        amount,
        redirectUri: process.env.HIPAY_REDIRECT_URI,
        webhookUrl: process.env.HIPAY_WEBHOOK_URL,
      });
    } catch (err) {
      // hipay.js-ийн rejection-ийг энд тодорхой лог хийж байж дараа нь
      // errorHandler руу дамжуулна (throw) — ингэснээр "юу ч логдоогүй" гэсэн
      // нөхцөл дахин давтагдахгүй.
      logger.error('Hipay checkout API дуудлага амжилтгүй боллоо', { order_id, error: err.message });
      throw err;
    }

    if (!checkout.checkoutId) {
      logger.error('Hipay checkout хариунд checkoutId алга', { order_id, checkout });
      return res.status(500).json({ error: 'Hipay checkout үүсгэж чадсангүй.', details: checkout.message || checkout.description });
    }

    logger.info('Hipay checkout амжилттай үүслээ', { order_id, checkoutId: checkout.checkoutId });

    const { rows } = await pool.query(
      `INSERT INTO payments (order_id, gateway_provider, currency, amount_usd, fx_rate_applied, transaction_id, status)
       VALUES ($1, 'hipay', $2, $3, $4, $5, 'pending') RETURNING *`,
      [order_id, currency, order.rows[0].total_usd, fxRate, checkout.checkoutId]
    );

    return res.status(201).json({
      ...rows[0],
      payment_form_url: buildHipayPaymentFormUrl(checkout.checkoutId),
    });
  }

  // Бусад gateway (2c2p/airwallex/bank/qpay) хараахан холбогдоогүй тул энд
  // хүрэхгүй ёстой (paymentInitiateSchema зөвхөн 'hipay'-г зөвшөөрдөг) — гэхдээ
  // fail-safe байдлаар тодорхой алдаа буцаана. Өмнө нь эдгээр provider-т
  // 'pending' payment мөр шууд үүсгээд transaction_id-г нь клиентэд буцаадаг
  // байсан нь /webhook/:provider (доор) руу хэн ч гараар {transaction_id,
  // status:'paid'} илгээгээд мөнгөгүйгээр захиалгыг "paid" болгож чадах
  // цоорхой байв.
  return res.status(400).json({ error: `"${gateway_provider}" gateway одоогоор холбогдоогүй байна.` });
  } catch (err) {
    const logger = req.app.get('logger');
    logger.error('payments.initiate handler error', { error: err.message, stack: err.stack });
    if (debugApi) {
      return res.status(err.status && err.status < 500 ? err.status : 500).json({ error: err.message, stack: err.stack });
    }
    throw err; // let global errorHandler handle it
  }
}));

// Hipay-ийн webhook/redirect хоёулаа signature-гүй тул зөвхөн checkoutId-г л
// найдвартай дамжуулдаг гэж үзэж, бодит статусыг ЭНД, Hipay-аас өөрөөс нь
// server-to-server дахин асууж баталгаажуулна. Хэн нэгэн webhook/redirect
// URL руу хуурамч хүсэлт илгээгээд захиалгыг "paid" болгож чадахгүй байхын
// цорын ганц баталгаа энэ функц.
async function settleHipayCheckout(checkoutId) {
  const hipayStatus = await getHipayCheckoutStatus(checkoutId);

  if (hipayStatus.status !== 'paid') return { settled: false, hipayStatus };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE payments
       SET status = 'paid', amount_charged_local = $1,
           paid_at = CASE WHEN status = 'paid' THEN paid_at ELSE now() END
       WHERE transaction_id = $2
       RETURNING *`,
      [hipayStatus.amount ?? null, checkoutId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return { settled: false, hipayStatus };
    }

    // status NOT IN (...) — auto-cancel cron (orderAutoCancel.js) 2 цагийн дотор
    // төлбөр ороогүй 'pending' захиалгыг цуцалдаг. Хэрэв яг тэр мөчид Hipay-ийн
    // хариу оройтож ирвэл (жишээ нь сүлжээ саатсан) энэ UPDATE аль хэдийн
    // цуцлагдсан/буцаагдсан захиалгыг гэнэт "paid" болгож сэргээхээс сэргийлнэ.
    await client.query(
      "UPDATE orders SET status = 'paid' WHERE id = $1 AND status NOT IN ('cancelled', 'refunded')",
      [result.rows[0].order_id]
    );
    await client.query('COMMIT');
    return { settled: true, hipayStatus, payment: result.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Hipay-ийн async webhook — GET хүсэлтээр checkoutId/paymentId ирдэг
// (HIPAY_WEBHOOK_URL). Найдвартай эх сурвалж болгож ашиглах ёстой сувг,
// гэхдээ дотор нь баталгаажуулалт (settleHipayCheckout) заавал дуудна.
paymentsRouter.get('/webhook/hipay', asyncHandler(async (req, res) => {
  const { checkoutId } = req.query;
  if (!checkoutId) return res.status(400).end();

  try {
    await settleHipayCheckout(checkoutId);
  } catch (err) {
    req.app.get('logger').error('Hipay webhook боловсруулахад алдаа', { error: err.message, checkoutId });
    return res.status(500).end();
  }

  res.status(200).end();
}));

// Hipay-ийн payment FORM-оос төлбөр хийж дууссаны дараа хэрэглэгчийн
// browser-ийг буцаадаг redirect_uri (HIPAY_REDIRECT_URI). Энэ бол зөвхөн
// UX-д зориулсан сувг — эцсийн эх сурвалж биш тул энд ч бас
// settleHipayCheckout-оор дахин баталгаажуулна (webhook-той давхацсан ч
// UPDATE идемпотент тул асуудалгүй).
//
// developers.hipay.mn-ийн sequence diagram-аар баталгаажуулснаар Hipay
// хэрэглэгчийн browser-ийг бидний бүртгүүлсэн redirect_uri рүү шууд биш,
// харин "{return_uri}/{checkoutId}/{paymentId}" гэж URL-ийн ЗАМ (path)-д
// checkoutId/paymentId-г залгаж нэмээд буцаадаг (query string ч биш, JSON
// body ч биш). Өмнө нь зөвхөн req.query/req.body-оос checkoutId хайдаг
// байсан тул энэ path segment-ийг огт олохгүй, "payment=error" болж
// байсан нь "амжилттай гүйлгээ хаалтын алхам руу ороогүй" гэдэг багийн үнэн
// шалтгаан байв. Одоо path param-ыг эхэнд нь шалгаж, хуучин query/body
// хэлбэрийг ч зэрэгцүүлэн дэмжинэ (аль ч хувилбараар ирсэн ч ажиллана).
async function handleHipayRedirect(req, res) {
  const checkoutId = req.params.checkoutId || req.query.checkoutId || req.body?.checkoutId;
  const frontendBase = process.env.FRONTEND_URL || '';

  if (!checkoutId) return res.redirect(`${frontendBase}/?payment=error`);

  const existing = await pool.query('SELECT order_id FROM payments WHERE transaction_id = $1', [checkoutId]);
  const orderId = existing.rows[0]?.order_id ?? null;

  let hipayStatus = { status: 'unknown' };
  try {
    ({ hipayStatus } = await settleHipayCheckout(checkoutId));
  } catch (err) {
    req.app.get('logger').error('Hipay redirect боловсруулахад алдаа', { error: err.message, checkoutId });
  }

  res.redirect(`${frontendBase}/?order_id=${orderId ?? ''}&payment=${hipayStatus.status}`);
}

paymentsRouter.get('/hipay/redirect/:checkoutId/:paymentId', asyncHandler(handleHipayRedirect));
paymentsRouter.post('/hipay/redirect/:checkoutId/:paymentId', asyncHandler(handleHipayRedirect));
paymentsRouter.get('/hipay/redirect', asyncHandler(handleHipayRedirect));
paymentsRouter.post('/hipay/redirect', asyncHandler(handleHipayRedirect));

// Гараагүй gateway-уудад (2c2p/airwallex/bank/qpay) зориулсан webhook — эдгээр
// одоогоор бодитоор холбогдоогүй тул ЗОРИУДААР идэвхгүй (404). Өмнө нь энэ
// route req.body-оос ирсэн {transaction_id, status} хос-г ямар ч signature/
// баталгаажуулалтгүйгээр шууд итгэж payments.status болон orders.status-ыг
// 'paid' болгодог байсан — /api/payments/initiate-аар ямар ч (жинхэнэ бус)
// gateway_provider-аар "pending" payment мөр үүсгээд түүний transaction_id-г
// уншаад энэ route руу дахин илгээхэд хэн ч мөнгөгүйгээр захиалгаа "paid"
// болгож чаддаг байсан (paymentInitiateSchema одоо зөвхөн 'hipay'-г
// зөвшөөрдөг болсон ч энэ route дангаараа мөн адил эмзэг хэвээр байсан тул
// хамтад нь хаав). hipay зөвхөн /webhook/hipay (GET, доор) болон
// /hipay/redirect-ээр л баталгаажина — тэдгээр нь Hipay-аас өөрөөс нь
// server-to-server дахин баталгаажуулдаг (settleHipayCheckout).
paymentsRouter.post('/webhook/:provider', (req, res) => {
  res.status(404).json({ error: `"${req.params.provider}" gateway одоогоор холбогдоогүй байна.` });
});
