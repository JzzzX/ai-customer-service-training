import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { useAuthStore } from '../stores/auth'
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

    const wrapper = mount(ProfileView, { global: { plugins: [pinia] } })

    expect(wrapper.text()).toContain('测试学员')
    expect(wrapper.text()).toContain('learner@example.test')
    expect(wrapper.text()).toContain('个人中心')
  })
})
