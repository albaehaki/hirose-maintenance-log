<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';

const route = useRoute();
const router = useRouter();

const isEdit = computed(() => !!route.params.id);
const machineAssetId = ref('');
const problemDescription = ref('');
const priority = ref('medium');
const error = ref('');
const busy = ref(false);

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    if (isEdit.value) {
      await api.patch(`/requests/${route.params.id}`, {
        machineAssetId: machineAssetId.value,
        problemDescription: problemDescription.value,
        priority: priority.value,
      });
    } else {
      await api.post('/requests', {
        machineAssetId: machineAssetId.value,
        problemDescription: problemDescription.value,
        priority: priority.value,
      });
    }
    router.push('/');
  } catch (e: any) {
    error.value = e.response?.data?.message ?? 'Gagal menyimpan';
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  if (!isEdit.value) return;
  const res = await api.get(`/requests/${route.params.id}`);
  const r = res.data.data;
  machineAssetId.value = r.machineAssetId;
  problemDescription.value = r.problemDescription;
  priority.value = r.priority;
});
</script>

<template>
  <section class="narrow">
    <RouterLink class="back" to="/">← Kembali ke daftar</RouterLink>
    <h1>{{ isEdit ? 'Edit Request' : 'Buat Request Baru' }}</h1>
    <form class="card form" @submit.prevent="submit">
      <label>Machine / Asset ID</label>
      <input v-model="machineAssetId" placeholder="MCH-001" required />
      <label>Deskripsi Masalah</label>
      <textarea v-model="problemDescription" rows="4" placeholder="Jelaskan masalahnya (min. 10 karakter)..." required />
      <label>Prioritas</label>
      <select v-model="priority">
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="critical">Critical</option>
      </select>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn primary" :disabled="busy">{{ busy ? 'Menyimpan…' : 'Simpan' }}</button>
    </form>
  </section>
</template>
