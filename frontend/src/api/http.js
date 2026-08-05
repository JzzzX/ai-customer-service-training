import axios from 'axios'

export class ApiError extends Error {
  constructor({ code, message, details, requestId, status }) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
    this.requestId = requestId
    this.status = status
  }
}

export function normalizeApiError(error) {
  const data = error.response?.data
  return new ApiError({
    code: data?.code ?? 'NETWORK_ERROR',
    message: data?.message ?? '暂时无法连接服务，请稍后重试。',
    details: data?.details ?? null,
    requestId: data?.request_id ?? null,
    status: error.response?.status ?? 0,
  })
}

export const http = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  withCredentials: true,
})

http.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeApiError(error)),
)
