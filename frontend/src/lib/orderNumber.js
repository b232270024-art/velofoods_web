// src/services/orderNumber.js-тэй хослуулан ажиллана — захиалгын богино
// (8 тэмдэгт) дугаарыг хүмүүст ЗОРИУЛСАН харагдах/оруулах хэлбэрт хөрвүүлнэ.
// Хадгалагдаж буй утга зураас (-) агуулаагүй ("4XK9P2QW"); зураас нь зөвхөн
// уншихад хялбар болгох гоёл.

export function formatOrderNumber(code) {
  if (!code) return '';
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function normalizeOrderNumber(input) {
  return (input || '').trim().toUpperCase().replace(/[\s-]/g, '');
}
