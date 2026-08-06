import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ScenarioHistoryTimeline from './ScenarioHistoryTimeline.vue'

describe('ScenarioHistoryTimeline', () => {
  it('folds old sessions and provides accessible load-more control', () => {
    const wrapper = mount(ScenarioHistoryTimeline, {
      props: {
        groups: [
          {
            scenario_id: 'scenario-1',
            title: '退货咨询',
            category: 'presale',
            total_session_count: 2,
            active_session_count: 1,
            completed_session_count: 1,
            latest_activity_at: '2026-08-06T02:00:00Z',
            latest_session: { id: 'session-1', status: 'active', turn_count: 1 },
          },
        ],
        sessionsByScenario: {
          'scenario-1': {
            items: [{ id: 'session-1', status: 'active' }],
            next_cursor: '1',
          },
        },
        expanded: ['scenario-1'],
      },
      global: {
        stubs: { RouterLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } },
      },
    })

    expect(wrapper.find('details').exists()).toBe(true)
    expect(wrapper.text()).toContain('退货咨询')
    expect(wrapper.get('button[aria-label="加载更多退货咨询会话"]').exists()).toBe(true)
  })
})
