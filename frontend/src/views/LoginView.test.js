import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LoginView from './LoginView.vue'

describe('LoginView', () => {
  it('starts login through the backend Feishu endpoint', () => {
    const wrapper = mount(LoginView)

    expect(wrapper.get('a').attributes('href')).toBe('/api/v1/auth/feishu/login')
    expect(wrapper.get('a').text()).toContain('飞书登录')
  })
})
