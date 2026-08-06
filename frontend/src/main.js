import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { createAppRouter } from './router'
import { useAuthStore } from './stores/auth'
import './styles/base.css'

const app = createApp(App)
const pinia = createPinia()
const router = createAppRouter({ auth: useAuthStore(pinia) })

app.use(pinia).use(router).mount('#app')
