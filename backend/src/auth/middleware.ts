import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { resolveSession } from './session.js';
import type { Role } from '../policy.js';

export type Variables = {
  user: { id: number; email: string; name: string; role: Role; isActive: number };
  sessionId: string;
};

/** Ambil token dari cookie ATAU header Bearer (biar bisa dites via curl). */
function extractToken(c: any): string | null {
  const auth = c.req.header('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return getCookie(c, 'sid') ?? null;
}

export const requireAuth = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const token = extractToken(c);
  if (!token) return c.json({ error: 'UNAUTHENTICATED', message: 'Token tidak ditemukan' }, 401);

  const resolved = await resolveSession(token);
  if (!resolved) return c.json({ error: 'UNAUTHENTICATED', message: 'Sesi tidak valid atau kedaluwarsa' }, 401);

  c.set('user', resolved.user as Variables['user']);
  c.set('sessionId', resolved.sessionId);
  await next();
});

/** Guard role. Dipakai di route yang aturannya cuma soal role. */
export const requireRole = (...allowed: Role[]) =>
  createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const user = c.get('user');
    if (!allowed.includes(user.role)) {
      return c.json({
        error: 'FORBIDDEN',
        message: `Role '${user.role}' tidak boleh melakukan aksi ini`,
        required: allowed,
      }, 403);
    }
    await next();
  });
