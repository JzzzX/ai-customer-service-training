import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { useScenarioCatalogStore } from '../stores/scenarioCatalog'
import ScenarioCatalogView from './ScenarioCatalogView.vue'

describe('ScenarioCatalogView', () => {
  it('renders a published scenario entry and start action', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useScenarioCatalogStore().items = [
      { id: 'scenario-1', title: '退货咨询', category: 'presale', summary: '处理退货' },
    ]
    useScenarioCatalogStore().status = 'ready'

    const wrapper = mount(ScenarioCatalogView, {
      global: {
        plugins: [pinia],
        stubs: { RouterLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } },
      },
    })

    expect(wrapper.text()).toContain('退货咨询')
    expect(wrapper.findAll('a')[1].attributes('href')).toContain('/practice/scenario/scenario-1')
  })
})
