import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '../api';

export type Role = 'operator' | 'supervisor' | 'admin';
export interface Me {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<Me | null>(null);
  const ready = ref(false);

  const isAdmin = computed(() => user.value?.role === 'admin');
  const canViewAll = computed(() => user.value?.role === 'supervisor' || isAdmin.value);
  const canReview = computed(() => user.value?.role === 'supervisor' || isAdmin.value);
  const canDelete = computed(() => isAdmin.value);
  const canManageUsers = computed(() => isAdmin.value);

  async function load() {
    try {
      user.value = (await api.get('/auth/me')).data.data;
    } catch {
      user.value = null;
    } finally {
      ready.value = true;
    }
  }

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    user.value = data.user;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      user.value = null;
    }
  }

  return { user, ready, isAdmin, canViewAll, canReview, canDelete, canManageUsers, load, login, logout };
});
