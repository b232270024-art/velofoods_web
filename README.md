# Hotel dining backend

## Суулгах

```bash
npm install
cp .env.example .env
# .env дотор DATABASE_URL, JWT_SECRET-ээ өөрчил
npm run migrate
npm run seed   # 12 хоногийн план болон нэмэлт хоолны жишээ өгөгдөл нэмнэ (идэмпотент)
```

## Локал хөгжүүлэлт

```bash
npm run dev
```

Backend (`:4000`, auto-restart) болон frontend (Vite, `:5173`, proxy-аар `/api`-г backend руу дамжуулна) хоёуланг нэг дор асаана. Зөвхөн нэгийг нь асаах бол `npm run dev:backend` / `npm run dev:frontend`.

`npm run seed`-г дахин ажиллуулсан ч давхардуулахгүй (одоо байгаа өгөгдлийг устгаж/дарж бичихгүй, зөвхөн дутууг нэмнэ) — DB-гээ дахин холбосны дараа ч аюулгүй ашиглаж болно.

