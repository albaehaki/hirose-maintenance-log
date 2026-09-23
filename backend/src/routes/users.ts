import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { requireAuth, requireRole, type Variables } from '../auth/middleware.js';
import { hashPassword } from '../auth/password.js';

// Seluruh route users = admin only (Baris 8 matriks permission)
export const usersRoute = new Hono<{ Variables: Variables }>();
usersRoute.use('*', requireAuth, requireRole('admin'));

const roleEnum = z.enum(['operator', 'supervisor', 'admin']);

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  role: roleEnum,
});

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: roleEnum.optional(),
  password: z.string().min(8).optional(),
  isActive: z.union([z.literal(0), z.literal(1), z.boolean()]).optional(),
});

// Kolom aman — passwordHash TIDAK pernah keluar dari API
const safeCols = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  isActive: users.isActive,
  createdAt: users.createdAt,
};

usersRoute.get('/', async (c) => {
  const rows = await db.select(safeCols).from(users).orderBy(users.id);
  return c.json({ data: rows });
});

usersRoute.post('/', zValidator('json', createUserSchema), async (c) => {
  const body = c.req.valid('json');
  const dup = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
  if (dup[0]) return c.json({ error: 'CONFLICT', message: 'Email sudah terdaftar' }, 409);

  const [row] = await db.insert(users).values({
    email: body.email,
    name: body.name,
    role: body.role,
    passwordHash: await hashPassword(body.password),
  }).returning(safeCols);

  return c.json({ data: row }, 201);
});

usersRoute.patch('/:id', zValidator('json', updateUserSchema), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'BAD_REQUEST' }, 400);

  const body = c.req.valid('json');
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) patch.name = body.name;
  if (body.role !== undefined) patch.role = body.role;
  if (body.password !== undefined) patch.passwordHash = await hashPassword(body.password);
  if (body.isActive !== undefined) {
    patch.isActive = body.isActive === true ? 1 : body.isActive === false ? 0 : body.isActive;
  }

  const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning(safeCols);
  if (!row) return c.json({ error: 'NOT_FOUND' }, 404);
  return c.json({ data: row });
});
