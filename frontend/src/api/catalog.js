import { http } from './http'

export async function getQuizTopics() {
  const response = await http.get('/quiz/topics')
  return response.data
}

export async function startQuizAttempt(topicId) {
  const response = await http.post(`/quiz/topics/${topicId}/attempts`)
  return response.data
}

export async function submitQuizAttempt(attemptId, payload) {
  const response = await http.post(`/quiz/attempts/${attemptId}/submit`, payload)
  return response.data
}

export async function getQuizProgress() {
  const response = await http.get('/me/quiz-progress')
  return response.data
}
