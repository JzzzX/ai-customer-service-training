import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getHealth } from '../api/system'
import { useSystemStore } from './system'

vi.mock('../api/system', () => ({ getHealth: vi.fn() }))

describe('useSystemStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads the FastAPI health response', async () => {
    getHealth.mockResolvedValue({
      service: 'ai-customer-service-training-api',
      status: 'ok',
      version: '0.1.0',
    })
    const store = useSystemStore()

    const pending = store.loadHealth()
    expect(store.status).toBe('loading')
    await pending

    expect(store.status).toBe('ready')
    expect(store.health.service).toBe('ai-customer-service-training-api')
  })

  it('keeps the API error message', async () => {
    getHealth.mockRejectedValue(new Error('数据库暂不可用。'))
    const store = useSystemStore()

    await store.loadHealth()

    expect(store.status).toBe('error')
    expect(store.error).toBe('数据库暂不可用。')
  })
})
