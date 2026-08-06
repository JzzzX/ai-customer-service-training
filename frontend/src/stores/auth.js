import { defineStore } from 'pinia'

import { getCurrentUser, logout as logoutRequest } from '../api/auth'
import { useScenarioCatalogStore } from './scenarioCatalog'
import { useScenarioHistoryStore } from './scenarioHistory'
import { useScenarioTrainingStore } from './scenarioTraining'

export const useAuthStore = defineStore('auth', {
  state: () => ({ user: null, loaded: false }),
  actions: {
    async ensureLoaded() {
      if (this.loaded) return
      try {
        this.user = await getCurrentUser()
      } catch (error) {
        if (error.status !== 401) throw error
        this.user = null
      } finally {
        this.loaded = true
      }
    },
    async logout() {
      await logoutRequest()
      useScenarioCatalogStore().reset()
      useScenarioHistoryStore().$reset()
      useScenarioTrainingStore().clear()
      this.user = null
      this.loaded = true
    },
  },
})
