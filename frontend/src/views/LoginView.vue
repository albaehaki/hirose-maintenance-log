<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    await auth.login(email.value, password.value);
    router.push((route.query.redirect as string) || '/');
  } catch (e: any) {
    error.value = e.response?.data?.message ?? 'Gagal login';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="login-wrap">
    <form class="card login" @submit.prevent="submit">
      <h1>Maintenance Request Log</h1>
      <p class="muted">Masuk untuk melanjutkan</p>
      <input v-model="email" type="email" placeholder="email" autocomplete="username" required />
      <input v-model="password" type="password" placeholder="password" autocomplete="current-password" required />
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn primary" :disabled="busy">{{ busy ? 'Memproses…' : 'Masuk' }}</button>
      <div class="hint">
        <p>Akun seed (lihat README):</p>
        <p>• operator@hirose.test / Operator123!</p>
        <p>• supervisor@hirose.test / Supervisor123!</p>
        <p>• admin@hirose.test / Admin123!</p>
      </div>
    </form>
  </div>
</template>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f4f5f7;
}
.login {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hint {
  font-size: 12px;
  color: #666;
  background: #f9fafb;
  padding: 10px;
  border-radius: 8px;
}
.hint p {
  margin: 2px 0;
}
</style>
