import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { createAppRouter } from './index'

describe('router', () => {
  it('redirects anonymous users to Feishu login', async () => {
    const auth = { user: null, ensureLoaded: async () => {} }
    const router = createAppRouter({ history: createMemoryHistory(), auth })
    router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/profile')
  })

  it('allows authenticated users into the personal center', async () => {
    const auth = { user: { id: 'user-1' }, ensureLoaded: async () => {} }
    const router = createAppRouter({ history: createMemoryHistory(), auth })
    router.push('/profile')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('profile')
  })

  it('keeps the published quiz catalog readable without login', async () => {
    const auth = { user: null, ensureLoaded: async () => {} }
    const router = createAppRouter({ history: createMemoryHistory(), auth })
    router.push('/practice/quiz/topics')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('quiz-topics')
  })
})
