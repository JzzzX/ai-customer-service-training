import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ getQuizTopics: vi.fn() }))
vi.mock('../api/catalog', () => api)

import { useCatalogStore } from './catalog'

describe('catalog store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('exposes loading until the published catalog request resolves', async () => {
    let resolveRequest
    api.getQuizTopics.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    const store = useCatalogStore()

    const request = store.loadTopics()

    expect(store.status).toBe('loading')
    resolveRequest({ topics: [], knowledge_version: null })
    await request
    expect(store.status).toBe('ready')
  })

  it('keeps the published knowledge version with an empty topic list', async () => {
    api.getQuizTopics.mockResolvedValue({
      topics: [],
      knowledge_version: 'knowledge-2026-08',
    })
    const store = useCatalogStore()

    await store.loadTopics()

    expect(store.topics).toEqual([])
    expect(store.knowledgeVersion).toBe('knowledge-2026-08')
    expect(store.status).toBe('ready')
  })

  it('exposes the API error without retaining stale topics', async () => {
    api.getQuizTopics.mockRejectedValue(new Error('目录服务暂时不可用'))
    const store = useCatalogStore()
    store.topics = [{ id: 'stale-topic' }]

    await store.loadTopics()

    expect(store.topics).toEqual([])
    expect(store.knowledgeVersion).toBeNull()
    expect(store.status).toBe('error')
    expect(store.error).toBe('目录服务暂时不可用')
  })
})
