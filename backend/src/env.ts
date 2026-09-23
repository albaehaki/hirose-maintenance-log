// Baca konfigurasi dari environment variables.
// Tidak ada nilai rahasia yang di-hardcode di sini.
export const env = {
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgres://hirose:hirose_password@localhost:5432/hirose',
  PORT: Number(process.env.PORT ?? 3000),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
};
