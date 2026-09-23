import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';
import { fileURLToPath } from 'node:url';

// Jalankan migrasi dari folder drizzle/
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

try {
  await migrate(db, { migrationsFolder });
  console.log('[migrate] selesai');
} catch (e) {
  console.error('[migrate] gagal:', e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
