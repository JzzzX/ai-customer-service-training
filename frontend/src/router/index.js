import { createRouter, createWebHistory } from 'vue-router'

import LoginView from '../views/LoginView.vue'
import MigrationHealthView from '../views/MigrationHealthView.vue'
import ProfileView from '../views/ProfileView.vue'

export const routes = [
  { path: '/', redirect: '/profile' },
  { path: '/login', name: 'login', component: LoginView, meta: { guest: true } },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: { requiresAuth: true },
  },
  {
    path: '/migration/health',
    name: 'migration-health',
    component: MigrationHealthView,
  },
]

export function createAppRouter({ history = createWebHistory(), auth }) {
  const router = createRouter({ history, routes })
  router.beforeEach(async (to) => {
    await auth.ensureLoaded()
    if (to.meta.requiresAuth && !auth.user) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    if (to.meta.guest && auth.user) return { name: 'profile' }
    return true
  })
  return router
}
