// Express-ийн сүүлчийн middleware — routes дотор баригдаагүй ямар ч алдаа
// эндэрэ ирнэ. Процессыг унагаахгүйгээр логдож, хэрэглэгчид ойлгомжтой,
// дотоод дэлгэрэнгүй мэдээлэл (stack trace гэх мэт) агуулаагүй хариу өгнө.
export function errorHandler(err, req, res, next) {
  const logger = req.app.get('logger');
  logger.error('Барьж амжаагүй алдаа', {
    error: err.message,
    code: err.code,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (res.headersSent) return next(err);

  // PostgreSQL invalid input syntax (e.g. invalid UUID format)
  if (err.code === '22P02') {
    return res.status(400).json({
      error: 'Ирсэн ID эсвэл параметр буруу форматтай байна (UUID).',
    });
  }

  // DB холболтын алдаа. Анх 503 (Service Unavailable) ашигладаг байсан ч
  // Railway/Cloudflare зэрэг edge заримдаа 502/503/504-г "gateway" статус гэж
  // үзээд origin-ы буцаасан JSON body-г өөрийн HTML алдааны хуудсаар
  // орлуулдаг — тэгэхээр frontend хариултаа JSON.parse хийж чадахгүй болж,
  // хэрэглэгчид ямар ч ойлгомжтой алдааны мессеж харагдахгүй болдог байв.
  // 500 статусыг edge intercept хийдэггүй тул үүнийг ашиглана.
  const isConnErr = err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' ||
                    err.code === 'ETIMEDOUT' || err.code === 'EPIPE' ||
                    (err.message && (err.message.includes('SSL') ||
                                     err.message.includes('connect ECONNREFUSED') ||
                                     err.message.includes('Connection terminated')));
  if (isConnErr) {
    return res.status(500).json({
      error: 'Өгөгдлийн санд холбогдоход алдаа гарлаа. Дахин оролдоно уу.',
    });
  }

  const status = err.status && err.status < 500 ? err.status : 500;
  res.status(status).json({
    error: 'Серверийн дотоод алдаа гарлаа. Дахин оролдоно уу.',
  });
}

// Express дотор async route handler-аас гарсан алдааг Promise reject
// хэлбэрээр автоматаар errorHandler руу дамжуулах туслах функц.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
