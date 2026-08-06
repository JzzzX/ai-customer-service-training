import { defineStore } from 'pinia'

import {
  completeScenarioReport,
  getScenarioSession,
  retryScenarioReport,
  sendScenarioMessage,
  startScenarioSession,
} from '../api/scenario'

export const useScenarioTrainingStore = defineStore('scenarioTraining', {
  state: () => ({
    session: null,
    status: 'idle',
    sendStatus: 'idle',
    reportStatus: 'idle',
    report: null,
    reportEvents: [],
    error: null,
  }),
  actions: {
    async start(scenarioId) {
      this.status = 'loading'
      this.error = null
      try {
        this.session = await startScenarioSession(scenarioId)
        this.status = 'ready'
        return this.session
      } catch (error) {
        this.status = 'error'
        this.error = error.message
        throw error
      }
    },
    async load(sessionId) {
      this.status = 'loading'
      this.error = null
      try {
        this.session = await getScenarioSession(sessionId)
        this.report = this.session.report ?? null
        this.status = 'ready'
        return this.session
      } catch (error) {
        this.status = 'error'
        this.error = error.message
        throw error
      }
    },
    async send(content) {
      if (!this.session) return
      this.sendStatus = 'loading'
      this.error = null
      try {
        const result = await sendScenarioMessage(this.session.id, {
          content,
          expected_turn_count: this.session.turn_count,
        })
        this.session = result.session
        this.sendStatus = 'ready'
        return result
      } catch (error) {
        this.sendStatus = 'error'
        this.error = error.message
        throw error
      }
    },
    async complete() {
      if (!this.session) return
      this.reportStatus = 'loading'
      this.reportEvents = []
      this.error = null
      try {
        await completeScenarioReport(this.session.id, (event) => {
          this.reportEvents.push(event)
          if (event.event === 'report') this.report = event.data.report ?? event.data
        })
        this.reportStatus = 'ready'
        if (this.report) this.session = { ...this.session, status: 'completed', report: this.report }
        return this.report
      } catch (error) {
        this.reportStatus = 'error'
        this.error = error.message
        throw error
      }
    },
    async retry() {
      if (!this.session) return
      this.reportStatus = 'loading'
      this.error = null
      try {
        const session = await retryScenarioReport(this.session.id)
        this.session = session
        this.report = session.report
        this.reportStatus = 'ready'
        return this.report
      } catch (error) {
        this.reportStatus = 'error'
        this.error = error.message
        throw error
      }
    },
    clear() {
      this.$reset()
    },
  },
})
