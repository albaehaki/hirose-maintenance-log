<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from './stores/auth';

const auth = useAuthStore();
const sidebarOpen = ref(false);

function closeSidebar() {
  sidebarOpen.value = false;
}

async function doLogout() {
  await auth.logout();
  window.location.href = '/login';
}
</script>

<template>
  <div class="shell" :class="{ 'sidebar-open': sidebarOpen }">
    <!-- Backdrop (mobile) -->
    <div v-if="sidebarOpen" class="backdrop" @click="closeSidebar"></div>

    <!-- Sidebar — hanya tampil setelah login -->
    <aside v-if="auth.user" class="sidebar">
      <div class="brand">
        <span class="brand-mark">M</span>
        <div class="brand-text">
          <strong>Maintenance Log</strong>
          <small>PT Hirose Electric</small>
        </div>
      </div>

      <nav class="nav" aria-label="Menu utama">
        <RouterLink to="/" class="nav-item" @click="closeSidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M8 6h13M8 12h13M8 18h13" />
            <path d="M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
          <span>Daftar Request</span>
        </RouterLink>

        <RouterLink to="/requests/new" class="nav-item" @click="closeSidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Request Baru</span>
        </RouterLink>

        <RouterLink v-if="auth.canManageUsers" to="/users" class="nav-item" @click="closeSidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Kelola User</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <div class="user-chip">
          <span class="avatar">{{ auth.user?.name?.charAt(0) ?? '?' }}</span>
          <div class="user-meta">
            <strong>{{ auth.user?.name }}</strong>
            <small>{{ auth.user?.role }}</small>
          </div>
        </div>
        <button class="logout-btn" @click="doLogout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>
    </aside>

    <!-- Area konten -->
    <div class="main">
      <!-- Top bar mobile -->
      <header v-if="auth.user" class="mobile-bar">
        <button class="icon-btn" aria-label="Buka menu" @click="sidebarOpen = true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <strong class="mobile-title">Maintenance Log</strong>
      </header>

      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>
