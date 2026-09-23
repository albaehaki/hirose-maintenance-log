<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  isActive: number;
}

const users = ref<User[]>([]);
const email = ref('');
const name = ref('');
const password = ref('');
const role = ref('operator');
const error = ref('');
const busy = ref(false);

async function fetchUsers() {
  users.value = (await api.get('/users')).data.data;
}

async function createUser() {
  error.value = '';
  busy.value = true;
  try {
    await api.post('/users', { email: email.value, name: name.value, password: password.value, role: role.value });
    email.value = '';
    name.value = '';
    password.value = '';
    role.value = 'operator';
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

onMounted(fetchUsers);
</script>

<template>
  <section class="narrow">
    <RouterLink class="back" to="/">← Kembali ke daftar</RouterLink>
    <h1>Kelola User (Admin)</h1>

    <form class="card form" @submit.prevent="createUser">
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
      <button class="btn primary" :disabled="busy">{{ busy ? 'Menyimpan…' : 'Tambah User' }}</button>
    </form>

    <table>
      <thead>
        <tr><th>ID</th><th>Email</th><th>Nama</th><th>Role</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td>{{ u.id }}</td>
          <td>{{ u.email }}</td>
          <td>{{ u.name }}</td>
          <td><span class="pill">{{ u.role }}</span></td>
          <td>{{ u.isActive === 1 ? 'Aktif' : 'Nonaktif' }}</td>
          <td>
            <button v-if="u.isActive === 1" class="btn no small" @click="deactivate(u.id)">Nonaktifkan</button>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
