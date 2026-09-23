#!/bin/sh
set -e

echo "[entrypoint] menunggu PostgreSQL siap..."
until node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(() => c.end()).then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 2
done
echo "[entrypoint] PostgreSQL siap."

echo "[entrypoint] menjalankan migrasi..."
node dist/src/db/migrate.js

echo "[entrypoint] menjalankan seed (idempotent)..."
node dist/src/db/seed.js

echo "[entrypoint] menjalankan aplikasi..."
exec node dist/src/index.js
