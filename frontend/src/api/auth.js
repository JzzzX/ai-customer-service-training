import { http } from './http'

export async function getCurrentUser() {
  const response = await http.get('/auth/me')
  return response.data
}

export async function logout() {
  await http.post('/auth/logout')
}
