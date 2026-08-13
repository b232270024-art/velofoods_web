import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';

import { sessionsRouter } from './routes/sessions.js';
import { menuRouter } from './routes/menu.js';
import { ordersRouter } from './routes/orders.js';
import { adminRouter } from './routes/admin.js';
import { paymentsRouter } from './routes/payments.js';
import { geocodeRouter } from './routes/geocode.js';
import { uploadRouter } from './routes/upload.js';
import { chatRouter } from './routes/chat.js';
import { uuidPattern } from './middleware/validation.js';

import { logger } from './services/logger.js';
import { startSessionCleanupJob } from './services/sessionCleanup.js';
import { startOrderAutoCancelJob } from './services/orderAutoCancel.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalLimiter, writeLimiter } from './middleware/rateLimiter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('logger', logger);
// Railway зэрэг reverse proxy-н цаана ажилладаг тул X-Forwarded-For-г итгэж,
// зөв client IP-г ашиглахын тулд шаардлагатай (rate limiter, secure cookie-д нөлөөлнө)
app.set('trust proxy', 1);

// Ерөнхий HTTP security header-ууд (X-Content-Type-Options, X-Frame-Options,
// HSTS гэх мэт). CSP-г зориудаар унтраасан — Google Fonts, Hipay-ийн
// redirect, Cloudflare-ийн analytics script зэрэг гадаад эх сурвалжуудыг
// цоожлохгүйгээр зөв тохируулах нь тусдаа нухацтай ажил тул яаравчлан
// буруу тохируулж сайтыг эвдэхээс зайлсхийв.
app.use(helmet({ contentSecurityPolicy: false }));
// JS/CSS/HTML хариултыг gzip/brotli-аар шахна — зурагнууд аль хэдийн webp
// хэлбэрээр шахагдсан тул compression-д дахин хамрагдахгүй (аль хэдийн
// шахсан өгөгдлийг дахин шахах нь ашиггүй тул filter нь зурагны
// content-type-г автоматаар алгасдаг).
app.use(compression());

// cors тохиргоо — cookie ашиглаж байгаа тул credentials зөвшөөрөх шаардлагатай.
// Frontend болон API нэг Express app-аас (нэг origin-оос) serve хийгддэг тул
// бодит хэрэглээнд cross-origin хүсэлт огт хэрэггүй — same-origin хүсэлтэд
// CORS header-ийн ямар ч утга нөлөөлдөггүй (browser зөвхөн cross-origin-д
// шалгадаг). Тиймээс CORS_ORIGIN зааж өгөөгүй үед wildcard-аар "аль ч сайт
// зөвшөөрнө" гэхийн оронд ХААХ нь зөв (аюулгүй анхны утга) — зөвхөн
// тодорхой домэйн(ууд)-г (таслалаар тусгаарлаж) CORS_ORIGIN-д зааснаар л
// нээгдэнэ.
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
// Hipay зэрэг зарим gateway хэрэглэгчийн browser-ийг redirect_uri рүү HTML
// form-аар (application/x-www-form-urlencoded) POST хийж буцаадаг тул
// express.json() дангаараа хангалтгүй — үгүй бол req.body хоосон үлдэж,
// /api/payments/hipay/redirect дээр checkoutId олдохгүй алдаанд орно.
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(generalLimiter);

const frontendDistPath = path.join(__dirname, '../frontend/dist');
const publicPath = path.join(__dirname, '../public');

// Static хариултад Cache-Control нэмнэ — өмнө нь ямар ч Cache-Control
// header ирдэггүй байсан тул browser хуудас нээх бүрд бүх зураг/JS/CSS-г
// (аль хэдийн disk cache-д байгаа хэдий ч) серверээс дахин баталгаажуулж
// (conditional GET, 304) байсан нь давтан зочлоход зурагнууд удаан
// "ачаалагдаж байгаа мэт" харагдах гол шалтгаан байв.
//   - /assets/*  : Vite-ийн build хийсэн файлууд, нэрэндээ content-hash
//     агуулдаг (жишээ: index-bb884b87.js) тул агуулга өөрчлөгдвөл файлын
//     нэр өөрчлөгддөг — эсрэгээрээ мөнхөд cache хийж болно (immutable).
//   - /uploads/* : admin-аас upload хийсэн зураг бүр өвөрмөц (timestamp +
//     random) нэртэй, ач ирээдүйд дахин бичигдэхгүй тул мөн мөнхөд
//     cache хийж болно.
//   - бусад (жишээ нь /images/*.webp) : нэр нь тогтмол (агуулга солигдвол
//     нэр солигдохгүй байж болзошгүй) тул дунд зэргийн (7 хоног) хугацаагаар
//     л cache хийж, шинэчлэлт хэт удаан "хоцрохоос" сэргийлнэ.
//   - .html файлууд : hашлагдсан assets-рүү заадаг тул шинэ deploy бүрд
//     шууд шинэчлэгдэх ёстой — cache хийхгүй.
function setStaticCacheHeaders(res, filePath) {
  if (filePath.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache');
  } else if (filePath.includes(`${path.sep}assets${path.sep}`) || filePath.includes(`${path.sep}uploads${path.sep}`)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=604800');
  }
}

