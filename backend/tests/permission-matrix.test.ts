import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

// Ketika dijalankan dari dalam container api (Jenkins), web container bisa
// diakses lewat http://web:80. Dari host, pakai http://localhost:8080/api.
const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:8080/api';

let tokens: Record<string, string> = {};
let ids: Record<string, { requestId: number; ownRequestId: number }> = {};

async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `login ${email} harus 200`);
  return (await res.json()).token as string;
}

function call(path: string, opts: RequestInit & { token?: string } = {}) {
  const { token, ...rest } = opts;
  return fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
  });
}

before(async () => {
  tokens = {
    operator: await login('operator@hirose.test', 'Operator123!'),
    supervisor: await login('supervisor@hirose.test', 'Supervisor123!'),
    admin: await login('admin@hirose.test', 'Admin123!'),
  };

  // Setiap role bikin satu request MILIKNYA, supaya baris 4 bisa diuji
  ids = {} as any;
  for (const role of ['operator', 'supervisor', 'admin'] as const) {
    const res = await call('/requests', {
      method: 'POST',
      token: tokens[role],
      body: JSON.stringify({
        machineAssetId: `TEST-${role.toUpperCase()}`,
        problemDescription: `Request uji milik ${role} untuk matriks permission.`,
        priority: 'medium',
      }),
    });
    assert.equal(res.status, 201);
    ids[role] = { ownRequestId: (await res.json()).data.id, requestId: 0 };
  }
  // Request milik operator, dipakai untuk menguji "edit orang lain"
  ids.supervisor.requestId = ids.operator.ownRequestId;
  ids.admin.requestId = ids.operator.ownRequestId;
});

after(async () => {
  for (const role of ['operator', 'supervisor', 'admin'] as const) {
    await call(`/requests/${ids[role].ownRequestId}`, { method: 'DELETE', token: tokens.admin });
  }
});

/* ═══ Baris 1 — Create a request: ketiga role boleh ═══ */
describe('Baris 1 — Create a request', () => {
  for (const role of ['operator', 'supervisor', 'admin'] as const) {
    test(`${role} boleh create (201)`, async () => {
      const res = await call('/requests', {
        method: 'POST',
        token: tokens[role],
        body: JSON.stringify({
          machineAssetId: 'ACC-01',
          problemDescription: 'Uji akses create untuk matriks permission.',
        }),
      });
      assert.equal(res.status, 201);
      const { data } = await res.json();
      await call(`/requests/${data.id}`, { method: 'DELETE', token: tokens.admin });
    });
  }
});

/* ═══ Baris 2 & 3 — View own vs View all ═══ */
describe('Baris 2 & 3 — View requests', () => {
  test('operator hanya melihat request miliknya', async () => {
    const res = await call('/requests', { token: tokens.operator });
    assert.equal(res.status, 200);
    const { data } = await res.json();
    const me = (await call('/auth/me', { token: tokens.operator }).then((r) => r.json())).data;
    assert.ok(
      data.every((r: any) => r.createdBy === me.id),
      'operator tidak boleh melihat request milik orang lain',
    );
  });

  test('supervisor melihat request semua orang', async () => {
    const res = await call('/requests', { token: tokens.supervisor });
    const { data } = await res.json();
    const creators = new Set(data.map((r: any) => r.createdBy));
    assert.ok(creators.size > 1, 'supervisor harus melihat request lebih dari satu pembuat');
  });

  test('operator tidak boleh lihat detail request orang lain (403)', async () => {
    const res = await call(`/requests/${ids.supervisor.ownRequestId}`, { token: tokens.operator });
    assert.equal(res.status, 403);
  });
});

