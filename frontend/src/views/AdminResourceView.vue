<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import { useAdminStore } from '../stores/admin'

const props = defineProps({
  resource: { type: String, required: true },
  title: { type: String, required: true },
  items: { type: Array, default: null },
  loading: { type: Boolean, default: null },
  error: { type: String, default: null },
})

const admin = useAdminStore()
const columns = {
  knowledge: [
    ['label', '知识版本'],
    ['status', '状态'],
    ['is_active', '当前版本'],
    ['updated_at', '更新时间'],
  ],
  questions: [
    ['prompt', '题干'],
    ['quiz_label', '题组'],
    ['difficulty', '难度'],
    ['status', '状态'],
  ],
  scenarios: [
    ['title', '场景'],
    ['category', '分类'],
    ['version', '版本'],
    ['status', '状态'],
  ],
  assignments: [
    ['target_label', '任务'],
    ['learner_name', '学员'],
    ['assignment_type', '类型'],
    ['status', '状态'],
  ],
  history: [
    ['action', '操作'],
    ['resource_type', '资源'],
    ['resource_id', '资源 ID'],
    ['actor_name', '操作人'],
    ['created_at', '时间'],
  ],
}

const resource = computed(() => admin.resources[props.resource] ?? { items: [] })
const rows = computed(() => props.items ?? resource.value.items)
const isLoading = computed(() => props.loading ?? admin.resourceStatus[props.resource] === 'loading')
const errorMessage = computed(() => props.error ?? admin.error)
const tableColumns = computed(() => columns[props.resource] ?? [])

onMounted(() => {
  if (props.items === null && admin.resourceStatus[props.resource] === 'idle') {
    admin.loadResource(props.resource)
  }
})

function formatValue(value) {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (!value) return '—'
  return String(value)
}
</script>

<template>
  <section class="admin-resource-view">
    <div class="admin-heading">
      <div>
        <p class="eyebrow">管理端</p>
        <h1>{{ title }}</h1>
      </div>
      <RouterLink to="/admin">返回控制台</RouterLink>
    </div>
    <p v-if="isLoading" class="catalog-state">正在加载{{ title }}…</p>
    <p v-else-if="errorMessage" class="catalog-state error-state" role="alert">
      {{ errorMessage }}
    </p>
    <p v-else-if="rows.length === 0" class="catalog-state empty-state">暂无{{ title }}记录</p>
    <div v-else class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr><th v-for="column in tableColumns" :key="column[0]">{{ column[1] }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="item in rows" :key="item.id || item.report_id || item.resource_id">
            <td v-for="column in tableColumns" :key="column[0]">{{ formatValue(item[column[0]]) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