// байх ёстой — өмнө нь frontend/dist байгаа үед (production дээр үргэлж тийм)
// public/-г огт serve хийдэггүй байсан тул /uploads/* хэзээ ч ажилладаггүй баг
// байсан (express.static тохирохгүй үед next()-рүү дамждаг тул SPA catch-all
// route index.html-г буцаадаг байсан — 200 ирдэг ч бодит зураг биш).
// Дараалал чухал: frontend/dist эхэнд байх ёстой — public/index.html нь
// хуучин (React-аас өмнөх) хувилбар тул дараа нь байрлуулбал нүүр хуудсыг
// халхлана.
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath, { setHeaders: setStaticCacheHeaders }));
}
app.use(express.static(publicPath, { setHeaders: setStaticCacheHeaders }));

const httpServer = createServer(app);
// If no CORS_ORIGIN is configured, allow same-origin / default behavior for sockets
const ioCors = allowedOrigins.length ? { origin: allowedOrigins, credentials: true } : { origin: true, credentials: true };
const io = new Server(httpServer, { cors: ioCors });
app.set('io', io);

// Log Engine.IO connection errors (useful when websocket upgrade fails)
if (io.engine && typeof io.engine.on === 'function') {
  io.engine.on('connection_error', (err) => {
    logger.error('Socket engine connection_error', { error: err && err.message });
  });
}

// Log HTTP upgrade events/errors to help debug reverse-proxy websocket issues
httpServer.on('upgrade', (req, socket, head) => {
  // Log the upgrade request path and headers at a debug level
  logger.debug('HTTP upgrade request', { url: req.url, headers: req.headers });
});

// 'admin' өрөө нь захиалгын PII (зочны нэр, өрөө, дэлгэрэнгүй) агуулсан
// real-time event дамжуулдаг тул зөвхөн бодитоор нэвтэрсэн admin л нэгдэж
// болно — эс бөгөөс хэн ч browser console-оос socket.io холбогдоод
// `emit('admin:join')` дуудаад нэвтрэлтгүйгээр бүх захиалгыг чагнах боломжтой
// байсан (нэвтрэлт огт шалгадаггүй байсан баг). admin_token cookie нь
// httpOnly учир зөвхөн legitimate browser session-оос (same-origin
// socket.io холболтод cookie автоматаар дамждаг) ирнэ.
function verifyAdminSocket(socket) {
  try {
    const rawCookie = socket.handshake.headers.cookie;
    if (!rawCookie) return false;
    const { admin_token: token } = parseCookie(rawCookie);
    if (!token) return false;
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

// Admin dashboard клиент нэг л 'admin' өрөөнд subscribe хийнэ (нэг л hotel-тэй
// ажилладаг тул hotel_id-аар тусгаарлах шаардлагагүй болсон).
io.on('connection', (socket) => {
  socket.on('admin:join', () => {
    if (!verifyAdminSocket(socket)) {
      logger.warn('Нэвтрэлтгүй admin:join оролдлого', { socketId: socket.id, ip: socket.handshake.address });
      return;
    }
    socket.join('admin');
  });
  socket.on('join:room', (roomNumber) => {
    socket.join(`room:${roomNumber}`);
  });
  // Захиалгын ID нь өөрөө "нэвтрэх түлхүүр" болдог тул (доорх chat route-уудтай
  // адил) нэмэлт баталгаажуулалт шаардахгүй — зөвхөн формат шалгана.
  socket.on('chat:join', (orderId) => {
    if (typeof orderId === 'string' && uuidPattern.test(orderId)) {
      socket.join(`chat:${orderId}`);
    }
  });
});

// Session болон захиалга үүсгэх зэрэг "бичих" endpoint-д илүү хатуу rate limit
app.use('/api/sessions', writeLimiter, sessionsRouter);
app.use('/api/menu', menuRouter);
app.use('/api/orders', writeLimiter, ordersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/payments', writeLimiter, paymentsRouter);
app.use('/api/geocode', geocodeRouter);
// Бусад "бичих" route-уудтай адил rate limit тавьсан — өмнө нь upload
// endpoint дээр огт хязгаар байгаагүй (зөвхөн requireAdmin шалгадаг байсан)
// тул нэг admin session алдагдвал/эсвэл frontend-д давхар дарагдах bug
// гарвал disk дүүртэл дараалан upload хийгдэх боломжтой байв.
app.use('/api/upload', writeLimiter, uploadRouter);
app.use('/api/chat', writeLimiter, chatRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

// SPA fallback for React frontend
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return next();
  }
  if (fs.existsSync(path.join(frontendDistPath, 'index.html'))) {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  } else {
    res.sendFile(path.join(publicPath, 'index.html'));
  }
});

// Global error handler — routes дотор баригдаагүй ямар ч алдаа эндэрэ ирнэ.
// Заавал сүүлд бичигдэх ёстой (бусад бүх middleware/route-ийн дараа).
app.use(errorHandler);

startSessionCleanupJob(logger);
startOrderAutoCancelJob(logger, io);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  logger.info(`Backend ажиллаж байна: http://localhost:${PORT}`);
});
