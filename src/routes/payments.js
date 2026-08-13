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
// дуудагдана. hipay бол бодит checkout API дуудна; бусад gateway
// (2C2P/Airwallex/банк) хараахан холбогдоогүй тул placeholder хэвээр.
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
      return res.status(502).json({ error: 'Hipay тохиргоо эсвэл ханш авахад алдаа гарлаа.', details: err.message });
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
      return res.status(502).json({ error: 'Hipay checkout үүсгэж чадсангүй.', details: checkout.message || checkout.description });
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

  // TODO: бусад gateway (2c2p/airwallex/bank/qpay) холбогдох
  const placeholderTransactionId = `pending_${order_id}_${Date.now()}`;

    const { rows } = await pool.query(
      `INSERT INTO payments (order_id, gateway_provider, currency, amount_usd, transaction_id, status)
       VALUES ($1, $2, 'USD', $3, $4, 'pending') RETURNING *`,
      [order_id, gateway_provider, order.rows[0].total_usd, placeholderTransactionId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    const logger = req.app.get('logger');
    logger.error('payments.initiate handler error', { error: err.message, stack: err.stack });
    if (debugApi) {
      return res.status(err.status || 502).json({ error: err.message, stack: err.stack });
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

    await client.query("UPDATE orders SET status = 'paid' WHERE id = $1", [result.rows[0].order_id]);
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

// Гараагүй gateway-уудад (2c2p/airwallex/bank/qpay) зориулсан placeholder
// webhook — эдгээрийг бодитоор холбосон код одоогоор байхгүй тул энэ route
// хараахан хэрэглэгддэггүй. hipay-г ЭНД зайлсхийж байгаа шалтгаан: hipay-ийн
// webhook/redirect хоёулаа signature-гүй тул payment=paid статусыг зөвхөн
// Hipay-аас өөрөөс нь server-to-server дахин баталгаажуулсны дараа
// (settleHipayCheckout) л зөвшөөрдөг. Хэрэв provider='hipay'-г энд ч бас
// зөвшөөрвөл хэн ч энэ route руу шууд {transaction_id, status:'paid'}
// хуурамч хүсэлт илгээгээд баталгаажуулалтгүйгээр захиалгыг "paid" болгож
// чадах нээлттэй цоорхой болно.
paymentsRouter.post('/webhook/:provider', async (req, res) => {
  if (req.params.provider === 'hipay') {
    return res.status(404).json({ error: 'hipay зөвхөн /webhook/hipay (GET) болон /hipay/redirect-ээр баталгаажина.' });
  }

  const { transaction_id, status, amount_charged_local, fx_rate_applied } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE payments
       SET status = $1, amount_charged_local = $2, fx_rate_applied = $3,
           paid_at = CASE WHEN $1 = 'paid' THEN now() ELSE paid_at END
       WHERE transaction_id = $4
       RETURNING *`,
      [status, amount_charged_local ?? null, fx_rate_applied ?? null, transaction_id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Гүйлгээ олдсонгүй.' });
    }

    if (status === 'paid') {
      await client.query("UPDATE orders SET status = 'paid' WHERE id = $1", [
        result.rows[0].order_id,
      ]);
    }

    await client.query('COMMIT');
    res.json({ received: true });
  } catch (err) {
    await client.query('ROLLBACK');
    req.app.get('logger').error('Webhook алдаа', { error: err.message, transaction_id });
    res.status(500).json({ error: 'Webhook боловсруулахад алдаа гарлаа.' });
  } finally {
    client.release();
  }
});
