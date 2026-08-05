import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { routes } from './index'

describe('router', () => {
  it('redirects the root route to the migration health page', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('migration-health')
    expect(router.currentRoute.value.fullPath).toBe('/migration/health')
  })
})