/* ═══ Baris 4 & 5 — Edit: INI TEST PALING PENTING ═══ */
describe('Baris 4 & 5 — Edit rules', () => {
  const patch = { problemDescription: 'Deskripsi hasil edit untuk pengujian matriks permission.' };

  test('operator boleh edit request miliknya yang masih submitted (200)', async () => {
    const res = await call(`/requests/${ids.operator.ownRequestId}`, {
      method: 'PATCH',
      token: tokens.operator,
      body: JSON.stringify(patch),
    });
    assert.equal(res.status, 200);
  });

  test('operator TIDAK boleh edit request orang lain (403)', async () => {
    const res = await call(`/requests/${ids.supervisor.ownRequestId}`, {
      method: 'PATCH',
      token: tokens.operator,
      body: JSON.stringify(patch),
    });
    assert.equal(res.status, 403);
  });

  test('supervisor TIDAK boleh edit request orang lain (403)', async () => {
    const res = await call(`/requests/${ids.admin.ownRequestId}`, {
      method: 'PATCH',
      token: tokens.supervisor,
      body: JSON.stringify(patch),
    });
    assert.equal(res.status, 403, 'supervisor bukan admin — ini aturan yang paling sering salah');
  });

  test('admin boleh edit request siapa pun (200)', async () => {
    const res = await call(`/requests/${ids.operator.ownRequestId}`, {
      method: 'PATCH',
      token: tokens.admin,
      body: JSON.stringify(patch),
    });
    assert.equal(res.status, 200);
  });

  test('pemilik TIDAK boleh edit setelah request direview (403)', async () => {
    // admin approve request milik operator
    const approve = await call(`/requests/${ids.operator.ownRequestId}/review`, {
      method: 'POST',
      token: tokens.admin,
      body: JSON.stringify({ status: 'approved' }),
    });
    assert.equal(approve.status, 200);

    const res = await call(`/requests/${ids.operator.ownRequestId}`, {
      method: 'PATCH',
      token: tokens.operator,
      body: JSON.stringify(patch),
    });
    assert.equal(res.status, 403, 'setelah approved, pemilik tidak boleh edit lagi');
  });
});

/* ═══ Baris 6 — Approve / reject: hanya supervisor & admin ═══ */
describe('Baris 6 — Approve or reject', () => {
  test('operator TIDAK boleh review (403)', async () => {
    const res = await call(`/requests/${ids.supervisor.ownRequestId}/review`, {
      method: 'POST',
      token: tokens.operator,
      body: JSON.stringify({ status: 'approved' }),
    });
    assert.equal(res.status, 403);
  });

  test('supervisor boleh review (200)', async () => {
    const res = await call(`/requests/${ids.supervisor.ownRequestId}/review`, {
      method: 'POST',
      token: tokens.supervisor,
      body: JSON.stringify({ status: 'approved', note: 'Disetujui saat pengujian.' }),
    });
    assert.equal(res.status, 200);
  });

  test('admin boleh review (200)', async () => {
    const res = await call(`/requests/${ids.admin.ownRequestId}/review`, {
      method: 'POST',
      token: tokens.admin,
      body: JSON.stringify({ status: 'rejected' }),
    });
    assert.equal(res.status, 200);
  });
});

/* ═══ Baris 7 — Delete: hanya admin ═══ */
describe('Baris 7 — Delete a request', () => {
  test('operator TIDAK boleh delete (403)', async () => {
    const res = await call(`/requests/${ids.operator.ownRequestId}`, {
      method: 'DELETE',
      token: tokens.operator,
    });
    assert.equal(res.status, 403);
  });

  test('supervisor TIDAK boleh delete (403)', async () => {
    const res = await call(`/requests/${ids.operator.ownRequestId}`, {
      method: 'DELETE',
      token: tokens.supervisor,
    });
    assert.equal(res.status, 403);
  });

  test('admin boleh delete (200)', async () => {
    const created = await call('/requests', {
      method: 'POST',
      token: tokens.admin,
      body: JSON.stringify({
        machineAssetId: 'DEL-01',
        problemDescription: 'Request yang akan dihapus admin saat pengujian matriks.',
      }),
    });
    const id = (await created.json()).data.id;
    const res = await call(`/requests/${id}`, { method: 'DELETE', token: tokens.admin });
    assert.equal(res.status, 200);
  });
});

