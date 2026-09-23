import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
    { path: '/', name: 'requests', component: () => import('./views/RequestListView.vue') },
    { path: '/requests/new', name: 'request-new', component: () => import('./views/RequestFormView.vue') },
    { path: '/requests/:id', name: 'request-detail', component: () => import('./views/RequestDetailView.vue') },
    { path: '/requests/:id/edit', name: 'request-edit', component: () => import('./views/RequestFormView.vue') },
    { path: '/users', name: 'users', component: () => import('./views/UsersView.vue'), meta: { adminOnly: true } },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.load();
  if (to.meta.public) return true;
  if (!auth.user) return { name: 'login', query: { redirect: to.fullPath } };
  if (to.meta.adminOnly && !auth.isAdmin) return { name: 'requests' };
  return true;
});

export default router;
