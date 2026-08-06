<script setup>
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import { useAdminStore } from '../stores/admin'

const admin = useAdminStore()
const links = [
  ['knowledge', '知识版本'],
  ['questions', '题目'],
  ['scenarios', '场景'],
  ['scenarios/generate', 'AI 场景草稿'],
  ['assignments', '任务'],
  ['reviews', '审核'],
  ['history', '管理历史'],
]

onMounted(() => admin.loadOverview())
</script>

<template>
  <section class="admin-dashboard-view">
    <p class="eyebrow">企业训练运营</p>
    <h1>管理员控制台</h1>
    <p class="admin-lead">集中查看内容健康、训练任务、报告复核和管理操作历史。</p>
    <p v-if="admin.error" class="catalog-state error-state" role="alert">{{ admin.error }}</p>
    <div v-if="admin.overview" class="admin-count-grid">
      <article v-for="(count, key) in admin.overview.counts" :key="key" class="admin-count-card">
        <small>{{ key }}</small><strong>{{ count }}</strong>
      </article>
    </div>
    <nav class="admin-resource-grid" aria-label="管理资源">
      <RouterLink v-for="[resource, label] in links" :key="resource" :to="`/admin/${resource}`" class="admin-resource-card">
        <strong>{{ label }}</strong><span>查看与管理 →</span>
      </RouterLink>
    </nav>
  </section>
</template>
