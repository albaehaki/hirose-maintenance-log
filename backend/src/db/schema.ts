import { pgTable, serial, text, timestamp, integer, pgEnum, index } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['operator', 'supervisor', 'admin']);
export const statusEnum = pgEnum('request_status', ['submitted', 'approved', 'rejected']);
export const priorityEnum = pgEnum('priority', ['low', 'medium', 'high', 'critical']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('operator'),
  isActive: integer('is_active').notNull().default(1), // 1 aktif, 0 nonaktif
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // random 32 byte, hex
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => ({ userIdx: index('sessions_user_idx').on(t.userId) }));

export const requests = pgTable('requests', {
  id: serial('id').primaryKey(),
  machineAssetId: text('machine_asset_id').notNull(), // "machine or asset ID"
  problemDescription: text('problem_description').notNull(),
  priority: priorityEnum('priority').notNull().default('medium'),
  status: statusEnum('status').notNull().default('submitted'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedBy: integer('reviewed_by').references(() => users.id), // nullable
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }), // nullable
}, (t) => ({
  statusIdx: index('requests_status_idx').on(t.status),
  priorityIdx: index('requests_priority_idx').on(t.priority),
  creatorIdx: index('requests_created_by_idx').on(t.createdBy),
}));

// ⭐ BONUS: audit trail — mencatat setiap perubahan status
export const requestAudit = pgTable('request_audit', {
  id: serial('id').primaryKey(),
  requestId: integer('request_id').notNull().references(() => requests.id, { onDelete: 'cascade' }),
  actorId: integer('actor_id').notNull().references(() => users.id),
  fromStatus: statusEnum('from_status'),
  toStatus: statusEnum('to_status').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
