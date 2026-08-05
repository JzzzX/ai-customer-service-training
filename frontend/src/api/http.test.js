import { describe, expect, it } from 'vitest'

import { normalizeApiError } from './http'

describe('normalizeApiError', () => {
  it('preserves the backend error contract', () => {
    const error = normalizeApiError({
      response: {
        status: 503,
        data: {
          code: 'DATABASE_UNAVAILABLE',
          message: '数据库暂不可用。',
          details: null,
          request_id: 'request-1',
        },
      },
    })

    expect(error.code).toBe('DATABASE_UNAVAILABLE')
    expect(error.message).toBe('数据库暂不可用。')
    expect(error.requestId).toBe('request-1')
    expect(error.status).toBe(503)
  })
})
