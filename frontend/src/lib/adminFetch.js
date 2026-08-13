// Admin dashboard-ийн "унших" fetch дуудлагуудад ашиглана. 401 ирвэл admin
// session хугацаа дууссан/хүчингүй гэсэн үг — хуудсыг дахин ачаалснаар
// AdminApp.jsx-ийн эхний /api/admin/me шалгалт дахин ажиллаж нэвтрэх хэсэг
// рүү буцаана (эс бөгөөс жагсаалтууд юу ч тайлбаргүй хоосон харагдаж байсан).
export async function adminFetchJson(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (res.status === 401) {
    window.location.reload();
    return null;
  }
  return res.json();
}
