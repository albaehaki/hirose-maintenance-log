import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';

export const healthRoute = new Hono();

healthRoute.get('/', async (c) => {
  try {
    await db.execute(sql`SELECT 1`);
    return c.json({ status: 'ok', db: 'up', timestamp: new Date().toISOString() });
  } catch {
    return c.json({ status: 'degraded', db: 'down', timestamp: new Date().toISOString() }, 503);
  }
});
