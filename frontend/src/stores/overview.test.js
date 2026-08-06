import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ getOverview: vi.fn() }))
vi.mock('../api/overview', () => api)

import { useOverviewStore } from './overview'

describe('overview store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads assignments and progress summaries for the personal center', async () => {
    api.getOverview.mockResolvedValue({
      assignments: [{ id: 'assignment-1', target_label: '物流专题测验' }],
      knowledge: { unique_answered_count: 12 },
      scenario: { completed_scenario_count: 3 },
    })
    const store = useOverviewStore()

    await store.loadOverview()

    expect(store.data.assignments[0].target_label).toBe('物流专题测验')
    expect(store.data.knowledge.unique_answered_count).toBe(12)
    expect(store.status).toBe('ready')
  })

  it('exposes an API error state when the overview cannot load', async () => {
    api.getOverview.mockRejectedValue(new Error('服务不可用'))
    const store = useOverviewStore()

    await store.loadOverview()

    expect(store.data).toBeNull()
    expect(store.status).toBe('error')
    expect(store.error).toBe('服务不可用')
  })
})
