import { defineStore } from 'pinia'

import { getScenarioCatalog } from '../api/scenario'

export const useScenarioCatalogStore = defineStore('scenarioCatalog', {
  state: () => ({ items: [], status: 'idle', error: null }),
  actions: {
    async load() {
      if (this.status === 'loading' || this.status === 'ready') return
      this.status = 'loading'
      this.error = null
      try {
        const catalog = await getScenarioCatalog()
        this.items = catalog.items
        this.status = 'ready'
      } catch (error) {
        this.items = []
        this.status = 'error'
        this.error = error.message
      }
    },
    reset() {
      this.items = []
      this.status = 'idle'
      this.error = null
    },
  },
})
