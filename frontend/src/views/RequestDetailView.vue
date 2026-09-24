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

// State modal review
const showReviewModal = ref(false);
const reviewStatus = ref<'approved' | 'rejected'>('approved');
const reviewNote = ref('');
const reviewBusy = ref(false);

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

function openReview(status: 'approved' | 'rejected') {
  reviewStatus.value = status;
  reviewNote.value = '';
  showReviewModal.value = true;
}

function closeReviewModal() {
  if (reviewBusy.value) return;
  showReviewModal.value = false;
}

async function confirmReview() {
  reviewBusy.value = true;
  try {
    await api.post(`/requests/${route.params.id}/review`, {
      status: reviewStatus.value,
      note: reviewNote.value.trim() || undefined,
    });
    showReviewModal.value = false;
    await fetchDetail();
  } catch (e: any) {
    error.value = e.response?.data?.message ?? 'Gagal menyimpan review';
  } finally {
    reviewBusy.value = false;
  }
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
          <button class="btn ok" @click="openReview('approved')">Approve</button>
          <button class="btn no" @click="openReview('rejected')">Reject</button>
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

  <!-- Modal konfirmasi review -->
  <Teleport to="body">
    <div v-if="showReviewModal" class="modal-backdrop" @click.self="closeReviewModal">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
        <header class="modal-head">
          <h2 id="review-modal-title">
            {{ reviewStatus === 'approved' ? 'Approve Request' : 'Reject Request' }}
          </h2>
          <button class="icon-btn" aria-label="Tutup" @click="closeReviewModal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <form class="modal-form" @submit.prevent="confirmReview">
          <p class="modal-desc">
            <code>{{ request?.machineAssetId }}</code> — {{ request?.problemDescription }}
          </p>
          <label>Catatan review (opsional)</label>
          <textarea v-model="reviewNote" rows="3" placeholder="Contoh: sudah dijadwalkan perbaikan…"></textarea>
          <p v-if="error" class="error">{{ error }}</p>
          <div class="modal-actions">
            <button type="button" class="btn ghost" @click="closeReviewModal">Batal</button>
            <button type="button" class="btn" :class="reviewStatus === 'approved' ? 'ok' : 'no'" :disabled="reviewBusy" @click="confirmReview">
              {{ reviewBusy ? 'Menyimpan…' : (reviewStatus === 'approved' ? 'Approve' : 'Reject') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
