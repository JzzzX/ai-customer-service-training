import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import App from './App.vue'

describe('App', () => {
  it('renders the migration route inside the application shell', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/migration/health',
          component: { template: '<h1>系统状态</h1>' },
        },
      ],
    })
    router.push('/migration/health')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [router] } })

    expect(wrapper.get('header').text()).toContain('AI 客服训练')
    expect(wrapper.get('h1').text()).toBe('系统状态')
  })
})
