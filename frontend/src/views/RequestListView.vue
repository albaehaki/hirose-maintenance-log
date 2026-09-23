<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';

interface Req {
  id: number;
  machineAssetId: string;
  problemDescription: string;
  priority: string;
  status: string;
  createdBy: number;
  createdAt: string;
  reviewedBy: number | null;
  reviewedAt: string | null;
}

const auth = useAuthStore();
const rows = ref<Req[]>([]);
const status = ref('');
const priority = ref('');
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const params: Record<string, string> = {};
    if (status.value) params.status = status.value;
    if (priority.value) params.priority = priority.value;
    rows.value = (await api.get('/requests', { params })).data.data;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch([status, priority], load);

async function remove(id: number) {
  if (!confirm('Hapus request ini?')) return;
  await api.delete(`/requests/${id}`);
  await load();
}

async function doLogout() {
  await auth.logout();
  window.location.href = '/login';
}
</script>

<template>
  <section>
    <header class="bar">
      <h1>Maintenance Requests</h1>
      <div class="bar-actions">
        <RouterLink class="btn primary" to="/requests/new">+ Request Baru</RouterLink>
        <RouterLink v-if="auth.canManageUsers" class="btn ghost" to="/users">Kelola User</RouterLink>
        <button class="btn ghost" @click="doLogout">Logout</button>
      </div>
    </header>

    <div class="filters">
      <label>Status
        <select v-model="status">
          <option value="">Semua</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
      <label>Priority
        <select v-model="priority">
          <option value="">Semua</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </label>
      <span v-if="loading" class="muted">Memuat…</span>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th><th>Machine</th><th>Deskripsi</th>
          <th>Priority</th><th>Status</th><th>Dibuat</th><th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.id">
          <td>{{ r.id }}</td>
          <td><code>{{ r.machineAssetId }}</code></td>
          <td class="desc">{{ r.problemDescription }}</td>
          <td><span class="pill" :class="r.priority">{{ r.priority }}</span></td>
          <td><span class="pill" :class="r.status">{{ r.status }}</span></td>
          <td>{{ new Date(r.createdAt).toLocaleString('id-ID') }}</td>
          <td class="actions">
            <RouterLink :to="`/requests/${r.id}`">Detail</RouterLink>
            <!-- UI menyembunyikan tombol; server tetap penentu -->
            <button v-if="auth.canDelete" class="link danger" @click="remove(r.id)">Hapus</button>
          </td>
        </tr>
        <tr v-if="!rows.length && !loading">
          <td colspan="7" class="muted">Tidak ada request yang cocok dengan filter.</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
