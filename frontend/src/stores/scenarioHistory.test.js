import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import { getScenarioHistory, getScenarioHistorySessions } from '../api/scenario'
import { useScenarioHistoryStore } from './scenarioHistory'

vi.mock('../api/scenario', () => ({
  getScenarioHistory: vi.fn(),
  getScenarioHistorySessions: vi.fn(),
}))

describe('scenario history store', () => {
  it('filters groups and loads folded session pages', async () => {
    setActivePinia(createPinia())
    getScenarioHistory.mockResolvedValueOnce({ groups: [{ scenario_id: 'scenario-1' }], next_cursor: null })
    getScenarioHistorySessions.mockResolvedValueOnce({ items: [{ id: 'session-1' }], next_cursor: null })
    const store = useScenarioHistoryStore()

    await store.load('completed')
    await store.toggle('scenario-1')

    expect(store.statusFilter).toBe('completed')
    expect(store.groups).toHaveLength(1)
    expect(store.sessionsByScenario['scenario-1'].items[0].id).toBe('session-1')
  })
})
