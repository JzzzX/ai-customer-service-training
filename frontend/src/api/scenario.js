import { http, ApiError } from './http'

export async function getScenarioCatalog() {
  const response = await http.get('/scenarios')
  return response.data
}

export async function startScenarioSession(scenarioId) {
  const response = await http.post(`/scenarios/${scenarioId}/sessions`)
  return response.data
}

export async function getScenarioSession(sessionId) {
  const response = await http.get(`/scenario-sessions/${sessionId}`)
  return response.data
}

export async function sendScenarioMessage(sessionId, payload) {
  const response = await http.post(`/scenario-sessions/${sessionId}/messages`, payload)
  return response.data
}

export async function retryScenarioReport(sessionId) {
  const response = await http.post(`/scenario-sessions/${sessionId}/report/retry`)
  return response.data
}

export async function getScenarioHistory({ status = 'all', cursor, limit = 20 } = {}) {
  const params = { status, limit }
  if (cursor) params.cursor = cursor
  const response = await http.get('/me/scenario-history', { params })
  return response.data
}

export async function getScenarioHistorySessions(
  scenarioId,
  { status = 'all', cursor, limit = 10 } = {},
) {
  const params = { status, limit }
  if (cursor) params.cursor = cursor
  const response = await http.get(`/me/scenario-history/${scenarioId}/sessions`, { params })
  return response.data
}

export async function completeScenarioReport(sessionId, onEvent = () => {}) {
  let response
  try {
    response = await fetch(`/api/v1/scenario-sessions/${sessionId}/report/stream`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'text/event-stream' },
    })
  } catch {
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: '暂时无法连接服务，请稍后重试。',
      details: null,
      requestId: null,
      status: 0,
    })
  }
  if (!response.ok) {
    let data = null
    try {
      data = await response.json()
    } catch {
      data = null
    }
    throw new ApiError({
      code: data?.code ?? 'SCENARIO_REPORT_FAILED',
      message: data?.message ?? '训练报告生成失败，请稍后重试。',
      details: data?.details ?? null,
      requestId: data?.request_id ?? null,
      status: response.status,
    })
  }
  const text = await response.text()
  const events = parseSseText(text)
  events.forEach(onEvent)
  const errorEvent = events.find((event) => event.event === 'error')
  if (errorEvent) {
    throw new ApiError({
      code: errorEvent.data?.code ?? 'SCENARIO_REPORT_FAILED',
      message: errorEvent.data?.message ?? '训练报告生成失败，请重试。',
      details: errorEvent.data?.details ?? null,
      requestId: null,
      status: 502,
    })
  }
  return events
}

export function parseSseText(text) {
  return text
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/)
      const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() ?? 'message'
      const rawData = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n')
      let data = rawData
      try {
        data = JSON.parse(rawData)
      } catch {
        // Plain text delta is valid for a streaming provider.
      }
      return { event, data }
    })
}
