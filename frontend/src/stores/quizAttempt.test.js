import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getQuizProgress: vi.fn(),
  startQuizAttempt: vi.fn(),
  submitQuizAttempt: vi.fn(),
}))
vi.mock('../api/catalog', () => api)

import { useQuizAttemptStore } from './quizAttempt'

const attempt = {
  attempt_id: 'attempt-1',
  topic_id: 'returns',
  topic_label: '退换货',
  passing_score: 80,
  questions: [
    {
      id: 'question-1',
      prompt: '哪项属于可退商品？',
      options: ['A', 'B'],
      question_type: 'single_choice',
      category: 'returns',
      difficulty: 'easy',
      position: 1,
    },
  ],
}

describe('quiz attempt store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('starts an attempt without exposing answers and submits selections in question order', async () => {
    api.startQuizAttempt.mockResolvedValue(attempt)
    api.submitQuizAttempt.mockResolvedValue({
      attempt_id: 'attempt-1',
      score: 100,
      status: 'passed',
      answers: [],
    })
    const store = useQuizAttemptStore()

    await store.startAttempt('returns')
    store.selectAnswer('question-1', ['A'])
    await store.submitAttempt()

    expect(api.startQuizAttempt).toHaveBeenCalledWith('returns')
    expect(api.submitQuizAttempt).toHaveBeenCalledWith('attempt-1', {
      answers: [{ question_id: 'question-1', selected_answers: ['A'] }],
    })
    expect(store.result.status).toBe('passed')
    expect(store.submitStatus).toBe('ready')
  })

  it('keeps API failures visible and clears stale attempt state on a new start', async () => {
    api.startQuizAttempt.mockResolvedValue(attempt)
    const store = useQuizAttemptStore()
    await store.startAttempt('returns')
    store.selectAnswer('question-1', ['A'])

    api.startQuizAttempt.mockRejectedValue(new Error('专题暂无题目'))
    await store.startAttempt('empty-topic')

    expect(store.attempt).toBeNull()
    expect(store.answers).toEqual({})
    expect(store.status).toBe('error')
    expect(store.error).toBe('专题暂无题目')
  })
})
