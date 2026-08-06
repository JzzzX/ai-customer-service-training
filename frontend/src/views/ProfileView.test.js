import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { useAuthStore } from '../stores/auth'
import { useOverviewStore } from '../stores/overview'
import ProfileView from './ProfileView.vue'

describe('ProfileView', () => {
  it('renders the authenticated user identity and migration status', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().user = {
      id: 'user-1',
      name: '测试学员',
      email: 'learner@example.test',
      role: 'learner',
    }
    useOverviewStore().data = {
      assignments: [{ id: 'assignment-1', target_label: '物流专题测验' }],
      knowledge: {
        total_questions: 40,
        unique_answered_count: 12,
        accuracy: 83,
      },
      scenario: {
        published_scenario_count: 8,
        completed_scenario_count: 3,
        completed_session_count: 5,
        recent_average_score: 86,
      },
    }

    const wrapper = mount(ProfileView, {
      global: {
        plugins: [pinia],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })

    expect(wrapper.text()).toContain('测试学员')
    expect(wrapper.text()).toContain('learner@example.test')
    expect(wrapper.text()).toContain('个人中心')
    expect(wrapper.text()).toContain('物流专题测验')
    expect(wrapper.text()).toContain('12 / 40 题')
    expect(wrapper.text()).toContain('3 / 8 个场景')
  })
})
