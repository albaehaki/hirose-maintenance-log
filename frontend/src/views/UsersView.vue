<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../api';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  isActive: number;
}

const users = ref<User[]>([]);
const showModal = ref(false);
const email = ref('');
const name = ref('');
const password = ref('');
const role = ref('operator');
const error = ref('');
const busy = ref(false);
const search = ref('');

async function fetchUsers() {
  users.value = (await api.get('/users')).data.data;
}

function openModal() {
  error.value = '';
  email.value = '';
  name.value = '';
  password.value = '';
  role.value = 'operator';
  showModal.value = true;
}

function closeModal() {
  if (busy.value) return;
  showModal.value = false;
}

async function createUser() {
  error.value = '';
  busy.value = true;
  try {
    await api.post('/users', { email: email.value, name: name.value, password: password.value, role: role.value });
    showModal.value = false;
    await fetchUsers();
  } catch (e: any) {
    error.value = e.response?.data?.message ?? 'Gagal membuat user';
  } finally {
    busy.value = false;
  }
}

async function deactivate(id: number) {
  if (!confirm('Nonaktifkan user ini?')) return;
  await api.patch(`/users/${id}`, { isActive: 0 });
  await fetchUsers();
}

const filteredUsers = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return users.value;
  return users.value.filter(
    (u) =>
      u.email.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q),
  );
});

onMounted(fetchUsers);
</script>

<template>
  <section class="narrow users-page">
    <header class="page-head">
      <h1>Kelola User</h1>
      <button class="btn primary" @click="openModal">+ Tambah User</button>
    </header>

    <div class="users-toolbar">
      <input v-model="search" type="search" class="search-input" placeholder="Cari email, nama, atau role…" />
      <span class="muted">{{ filteredUsers.length }} user</span>
    </div>

    <table>
      <thead>
        <tr><th>ID</th><th>Email</th><th>Nama</th><th>Role</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="u in filteredUsers" :key="u.id">
          <td>{{ u.id }}</td>
          <td>{{ u.email }}</td>
          <td>{{ u.name }}</td>
          <td><span class="pill">{{ u.role }}</span></td>
          <td>
            <span class="status-badge" :class="u.isActive === 1 ? 'active' : 'inactive'">
              {{ u.isActive === 1 ? 'Aktif' : 'Nonaktif' }}
            </span>
          </td>
          <td class="actions">
            <button v-if="u.isActive === 1" class="btn no small" @click="deactivate(u.id)">Nonaktifkan</button>
          </td>
        </tr>
        <tr v-if="!filteredUsers.length">
          <td colspan="6" class="muted">Tidak ada user yang cocok.</td>
        </tr>
      </tbody>
    </table>

    <!-- Popup tambah user -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <header class="modal-head">
            <h2 id="modal-title">Tambah User</h2>
            <button class="icon-btn" aria-label="Tutup" @click="closeModal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>

          <form class="modal-form" @submit.prevent="createUser">
            <label>Email</label>
            <input v-model="email" type="email" placeholder="user@hirose.test" required />
            <label>Nama</label>
            <input v-model="name" placeholder="Nama lengkap" required />
            <label>Password (min. 8 karakter)</label>
            <input v-model="password" type="password" placeholder="••••••••" required />
            <label>Role</label>
            <select v-model="role">
              <option value="operator">Operator</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
            <p v-if="error" class="error">{{ error }}</p>
            <div class="modal-actions">
              <button type="button" class="btn ghost" @click="closeModal">Batal</button>
              <button type="button" class="btn primary" :disabled="busy" @click="createUser">{{ busy ? 'Menyimpan…' : 'Tambah User' }}</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </section>
</template>
