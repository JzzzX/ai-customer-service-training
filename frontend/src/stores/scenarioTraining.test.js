import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import {
  completeScenarioReport,
  getScenarioSession,
  sendScenarioMessage,
} from '../api/scenario'
import { useScenarioTrainingStore } from './scenarioTraining'

vi.mock('../api/scenario', () => ({
  startScenarioSession: vi.fn(),
  getScenarioSession: vi.fn(),
  sendScenarioMessage: vi.fn(),
  completeScenarioReport: vi.fn(),
  retryScenarioReport: vi.fn(),
}))

describe('scenario training store', () => {
  it('restores server session and appends a customer exchange', async () => {
    setActivePinia(createPinia())
    const session = { id: 'session-1', turn_count: 0, messages: [] }
    getScenarioSession.mockResolvedValueOnce(session)
    sendScenarioMessage.mockResolvedValueOnce({
      session: { ...session, turn_count: 1, messages: [{ sender: 'learner' }, { sender: 'customer' }] },
      customer_chunks: ['回复'],
    })
    const store = useScenarioTrainingStore()

    await store.load('session-1')
    await store.send('我先确认订单')

    expect(store.session.turn_count).toBe(1)
    expect(sendScenarioMessage).toHaveBeenCalledWith('session-1', {
      content: '我先确认订单',
      expected_turn_count: 0,
    })
  })

  it('records report SSE phases and final report', async () => {
    setActivePinia(createPinia())
    const store = useScenarioTrainingStore()
    store.session = { id: 'session-1', turn_count: 1, messages: [] }
    completeScenarioReport.mockImplementationOnce(async (_id, onEvent) => {
      onEvent({ event: 'analyzing', data: { message: '分析中' } })
      onEvent({ event: 'report', data: { report: { total_score: 88 } } })
    })

    await store.complete()

    expect(store.report.total_score).toBe(88)
    expect(store.reportEvents.map((item) => item.event)).toEqual(['analyzing', 'report'])
  })
})
