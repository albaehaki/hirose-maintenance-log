<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';

interface AuditEntry {
  id: number;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
  actorName: string;
  actorRole: string;
}

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const request = ref<any>(null);
const history = ref<AuditEntry[]>([]);
const error = ref('');

const canEdit = computed(() => {
  if (!request.value) return false;
  if (auth.isAdmin) return true;
  return request.value.createdBy === auth.user?.id && request.value.status === 'submitted';
});

const canReview = computed(() => auth.canReview && request.value?.status === 'submitted');

async function fetchDetail() {
  try {
    const res = await api.get(`/requests/${route.params.id}`);
    request.value = res.data.data;
    const h = await api.get(`/requests/${route.params.id}/history`);
    history.value = h.data.data;
  } catch (e: any) {
    error.value = e.response?.data?.message ?? 'Gagal memuat detail';
  }
}

async function review(status: string) {
  const note = prompt('Catatan review (opsional):') || undefined;
  await api.post(`/requests/${route.params.id}/review`, { status, note: note || undefined });
  await fetchDetail();
}

onMounted(fetchDetail);
</script>

<template>
  <section v-if="request">
    <RouterLink class="back" to="/">← Kembali ke daftar</RouterLink>

    <div class="card">
      <div class="head">
        <h1><code>{{ request.machineAssetId }}</code></h1>
        <span class="pill" :class="request.priority">{{ request.priority }}</span>
        <span class="pill" :class="request.status">{{ request.status }}</span>
      </div>
      <p class="desc">{{ request.problemDescription }}</p>
      <div class="meta">
        <p>Dibuat oleh: user #{{ request.createdBy }} — {{ new Date(request.createdAt).toLocaleString('id-ID') }}</p>
        <p v-if="request.reviewedBy">
          Direview oleh: user #{{ request.reviewedBy }} — {{ new Date(request.reviewedAt).toLocaleString('id-ID') }}
        </p>
      </div>
      <div class="actions">
        <RouterLink v-if="canEdit" class="btn primary" :to="`/requests/${request.id}/edit`">Edit</RouterLink>
        <template v-if="canReview">
          <button class="btn ok" @click="review('approved')">Approve</button>
          <button class="btn no" @click="review('rejected')">Reject</button>
        </template>
      </div>
    </div>

    <!-- ⭐ Bonus: audit trail timeline -->
    <div class="card" v-if="history.length">
      <h2>Riwayat Status</h2>
      <ul class="timeline">
        <li v-for="h in history" :key="h.id">
          <span class="pill" :class="h.toStatus">{{ h.toStatus }}</span>
          <span class="meta-inline">
            oleh {{ h.actorName }} ({{ h.actorRole }}) — {{ new Date(h.createdAt).toLocaleString('id-ID') }}
          </span>
          <p v-if="h.note" class="note">“{{ h.note }}”</p>
        </li>
      </ul>
    </div>

    <p v-else-if="error" class="error">{{ error }}</p>
  </section>
  <section v-else>
    <p class="muted">Memuat…</p>
  </section>
</template>
