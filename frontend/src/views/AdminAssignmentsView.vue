<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import { useAdminStore } from '../stores/admin'

const admin = useAdminStore()
const learnerId = ref('')
const assignmentType = ref('quiz')
const targetId = ref('')
const dueAt = ref('')
const status = ref('idle')
const message = ref('')

async function submit() {
  status.value = 'loading'
  message.value = ''
  try {
    const result = await admin.createAssignment({
      learner_id: learnerId.value.trim(),
      assignment_type: assignmentType.value,
      target_id: targetId.value.trim(),
      due_at: dueAt.value ? new Date(dueAt.value).toISOString() : null,
    })
    status.value = 'ready'
    message.value = `已创建任务：${result.assignment.target_label}`
    learnerId.value = ''
    targetId.value = ''
  } catch (error) {
    status.value = 'error'
    message.value = error.message
  }
}
</script>

<template>
  <section class="admin-resource-view">
    <div class="admin-heading">
      <div><p class="eyebrow">管理端</p><h1>创建训练任务</h1></div>
      <RouterLink to="/admin">返回控制台</RouterLink>
    </div>
    <form class="admin-form" @submit.prevent="submit">
      <label>学员 ID<input v-model="learnerId" required maxlength="64" /></label>
      <label>任务类型<select v-model="assignmentType"><option value="quiz">知识小测</option><option value="scenario">情景实战</option></select></label>
      <label>目标 ID<input v-model="targetId" required maxlength="64" /></label>
      <label>截止时间（可选）<input v-model="dueAt" type="datetime-local" /></label>
      <button class="primary-action" :disabled="status === 'loading'" type="submit">创建任务</button>
    </form>
    <p v-if="message" :class="['catalog-state', status === 'error' ? 'error-state' : '']" role="status">{{ message }}</p>
  </section>
</template>
