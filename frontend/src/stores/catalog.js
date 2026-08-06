import { defineStore } from 'pinia'

import { getQuizTopics } from '../api/catalog'

export const useCatalogStore = defineStore('catalog', {
  state: () => ({
    topics: [],
    knowledgeVersion: null,
    status: 'idle',
    error: null,
  }),
  actions: {
    async loadTopics() {
      if (this.status === 'loading' || this.status === 'ready') return
      this.status = 'loading'
      this.error = null
      try {
        const catalog = await getQuizTopics()
        this.topics = catalog.topics
        this.knowledgeVersion = catalog.knowledge_version
        this.status = 'ready'
      } catch (error) {
        this.topics = []
        this.knowledgeVersion = null
        this.status = 'error'
        this.error = error.message
      }
    },
  },
})
