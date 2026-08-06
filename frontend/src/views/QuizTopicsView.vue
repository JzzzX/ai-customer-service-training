<script setup>
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import { useCatalogStore } from '../stores/catalog'

const catalog = useCatalogStore()

onMounted(() => {
  if (catalog.status === 'idle') catalog.loadTopics()
})

function retry() {
  catalog.status = 'idle'
  catalog.loadTopics()
}
</script>

<template>
  <section class="quiz-topics-view">
    <p class="eyebrow">知识训练</p>
    <div class="quiz-topics-heading">
      <div>
        <h1>专题练习</h1>
        <p>选择已发布专题开始练习，答案由服务端判分并记录训练进度。</p>
      </div>
      <small v-if="catalog.knowledgeVersion">
        知识版本 {{ catalog.knowledgeVersion }}
      </small>
    </div>

    <p v-if="catalog.status === 'idle' || catalog.status === 'loading'" class="catalog-state">
      正在加载练习专题…
    </p>
    <div v-else-if="catalog.status === 'error'" class="catalog-state error-state">
      <p role="alert">{{ catalog.error }}</p>
      <button type="button" @click="retry">重新加载</button>
    </div>
    <p v-else-if="catalog.topics.length === 0" class="catalog-state empty-state">
      暂时没有已发布的练习专题
    </p>
    <div v-else class="topic-grid">
      <article v-for="topic in catalog.topics" :key="topic.id" class="topic-card">
        <div>
          <small>{{ topic.question_count }} 题</small>
          <h2>{{ topic.label }}</h2>
          <p>{{ topic.description }}</p>
        </div>
        <RouterLink :to="`/practice/quiz/topics/${topic.id}`">进入专题</RouterLink>
      </article>
    </div>
  </section>
</template>
