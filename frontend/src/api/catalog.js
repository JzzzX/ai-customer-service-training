import { http } from './http'

export async function getQuizTopics() {
  const response = await http.get('/quiz/topics')
  return response.data
}
