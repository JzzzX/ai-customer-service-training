import { http } from './http'

export async function getOverview() {
  const response = await http.get('/me/overview')
  return response.data
}
