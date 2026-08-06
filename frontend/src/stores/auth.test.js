import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ getCurrentUser: vi.fn(), logout: vi.fn() }))
vi.mock('../api/auth', () => api)

import { useAuthStore } from './auth'

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads the current user from the secure cookie session', async () => {
    api.getCurrentUser.mockResolvedValue({ id: 'user-1', role: 'learner' })
    const store = useAuthStore()

    await store.ensureLoaded()

    expect(store.user).toEqual({ id: 'user-1', role: 'learner' })
    expect(store.loaded).toBe(true)
  })

  it('treats an authentication error as a signed-out session', async () => {
    api.getCurrentUser.mockRejectedValue({ status: 401 })
    const store = useAuthStore()

    await store.ensureLoaded()

    expect(store.user).toBeNull()
    expect(store.loaded).toBe(true)
  })
})
