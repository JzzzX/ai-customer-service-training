import { createRouter, createWebHistory } from 'vue-router'

import MigrationHealthView from '../views/MigrationHealthView.vue'

export const routes = [
  { path: '/', redirect: '/migration/health' },
  {
    path: '/migration/health',
    name: 'migration-health',
    component: MigrationHealthView,
  },
]

export default createRouter({ history: createWebHistory(), routes })
