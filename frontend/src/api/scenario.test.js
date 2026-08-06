import { describe, expect, it, vi } from 'vitest'

import { parseSseText, getScenarioCatalog, getScenarioHistory } from './scenario'
import { http } from './http'

vi.mock('./http', () => ({
  http: { get: vi.fn() },
}))

describe('scenario api', () => {
  it('parses multiple SSE events and JSON payloads', () => {
    const events = parseSseText(
      'event: analyzing\ndata: {"message":"分析中"}\n\n' +
        'event: report\ndata: {"total_score":88}\n\n',
    )

    expect(events).toEqual([
      { event: 'analyzing', data: { message: '分析中' } },
      { event: 'report', data: { total_score: 88 } },
    ])
  })

  it('uses stable backend history and catalog paths', async () => {
    http.get.mockResolvedValueOnce({ data: { items: [] } }).mockResolvedValueOnce({ data: { groups: [] } })

    await getScenarioCatalog()
    await getScenarioHistory({ status: 'active', limit: 10 })

    expect(http.get).toHaveBeenNthCalledWith(1, '/scenarios')
    expect(http.get).toHaveBeenNthCalledWith(2, '/me/scenario-history', {
      params: { status: 'active', limit: 10 },
    })
  })
})
