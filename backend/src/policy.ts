import type { InferSelectModel } from 'drizzle-orm';
import type { users, requests } from './db/schema.js';

export type Role = 'operator' | 'supervisor' | 'admin';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type Status = 'submitted' | 'approved' | 'rejected';

type UserRow = InferSelectModel<typeof users>;
type RequestRow = InferSelectModel<typeof requests>;

/* ── Baris 1: Create a request ───────────────────────────────
   Operator ✅  Supervisor ✅  Admin ✅                            */
export const canCreateRequest = (_role: Role) => true;

/* ── Baris 2 & 3: View own / View all ────────────────────────
   Operator: hanya miliknya. Supervisor & Admin: semua.          */
export const canViewAllRequests = (role: Role) =>
  role === 'supervisor' || role === 'admin';

export const canViewRequest = (actor: UserRow, req: RequestRow) =>
  canViewAllRequests(actor.role) || req.createdBy === actor.id;

/* ── Baris 4 & 5: Edit own while submitted / Edit any ────────
   Admin        → selalu boleh
   Operator/Sup → hanya request SENDIRI dan status SUBMITTED
   ⚠️ Supervisor TIDAK boleh mengedit request orang lain.        */
export const canEditRequest = (actor: UserRow, req: RequestRow) => {
  if (actor.role === 'admin') return true;
  return req.createdBy === actor.id && req.status === 'submitted';
};

/* ── Baris 6: Approve or reject ──────────────────────────────
   Operator ❌  Supervisor ✅  Admin ✅                           */
export const canReviewRequest = (role: Role) =>
  role === 'supervisor' || role === 'admin';

/* ── Baris 7: Delete ─────────────────────────────────────────
   Hanya Admin.                                                   */
export const canDeleteRequest = (role: Role) => role === 'admin';

/* ── Baris 8: Create / edit / deactivate users ───────────────
   Hanya Admin.                                                   */
export const canManageUsers = (role: Role) => role === 'admin';
