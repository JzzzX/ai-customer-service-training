import { defineStore } from 'pinia'

import {
  decideAdminReview,
  getAdminOverview,
  listAdminHistory,
  listAdminResource,
} from '../api/admin'

const resourceNames = ['knowledge', 'questions', 'scenarios', 'assignments', 'reviews', 'history']

function emptyResource() {
  return { items: [], total: 0, next_offset: null }
}

export const useAdminStore = defineStore('admin', {
  state: () => ({
    overview: null,
    resources: Object.fromEntries(resourceNames.map((name) => [name, emptyResource()])),
    loading: false,
    resourceStatus: Object.fromEntries(resourceNames.map((name) => [name, 'idle'])),
    error: null,
  }),
  actions: {
    async loadOverview() {
      this.loading = true
      this.error = null
      try {
        this.overview = await getAdminOverview()
      } catch (error) {
        this.error = error.message
      } finally {
        this.loading = false
      }
    },
    async loadResource(name, params = {}) {
      if (!resourceNames.includes(name)) return
      this.resourceStatus[name] = 'loading'
      this.error = null
      try {
        const result = name === 'history'
          ? await listAdminHistory(params)
          : await listAdminResource(name, params)
        this.resources[name] = result
        this.resourceStatus[name] = 'ready'
      } catch (error) {
        this.resources[name] = emptyResource()
        this.resourceStatus[name] = 'error'
        this.error = error.message
      }
    },
    async decideReview(reportId, payload) {
      const result = await decideAdminReview(reportId, payload)
      const reviews = this.resources.reviews.items.map((item) => (
        item.report_id === reportId
          ? { ...item, status: result.status, latest_comment: result.comment }
          : item
      ))
      this.resources.reviews = { ...this.resources.reviews, items: reviews }
      return result
    },
  },
})
