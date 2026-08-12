import { randomInt } from 'crypto';

// Зочид болон admin-д "танигдахуйц" богино захиалгын дугаар — уг UUID
// (orders.id) хэвээрээ PRIMARY KEY/FK бүхэн дээр үлдэнэ, харин энэ дугаар
// зөвхөн хүмүүст ХАРУУЛАХ/ОРУУЛАХ зориулалттай (жишээ нь чат нээхэд).
//
// Тэмдэгтийн сан: 0/O, 1/I/L зэрэг харагдахад ялгаагүй тэмдэгтүүдийг
// хассан 31 тэмдэгт. 8 тэмдэгт ~852 тэрбум хослол өгдөг тул богино атлаа
// таамаглаж (brute-force) олоход бараг боломжгүй хэвээр байна — чатыг
// нэвтрэлтгүйгээр нээх түлхүүр болгож ашигладаг тул энэ чухал.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LENGTH = 8;

export function generateOrderNumber() {
  let code = '';
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return code;
}
