import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import { useQuizAttemptStore } from '../stores/quizAttempt'
import QuizAttemptView from './QuizAttemptView.vue'

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

async function mountView(configureStore) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useQuizAttemptStore()
  configureStore(store)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/practice/quiz/topics', component: { template: '<div />' } },
      { path: '/practice/quiz/topics/:topicId', component: QuizAttemptView },
    ],
  })
  await router.push('/practice/quiz/topics/returns')
  await router.isReady()
  const wrapper = mount(QuizAttemptView, {
    global: { plugins: [pinia, router] },
  })
  return { wrapper, store }
}

describe('QuizAttemptView', () => {
  it('renders questions and submits the selected option', async () => {
    const { wrapper, store } = await mountView((configured) => {
      configured.attempt = attempt
      configured.status = 'ready'
      configured.submitStatus = 'idle'
      vi.spyOn(configured, 'submitAttempt').mockResolvedValue()
    })

    expect(wrapper.text()).toContain('退换货')
    expect(wrapper.text()).toContain('哪项属于可退商品？')
    await wrapper.get('input[value="A"]').setValue(true)
    await wrapper.get('form').trigger('submit')

    expect(store.submitAttempt).toHaveBeenCalled()
  })

  it('renders server feedback after submission', async () => {
    const { wrapper } = await mountView((configured) => {
      configured.attempt = attempt
      configured.status = 'ready'
      configured.submitStatus = 'ready'
      configured.result = {
        score: 100,
        status: 'passed',
        correct_count: 1,
        total_questions: 1,
        answers: [
          {
            question_id: 'question-1',
            selected_answers: ['A'],
            is_correct: true,
            correct_answers: ['A'],
            explanation: '符合退换货规则。',
          },
        ],
      }
    })

    expect(wrapper.text()).toContain('100 分')
    expect(wrapper.text()).toContain('符合退换货规则。')
    expect(wrapper.text()).toContain('回答正确')
  })
})
