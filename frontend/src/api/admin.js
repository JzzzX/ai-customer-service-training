import { http } from './http'

export async function getAdminOverview() {
  const response = await http.get('/admin/overview')
  return response.data
}

export async function listAdminResource(resource, params = {}) {
  const response = await http.get(`/admin/${resource}`, { params })
  return response.data
}

export async function listAdminHistory(params = {}) {
  return listAdminResource('history', params)
}

export async function decideAdminReview(reportId, payload) {
  const response = await http.post(`/admin/reviews/${reportId}/decision`, payload)
  return response.data
}
