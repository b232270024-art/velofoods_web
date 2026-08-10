import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { requireAdmin } from '../middleware/adminAuth.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadRouter = Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Файлыг диск рүү шууд бичихийн оронд санах ойд (buffer) авч, sharp-аар
// боловсруулаад (хэмжээ хумих + webp-рүү шахах) ЗӨВХӨН оптимизаци хийсэн
// хувилбарыг диск рүү бичнэ — админ утаснаасаа шууд 3-5МБ зураг оруулахад ч
// сайт дээр үргэлж жижиг (ихэвчлэн <150KB) зураг харагдана.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB upload limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Зөвхөн зураг оруулах боломжтой'));
    }
  }
});

uploadRouter.use(requireAdmin);

uploadRouter.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Зураг олдсонгүй' });
  }

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const filename = `image-${uniqueSuffix}.webp`;

  try {
    await sharp(req.file.buffer)
      // 1200px-ээс жижиг зургийг томруулахгүй (withoutEnlargement) — зөвхөн
      // хэт томыг хумина, хоолны цэс/12 хоногийн план дээр 1200px хэдийнэ
      // хэт хангалттай.
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(uploadDir, filename));
  } catch (err) {
    return res.status(400).json({ error: 'Зургийг боловсруулахад алдаа гарлаа: ' + err.message });
  }

  res.json({ url: `/uploads/${filename}` });
});
