import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import { getHealth } from '../api/system'
import MigrationHealthView from './MigrationHealthView.vue'

vi.mock('../api/system', () => ({ getHealth: vi.fn() }))

describe('MigrationHealthView', () => {
  it('shows the connected FastAPI service', async () => {
    getHealth.mockResolvedValue({
      service: 'ai-customer-service-training-api',
      status: 'ok',
      version: '0.1.0',
    })
    const wrapper = mount(MigrationHealthView, {
      global: { plugins: [createPinia()] },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('FastAPI 连接正常')
    expect(wrapper.text()).toContain('ai-customer-service-training-api')
  })
})
