<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import { useAdminStore } from '../stores/admin'

const admin = useAdminStore()
const category = ref('presale')
const count = ref(3)
const scenarios = ref([])
const status = ref('idle')
const message = ref('')

async function generate() {
  status.value = 'loading'
  message.value = ''
  try {
    const result = await admin.generateScenarioDrafts({ category: category.value, count: Number(count.value) })
    scenarios.value = result.scenarios
    status.value = 'ready'
  } catch (error) {
    status.value = 'error'
    message.value = error.message
  }
}
</script>

<template>
  <section class="admin-resource-view">
    <div class="admin-heading"><div><p class="eyebrow">场景管理</p><h1>AI 生成训练场景</h1></div><RouterLink to="/admin/scenarios">返回场景列表</RouterLink></div>
    <form class="admin-form" @submit.prevent="generate">
      <label>场景类别<select v-model="category"><option value="presale">售前咨询</option><option value="logistics">物流问题</option><option value="damage_shortage">破损少货</option><option value="complaint">客诉处理</option></select></label>
      <label>生成数量<select v-model="count"><option v-for="value in [1, 2, 3, 4, 5]" :key="value" :value="value">{{ value }} 个</option></select></label>
      <button class="primary-action" :disabled="status === 'loading'" type="submit">开始生成</button>
    </form>
    <p v-if="message" class="catalog-state error-state" role="alert">{{ message }}</p>
    <div v-for="scenario in scenarios" :key="scenario.id" class="admin-draft-card">
      <strong>{{ scenario.title }}</strong><span>{{ scenario.summary }}</span><small>{{ scenario.reference_reply }}</small>
    </div>
  </section>
</template>
