import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { authRoute } from './routes/auth.js';
import { requestsRoute } from './routes/requests.js';
import { usersRoute } from './routes/users.js';
import { healthRoute } from './routes/health.js';
import { purgeExpiredSessions } from './auth/session.js';
import { env } from './env.js';

const app = new Hono();

app.use('*', logger());
app.route('/api/health', healthRoute);
app.route('/api/auth', authRoute);
app.route('/api/requests', requestsRoute);
app.route('/api/users', usersRoute);

app.notFound((c) => c.json({ error: 'NOT_FOUND', message: 'Endpoint tidak ditemukan' }, 404));
app.onError((err, c) => {
  console.error('[error]', err);
  return c.json({ error: 'INTERNAL_ERROR', message: 'Terjadi kesalahan di server' }, 500);
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`[api] listening on :${info.port}`);
});

purgeExpiredSessions().catch(() => {});
setInterval(() => purgeExpiredSessions().catch(() => {}), 3600_000);