/* ═══ Baris 8 — User management: hanya admin ═══ */
describe('Baris 8 — Create / edit / deactivate users', () => {
  test('operator tidak boleh list users (403)', async () => {
    assert.equal((await call('/users', { token: tokens.operator })).status, 403);
  });
  test('supervisor tidak boleh list users (403)', async () => {
    assert.equal((await call('/users', { token: tokens.supervisor })).status, 403);
  });
  test('admin boleh list users (200)', async () => {
    assert.equal((await call('/users', { token: tokens.admin })).status, 200);
  });
  test('operator tidak boleh create user (403)', async () => {
    const res = await call('/users', {
      method: 'POST',
      token: tokens.operator,
      body: JSON.stringify({ email: 'x@y.test', name: 'X', password: 'Password123!', role: 'operator' }),
    });
    assert.equal(res.status, 403);
  });
  test('admin boleh create lalu deactivate user (201 lalu 200)', async () => {
    const email = `uji-${Date.now()}@hirose.test`;
    const created = await call('/users', {
      method: 'POST',
      token: tokens.admin,
      body: JSON.stringify({ email, name: 'User Uji', password: 'Password123!', role: 'operator' }),
    });
    assert.equal(created.status, 201);
    const id = (await created.json()).data.id;

    const deactivated = await call(`/users/${id}`, {
      method: 'PATCH',
      token: tokens.admin,
      body: JSON.stringify({ isActive: 0 }),
    });
    assert.equal(deactivated.status, 200);
    assert.equal((await deactivated.json()).data.isActive, 0);
  });

  test('password hash TIDAK pernah keluar dari API', async () => {
    const res = await call('/users', { token: tokens.admin });
    const body = JSON.stringify(await res.json());
    assert.ok(
      !body.includes('passwordHash') && !body.includes('password_hash'),
      'respons API tidak boleh memuat hash password',
    );
  });
});

/* ═══ Validasi & autentikasi ═══ */
describe('Validasi server-side & autentikasi', () => {
  test('tanpa token → 401', async () => {
    assert.equal((await call('/requests')).status, 401);
  });
  test('token ngawur → 401', async () => {
    assert.equal((await call('/requests', { token: 'token-palsu' })).status, 401);
  });
  test('deskripsi terlalu pendek → 400', async () => {
    const res = await call('/requests', {
      method: 'POST',
      token: tokens.operator,
      body: JSON.stringify({ machineAssetId: 'X', problemDescription: 'pendek' }),
    });
    assert.equal(res.status, 400);
  });
  test('machineAssetId kosong → 400', async () => {
    const res = await call('/requests', {
      method: 'POST',
      token: tokens.operator,
      body: JSON.stringify({
        machineAssetId: '   ',
        problemDescription: 'Deskripsi yang cukup panjang untuk lolos validasi.',
      }),
    });
    assert.equal(res.status, 400);
  });
  test('priority tidak dikenal → 400', async () => {
    const res = await call('/requests', {
      method: 'POST',
      token: tokens.operator,
      body: JSON.stringify({
        machineAssetId: 'X-1',
        problemDescription: 'Deskripsi cukup panjang untuk validasi.',
        priority: 'super-urgent',
      }),
    });
    assert.equal(res.status, 400);
  });
  test('login dengan password salah → 401', async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@hirose.test', password: 'password-salah' }),
    });
    assert.equal(res.status, 401);
  });
  test('logout mencabut token di sisi server → 401 setelah logout', async () => {
    const token = await login('operator@hirose.test', 'Operator123!');
    assert.equal((await call('/auth/me', { token })).status, 200);
    await call('/auth/logout', { method: 'POST', token });
    assert.equal(
      (await call('/auth/me', { token })).status,
      401,
      'token harus tidak berlaku lagi setelah logout',
    );
  });
});
