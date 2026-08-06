import { defineStore } from 'pinia'

import { getScenarioHistory, getScenarioHistorySessions } from '../api/scenario'

export const useScenarioHistoryStore = defineStore('scenarioHistory', {
  state: () => ({
    groups: [],
    sessionsByScenario: {},
    status: 'idle',
    statusFilter: 'all',
    cursor: null,
    expanded: [],
    error: null,
  }),
  actions: {
    async load(status = this.statusFilter) {
      this.status = 'loading'
      this.statusFilter = status
      this.cursor = null
      this.error = null
      try {
        const result = await getScenarioHistory({ status })
        this.groups = result.groups
        this.cursor = result.next_cursor
        this.sessionsByScenario = {}
        this.status = 'ready'
        return result
      } catch (error) {
        this.groups = []
        this.status = 'error'
        this.error = error.message
        throw error
      }
    },
    async toggle(scenarioId) {
      const index = this.expanded.indexOf(scenarioId)
      if (index >= 0) {
        this.expanded.splice(index, 1)
        return
      }
      this.expanded.push(scenarioId)
      if (!this.sessionsByScenario[scenarioId]) {
        this.sessionsByScenario[scenarioId] = { items: [], next_cursor: null, status: 'loading' }
        try {
          const result = await getScenarioHistorySessions(scenarioId, { status: this.statusFilter })
          this.sessionsByScenario[scenarioId] = { ...result, status: 'ready' }
        } catch (error) {
          this.sessionsByScenario[scenarioId] = { items: [], next_cursor: null, status: 'error', error: error.message }
        }
      }
    },
    async loadMore(scenarioId) {
      const current = this.sessionsByScenario[scenarioId]
      if (!current?.next_cursor) return
      const result = await getScenarioHistorySessions(scenarioId, {
        status: this.statusFilter,
        cursor: current.next_cursor,
      })
      this.sessionsByScenario[scenarioId] = {
        ...result,
        items: [...current.items, ...result.items],
        status: 'ready',
      }
    },
  },
})
