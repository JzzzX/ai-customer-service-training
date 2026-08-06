import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ScenarioChat from './ScenarioChat.vue'

describe('ScenarioChat', () => {
  it('renders ordered bubbles and emits a learner message', async () => {
    const wrapper = mount(ScenarioChat, {
      props: {
        messages: [
          { id: '1', sender: 'customer', content: '您好' },
          { id: '2', sender: 'learner', content: '我先确认订单' },
        ],
        disabled: false,
      },
    })

    await wrapper.get('textarea').setValue('说明规则')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.text()).toContain('您好')
    expect(wrapper.emitted('send')[0]).toEqual(['说明规则'])
  })
})
