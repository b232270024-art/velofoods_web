// 'Asia/Ulaanbaatar'-ийн орон нутгийн огноог 'YYYY-MM-DD' болгоно (fmtDate-тэй
// адил цагийн бүсээр) — admin хүснэгтүүдийн огнооны шүүлтүүр (<input type="date">
// from/to) болон Excel экспортод ижил тооцоолол ашиглахын тулд нэг дор байрлана.
export function toLocalDateStr(dateInput) {
  if (!dateInput) return null;
  return new Date(dateInput).toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
}

export function isWithinDateRange(dateInput, from, to) {
  const d = toLocalDateStr(dateInput);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}
