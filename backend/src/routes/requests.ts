import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { requests, users, requestAudit } from '../db/schema.js';
import { requireAuth, requireRole, type Variables } from '../auth/middleware.js';
import {
  canCreateRequest, canEditRequest, canViewRequest,
  canViewAllRequests, canReviewRequest,
} from '../policy.js';

export const requestsRoute = new Hono<{ Variables: Variables }>();
requestsRoute.use('*', requireAuth);

/* ── Skema validasi server-side ── */
const priorityEnum = z.enum(['low', 'medium', 'high', 'critical']);

const createSchema = z.object({
  machineAssetId: z.string().trim().min(1, 'machineAssetId wajib diisi').max(64),
  problemDescription: z.string().trim().min(10, 'Deskripsi minimal 10 karakter').max(2000),
  priority: priorityEnum.default('medium'),
});

const updateSchema = createSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'Tidak ada field yang diubah' },
);

const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(500).optional(),
});

/* ── LIST + FILTER (Baris 2 & 3) ── */
requestsRoute.get('/', async (c) => {
  const user = c.get('user');
  const status = c.req.query('status');
  const priority = c.req.query('priority');

  const conditions = [];
  if (!canViewAllRequests(user.role)) conditions.push(eq(requests.createdBy, user.id));
  if (status) conditions.push(eq(requests.status, status as any));
  if (priority) conditions.push(eq(requests.priority, priority as any));

  const rows = await db
    .select({
      id: requests.id,
      machineAssetId: requests.machineAssetId,
      problemDescription: requests.problemDescription,
      priority: requests.priority,
      status: requests.status,
      createdBy: requests.createdBy,
      createdAt: requests.createdAt,
      reviewedBy: requests.reviewedBy,
      reviewedAt: requests.reviewedAt,
    })
    .from(requests)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(requests.createdAt));

  return c.json({ data: rows });
});

/* ── GET satu request ── */
requestsRoute.get('/:id', async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'BAD_REQUEST', message: 'ID tidak valid' }, 400);

  const req = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!req[0]) return c.json({ error: 'NOT_FOUND', message: 'Request tidak ditemukan' }, 404);

  if (!canViewRequest(user as any, req[0])) {
    return c.json({ error: 'FORBIDDEN', message: 'Tidak boleh melihat request ini' }, 403);
  }
  return c.json({ data: req[0] });
});

/* ── CREATE (Baris 1) ── */
requestsRoute.post('/', zValidator('json', createSchema), async (c) => {
  const user = c.get('user');
  if (!canCreateRequest(user.role)) return c.json({ error: 'FORBIDDEN' }, 403);

  const body = c.req.valid('json');
  const [row] = await db.insert(requests).values({
    machineAssetId: body.machineAssetId,
    problemDescription: body.problemDescription,
    priority: body.priority,
    status: 'submitted',
    createdBy: user.id,
  }).returning();

  await db.insert(requestAudit).values({
    requestId: row.id, actorId: user.id, fromStatus: null, toStatus: 'submitted',
  });

  return c.json({ data: row }, 201);
});

/* ── UPDATE (Baris 4 & 5) ── */
requestsRoute.patch('/:id', zValidator('json', updateSchema), async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'BAD_REQUEST' }, 400);

  const found = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!found[0]) return c.json({ error: 'NOT_FOUND' }, 404);

  // ⭐ ENFORCE: satu panggilan, seluruh aturan baris 4 & 5
  if (!canEditRequest(user as any, found[0])) {
    return c.json({
      error: 'FORBIDDEN',
      message: 'Tidak boleh mengedit request ini. Hanya admin yang bisa mengedit request '
        + 'milik orang lain atau yang statusnya sudah direview.',
    }, 403);
  }

  const body = c.req.valid('json');
  const [row] = await db.update(requests)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(requests.id, id))
    .returning();

  return c.json({ data: row });
});

/* ── APPROVE / REJECT (Baris 6) ── */
requestsRoute.post('/:id/review', zValidator('json', reviewSchema), async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));

  if (!canReviewRequest(user.role)) {
    return c.json({ error: 'FORBIDDEN', message: 'Hanya supervisor atau admin yang bisa review' }, 403);
  }

  const found = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!found[0]) return c.json({ error: 'NOT_FOUND' }, 404);
  if (found[0].status !== 'submitted') {
    return c.json({ error: 'CONFLICT', message: `Request sudah berstatus '${found[0].status}'` }, 409);
  }

  const { status, note } = c.req.valid('json');
  const [row] = await db.update(requests).set({
    status, reviewedBy: user.id, reviewedAt: new Date(), updatedAt: new Date(),
  }).where(eq(requests.id, id)).returning();

  await db.insert(requestAudit).values({
    requestId: id, actorId: user.id, fromStatus: 'submitted', toStatus: status, note: note ?? null,
  });

  return c.json({ data: row });
});

/* ── DELETE (Baris 7) ── */
requestsRoute.delete('/:id', requireRole('admin'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'BAD_REQUEST' }, 400);

  const deleted = await db.delete(requests).where(eq(requests.id, id)).returning();
  if (!deleted[0]) return c.json({ error: 'NOT_FOUND' }, 404);
  return c.json({ data: { id } });
});
