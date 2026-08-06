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

export async function getAdminQuestion(questionId) {
  const response = await http.get(`/admin/questions/${questionId}`)
  return response.data
}

export async function createAdminAssignment(payload) {
  const response = await http.post('/admin/assignments', payload)
  return response.data
}

export async function reviewAdminQuestion(questionId, payload) {
  const response = await http.patch(`/admin/questions/${questionId}/review`, payload)
  return response.data
}

export async function publishAdminQuizSet(quizSetId) {
  const response = await http.post(`/admin/quiz-sets/${quizSetId}/publish`)
  return response.data
}

export async function generateAdminScenarioDrafts(payload) {
  const response = await http.post('/admin/scenario-drafts/generate', payload)
  return response.data
}
