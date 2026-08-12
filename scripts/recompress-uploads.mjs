// upload.js-д webp-рүү автоматаар шахах логик нэмэгдэхээс ӨМНӨ хийгдсэн
// хуучин upload-уудыг (ихэвчлэн олон MB хэмжээтэй raw PNG/JPEG) олж, sharp-аар
// дахин боловсруулж (1200px inside, webp quality 82), menu_items.image_url-г
// шинэ файл рүү заалгаж, хуучин файлыг устгана.
//
// Ажиллуулах: DATABASE_URL нь зорилтот орчны (жишээ нь production Railway)
// өгөгдлийн санг заасан, мөн энэ процесс тухайн орчны /public/uploads
// хавтастай ижил файлын систем дээр ажиллаж байх шаардлагатай (өөрөөр хэлбэл
// deploy хийсэн серверийн orчинд (жишээ Railway shell) ажиллуулна — локал
// dev машинаас зайнаас DB-д холбогдоод файл диск дээр байхгүй бол алгасна).
//
// node scripts/recompress-uploads.mjs [--dry-run]

import 'dotenv/config';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import pg from 'pg';
import sharp from 'sharp';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../public/uploads');
const dryRun = process.argv.includes('--dry-run');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function main() {
  const { rows } = await pool.query(`
    SELECT id, image_url FROM menu_items
    WHERE image_url LIKE '/uploads/%' AND image_url NOT ILIKE '%.webp'
  `);

  console.log(`Хөрвүүлэх шаардлагатай ${rows.length} мөр олдлоо.${dryRun ? ' (--dry-run — юу ч бичихгүй)' : ''}`);

  let converted = 0, skippedMissing = 0, failed = 0;

  for (const row of rows) {
    const oldFilename = row.image_url.replace('/uploads/', '');
    const oldPath = path.join(uploadDir, oldFilename);
    const newFilename = oldFilename.replace(/\.[^.]+$/, '') + '.webp';
    const newPath = path.join(uploadDir, newFilename);
    const newUrl = `/uploads/${newFilename}`;

    try {
      await fs.access(oldPath);
    } catch {
      console.log(`  ⚠ файл олдсонгүй, алгасав: ${oldPath}`);
      skippedMissing++;
      continue;
    }

    const before = (await fs.stat(oldPath)).size;

    try {
      if (!dryRun) {
        await sharp(oldPath)
          .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(newPath);
        await pool.query('UPDATE menu_items SET image_url = $1 WHERE id = $2', [newUrl, row.id]);
        await fs.unlink(oldPath);
      }
      const after = dryRun ? null : (await fs.stat(newPath)).size;
      console.log(
        `  ✓ ${oldFilename} → ${newFilename} ` +
        `(${(before / 1024).toFixed(0)}KB${after != null ? ` → ${(after / 1024).toFixed(0)}KB` : ''})`
      );
      converted++;
    } catch (err) {
      console.log(`  ✗ алдаа гарлаа (${oldFilename}): ${err.message}`);
      failed++;
    }
  }

  console.log(`\nДүн: ${converted} хөрвүүлсэн, ${skippedMissing} файл олдоогүй, ${failed} алдаатай.`);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
