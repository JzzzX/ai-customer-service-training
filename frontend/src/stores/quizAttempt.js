import { defineStore } from 'pinia'

import {
  getQuizProgress,
  startQuizAttempt,
  submitQuizAttempt,
} from '../api/catalog'

export const useQuizAttemptStore = defineStore('quizAttempt', {
  state: () => ({
    attempt: null,
    answers: {},
    result: null,
    status: 'idle',
    submitStatus: 'idle',
    progress: null,
    progressStatus: 'idle',
    error: null,
  }),
  actions: {
    async startAttempt(topicId) {
      this.status = 'loading'
      this.submitStatus = 'idle'
      this.attempt = null
      this.answers = {}
      this.result = null
      this.error = null
      try {
        this.attempt = await startQuizAttempt(topicId)
        this.status = 'ready'
      } catch (error) {
        this.status = 'error'
        this.error = error.message
      }
    },
    selectAnswer(questionId, selectedAnswers) {
      this.answers[questionId] = [...selectedAnswers]
    },
    async submitAttempt() {
      if (!this.attempt || this.submitStatus === 'loading') return
      this.submitStatus = 'loading'
      this.error = null
      try {
        const answers = this.attempt.questions.map((question) => ({
          question_id: question.id,
          selected_answers: this.answers[question.id] ?? [],
        }))
        this.result = await submitQuizAttempt(this.attempt.attempt_id, { answers })
        this.submitStatus = 'ready'
      } catch (error) {
        this.submitStatus = 'error'
        this.error = error.message
      }
    },
    async loadProgress() {
      if (this.progressStatus === 'loading') return
      this.progressStatus = 'loading'
      try {
        this.progress = await getQuizProgress()
        this.progressStatus = 'ready'
      } catch (error) {
        this.progressStatus = 'error'
        this.error = error.message
      }
    },
  },
})
