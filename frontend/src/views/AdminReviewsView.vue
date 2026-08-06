<script setup>
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import { useAdminStore } from '../stores/admin'

const admin = useAdminStore()

onMounted(() => admin.loadResource('reviews', { status: 'pending' }))

async function approve(item) {
  await admin.decideReview(item.report_id, { status: 'approved', comment: '管理员已完成复核。' })
}
</script>

<template>
  <section class="admin-resource-view">
    <div class="admin-heading">
      <div><p class="eyebrow">管理端</p><h1>报告审核</h1></div>
      <RouterLink to="/admin">返回控制台</RouterLink>
    </div>
    <p v-if="admin.resourceStatus.reviews === 'loading'" class="catalog-state">正在加载待复核报告…</p>
    <p v-else-if="admin.error" class="catalog-state error-state" role="alert">{{ admin.error }}</p>
    <p v-else-if="admin.resources.reviews.items.length === 0" class="catalog-state empty-state">暂无待复核报告</p>
    <div v-else class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>学员</th><th>分数</th><th>触发原因</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="item in admin.resources.reviews.items" :key="item.report_id">
            <td>{{ item.learner_name }}</td><td>{{ item.score }}</td><td>{{ item.review_trigger || '—' }}</td>
            <td><button type="button" class="secondary-action" @click="approve(item)">通过复核</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
