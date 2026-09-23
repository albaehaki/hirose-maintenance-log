import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { healthRoute } from './routes/health.js';
import { env } from './env.js';

const app = new Hono();

app.use('*', logger());
app.route('/api/health', healthRoute);

app.notFound((c) => c.json({ error: 'NOT_FOUND', message: 'Endpoint tidak ditemukan' }, 404));
app.onError((err, c) => {
  console.error('[error]', err);
  return c.json({ error: 'INTERNAL_ERROR', message: 'Terjadi kesalahan di server' }, 500);
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`[api] listening on :${info.port}`);
});
