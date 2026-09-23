import 'dotenv/config';
import { db, pool } from './client.js';
import { users, requests } from './schema.js';
import { hashPassword } from '../auth/password.js';

async function seed() {
  // Idempotent: kalau sudah ada user, lewati
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    console.log('[seed] data sudah ada, dilewati');
    await pool.end();
    return;
  }

  const pw = {
    operator: await hashPassword('Operator123!'),
    supervisor: await hashPassword('Supervisor123!'),
    admin: await hashPassword('Admin123!'),
  };

  const [op, sup, adm] = await db.insert(users).values([
    { email: 'operator@hirose.test', name: 'Oper Operator', passwordHash: pw.operator, role: 'operator' },
    { email: 'supervisor@hirose.test', name: 'Sup Supervisor', passwordHash: pw.supervisor, role: 'supervisor' },
    { email: 'admin@hirose.test', name: 'Adm Administrator', passwordHash: pw.admin, role: 'admin' },
  ]).returning();

  await db.insert(requests).values([
    { machineAssetId: 'CNC-01', problemDescription: 'Spindle bergetar saat RPM tinggi, ada suara kasar.', priority: 'high', status: 'submitted', createdBy: op.id },
    { machineAssetId: 'CNV-07', problemDescription: 'Belt conveyor selip saat beban penuh.', priority: 'critical', status: 'submitted', createdBy: op.id },
    { machineAssetId: 'PMP-03', problemDescription: 'Pompa hidrolik bocor di seal depan.', priority: 'medium', status: 'approved', createdBy: op.id, reviewedBy: sup.id, reviewedAt: new Date() },
    { machineAssetId: 'CMP-02', problemDescription: 'Kompresor overheat, alarm suhu aktif.', priority: 'high', status: 'rejected', createdBy: sup.id, reviewedBy: adm.id, reviewedAt: new Date() },
    { machineAssetId: 'WLD-11', problemDescription: 'Elektroda welding cepat habis, arus tidak stabil.', priority: 'low', status: 'submitted', createdBy: adm.id },
  ]);

  console.log('[seed] selesai: 3 user, 5 request');
  await pool.end();
}

seed().catch((e) => {
  console.error('[seed] gagal:', e);
  process.exit(1);
});
