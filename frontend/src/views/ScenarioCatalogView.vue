<script setup>
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import { useScenarioCatalogStore } from '../stores/scenarioCatalog'

const catalog = useScenarioCatalogStore()

onMounted(() => catalog.load())
</script>

<template>
  <section class="scenario-catalog-view">
    <p class="eyebrow">AI 实战训练</p>
    <div class="scenario-heading">
      <div>
        <h1>选择实战场景</h1>
        <p>通过多轮对话练习客服判断，实时风险提示和报告会保留到个人历史。</p>
      </div>
      <RouterLink to="/practice/scenario/history">查看训练历史</RouterLink>
    </div>
    <p v-if="catalog.status === 'idle' || catalog.status === 'loading'" class="catalog-state">正在加载实战场景…</p>
    <div v-else-if="catalog.status === 'error'" class="catalog-state error-state">
      <p role="alert">{{ catalog.error }}</p>
      <button type="button" @click="catalog.status = 'idle'; catalog.load()">重新加载</button>
    </div>
    <p v-else-if="catalog.items.length === 0" class="catalog-state empty-state">暂无已发布实战场景</p>
    <div v-else class="scenario-card-grid">
      <article v-for="item in catalog.items" :key="item.id" class="scenario-card">
        <div>
          <small>{{ item.category }} · {{ item.difficulty }}</small>
          <h2>{{ item.title }}</h2>
          <p>{{ item.summary }}</p>
        </div>
        <RouterLink class="primary-action" :to="`/practice/scenario/${item.id}`">开始训练</RouterLink>
      </article>
    </div>
  </section>
</template>
