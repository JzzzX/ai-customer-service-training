import { defineStore } from 'pinia'

import { getHealth } from '../api/system'

export const useSystemStore = defineStore('system', {
  state: () => ({ health: null, status: 'idle', error: null }),
  actions: {
    async loadHealth() {
      this.status = 'loading'
      this.error = null
      try {
        this.health = await getHealth()
        this.status = 'ready'
      } catch (error) {
        this.health = null
        this.status = 'error'
        this.error = error.message
      }
    },
  },
})
