import { defineStore } from 'pinia'

import { getOverview } from '../api/overview'

export const useOverviewStore = defineStore('overview', {
  state: () => ({ data: null, status: 'idle', error: null }),
  actions: {
    async loadOverview() {
      if (this.data || this.status === 'loading') return
      this.status = 'loading'
      this.error = null
      try {
        this.data = await getOverview()
        this.status = 'ready'
      } catch (error) {
        this.data = null
        this.status = 'error'
        this.error = error.message
      }
    },
  },
})
