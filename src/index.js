import express from 'express';
import helmet from 'helmet';
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
app.use(cookieParser());
app.use(generalLimiter);

const frontendDistPath = path.join(__dirname, '../frontend/dist');
const publicPath = path.join(__dirname, '../public');

// байх ёстой — өмнө нь frontend/dist байгаа үед (production дээр үргэлж тийм)
// public/-г огт serve хийдэггүй байсан тул /uploads/* хэзээ ч ажилладаггүй баг
// байсан (express.static тохирохгүй үед next()-рүү дамждаг тул SPA catch-all
// route index.html-г буцаадаг байсан — 200 ирдэг ч бодит зураг биш).
// Дараалал чухал: frontend/dist эхэнд байх ёстой — public/index.html нь
// хуучин (React-аас өмнөх) хувилбар тул дараа нь байрлуулбал нүүр хуудсыг
// халхлана.
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
}
app.use(express.static(publicPath));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: allowedOrigins, credentials: true } });
app.set('io', io);

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
});

// Session болон захиалга үүсгэх зэрэг "бичих" endpoint-д илүү хатуу rate limit
app.use('/api/sessions', writeLimiter, sessionsRouter);
app.use('/api/menu', menuRouter);
app.use('/api/orders', writeLimiter, ordersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/payments', writeLimiter, paymentsRouter);
app.use('/api/geocode', geocodeRouter);
app.use('/api/upload', uploadRouter);

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
