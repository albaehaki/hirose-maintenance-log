import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';
import { resolve } from 'node:path';

// Folder migrasi relatif ke direktori kerja, supaya path konsisten
// di dua konteks:
//   - lokal   (pnpm db:migrate dari backend/) → backend/drizzle
//   - docker  (WORKDIR /app)                 → /app/drizzle
const migrationsFolder = resolve(process.cwd(), 'drizzle');

try {
  await migrate(db, { migrationsFolder });
  console.log('[migrate] selesai');
} catch (e) {
  console.error('[migrate] gagal:', e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
