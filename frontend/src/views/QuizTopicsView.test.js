import { mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { useCatalogStore } from '../stores/catalog'
import QuizTopicsView from './QuizTopicsView.vue'


function mountView(configureStore) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useCatalogStore()
  configureStore(store)
  return mount(QuizTopicsView, {
    global: {
      plugins: [pinia],
      stubs: { RouterLink: RouterLinkStub },
    },
  })
}


describe('QuizTopicsView', () => {
  it('renders the published topics, counts, and stable practice links', () => {
    const wrapper = mountView((store) => {
      store.status = 'ready'
      store.knowledgeVersion = 'knowledge-2026-08'
      store.topics = [
        {
          id: 'pet-nutrition',
          label: '宠物营养',
          question_count: 12,
          description: '宠物食品与营养知识专题',
        },
      ]
    })

    expect(wrapper.text()).toContain('宠物营养')
    expect(wrapper.text()).toContain('12 题')
    expect(wrapper.text()).toContain('宠物食品与营养知识专题')
    expect(wrapper.getComponent(RouterLinkStub).props('to')).toBe(
      '/practice/quiz/topics/pet-nutrition',
    )
  })

  it('renders an honest empty state when no topic is published', () => {
    const wrapper = mountView((store) => {
      store.status = 'ready'
      store.topics = []
    })

    expect(wrapper.text()).toContain('暂时没有已发布的练习专题')
  })

  it('renders the catalog error state', () => {
    const wrapper = mountView((store) => {
      store.status = 'error'
      store.error = '目录服务暂时不可用'
    })

    expect(wrapper.get('[role="alert"]').text()).toContain('目录服务暂时不可用')
  })
})
