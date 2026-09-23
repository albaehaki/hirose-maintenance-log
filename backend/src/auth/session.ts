import { randomBytes } from 'node:crypto';
import { db } from '../db/client.js';
import { sessions, users } from '../db/schema.js';
import { eq, lt, and, gt } from 'drizzle-orm';

const TTL_HOURS = 8; // satu shift kerja

export async function createSession(userId: number) {
  const id = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TTL_HOURS * 3600_000);
  await db.insert(sessions).values({ id, userId, expiresAt });
  return { id, expiresAt };
}

export async function resolveSession(token: string) {
  const rows = await db
    .select({
      sessionId: sessions.id,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.user.isActive !== 1) return null; // user nonaktif langsung ditolak
  return row;
}

export async function destroySession(token: string) {
  await db.delete(sessions).where(eq(sessions.id, token));
}

// Pembersihan berkala supaya tabel gak menumpuk
export async function purgeExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
