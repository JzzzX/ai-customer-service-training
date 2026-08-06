import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import { getScenarioCatalog } from '../api/scenario'
import { useScenarioCatalogStore } from './scenarioCatalog'

vi.mock('../api/scenario', () => ({ getScenarioCatalog: vi.fn() }))

describe('scenario catalog store', () => {
  it('loads published scenario cards and exposes errors', async () => {
    setActivePinia(createPinia())
    getScenarioCatalog.mockResolvedValueOnce({ items: [{ id: 'scenario-1', title: '退货咨询' }] })
    const store = useScenarioCatalogStore()

    await store.load()

    expect(store.status).toBe('ready')
    expect(store.items[0].title).toBe('退货咨询')
  })
})
