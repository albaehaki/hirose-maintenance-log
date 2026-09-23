import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { verifyPassword } from '../auth/password.js';
import { createSession, destroySession } from '../auth/session.js';
import { requireAuth, type Variables } from '../auth/middleware.js';

export const authRoute = new Hono<{ Variables: Variables }>();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

authRoute.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Pesan error disamakan supaya tidak bocorkan email mana yang terdaftar
  const invalid = () => c.json({ error: 'INVALID_CREDENTIALS', message: 'Email atau password salah' }, 401);

  if (!found[0]) return invalid();
  if (found[0].isActive !== 1) {
    return c.json({ error: 'ACCOUNT_DISABLED', message: 'Akun dinonaktifkan' }, 403);
  }
  if (!(await verifyPassword(password, found[0].passwordHash))) return invalid();

  const session = await createSession(found[0].id);

  setCookie(c, 'sid', session.id, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    expires: session.expiresAt,
  });

  return c.json({
    // Token juga dikembalikan di body supaya API bisa dites langsung dengan curl
    token: session.id,
    expiresAt: session.expiresAt,
    user: {
      id: found[0].id,
      email: found[0].email,
      name: found[0].name,
      role: found[0].role,
    },
  });
});

authRoute.post('/logout', requireAuth, async (c) => {
  await destroySession(c.get('sessionId'));
  deleteCookie(c, 'sid', { path: '/' });
  return c.json({ data: { message: 'Logout berhasil' } });
});

authRoute.get('/me', requireAuth, (c) => c.json({ data: c.get('user') }));
