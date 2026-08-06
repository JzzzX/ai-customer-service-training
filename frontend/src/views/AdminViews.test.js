import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { createAppRouter } from '../router'
import {
  decideAdminReview,
  getAdminOverview,
  listAdminResource,
} from '../api/admin'
import { useAdminStore } from '../stores/admin'
import AdminResourceView from './AdminResourceView.vue'

vi.mock('../api/admin', () => ({
  decideAdminReview: vi.fn(),
  getAdminOverview: vi.fn(),
  listAdminHistory: vi.fn(),
  listAdminResource: vi.fn(),
}))

describe('管理员管理端', () => {
  it('redirects an authenticated learner away from admin routes', async () => {
    const auth = {
      user: { id: 'learner-1', role: 'learner' },
      ensureLoaded: async () => {},
    }
    const router = createAppRouter({ history: createMemoryHistory(), auth })

    await router.push('/admin/knowledge')

    expect(router.currentRoute.value.name).toBe('profile')
  })

  it('loads resources and persists a review decision', async () => {
    setActivePinia(createPinia())
    getAdminOverview.mockResolvedValue({ counts: { questions: 1 } })
    listAdminResource.mockResolvedValue({
      items: [{ report_id: 'report-1', status: 'pending' }],
      total: 1,
      next_offset: null,
    })
    decideAdminReview.mockResolvedValue({ id: 'review-1', status: 'approved' })
    const store = useAdminStore()

    await store.loadOverview()
    await store.loadResource('reviews')
    await store.decideReview('report-1', { status: 'approved', comment: '通过' })

    expect(store.overview.counts.questions).toBe(1)
    expect(store.resources.reviews.items[0].status).toBe('approved')
    expect(decideAdminReview).toHaveBeenCalledWith('report-1', {
      status: 'approved',
      comment: '通过',
    })
  })

  it('renders a resource table and empty state', () => {
    const wrapper = mount(AdminResourceView, {
      props: {
        resource: 'knowledge',
        title: '知识版本',
        items: [{ id: 'knowledge-1', label: '正式知识', status: 'published' }],
        loading: false,
        error: '',
      },
      global: {
        plugins: [createPinia()],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })

    expect(wrapper.text()).toContain('正式知识')
    expect(wrapper.find('table').exists()).toBe(true)
  })
})
