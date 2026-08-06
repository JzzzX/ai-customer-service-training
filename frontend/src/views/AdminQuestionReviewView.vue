<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { getAdminQuestion } from '../api/admin'
import { useAdminStore } from '../stores/admin'

const route = useRoute()
const admin = useAdminStore()
const question = ref(null)
const prompt = ref('')
const options = ref('')
const correctAnswers = ref('')
const explanation = ref('')
const category = ref('')
const difficulty = ref('easy')
const status = ref('loading')
const message = ref('')

async function load() {
  try {
    question.value = await getAdminQuestion(route.params.questionId)
    prompt.value = question.value.prompt
    options.value = question.value.options.join('\n')
    correctAnswers.value = question.value.correct_answers.join('\n')
    explanation.value = question.value.explanation
    category.value = question.value.category
    difficulty.value = question.value.difficulty
    status.value = 'ready'
  } catch (error) {
    status.value = 'error'
    message.value = error.message
  }
}

async function review(nextStatus) {
  status.value = 'loading'
  try {
    await admin.reviewQuestion(route.params.questionId, {
      status: nextStatus,
      prompt: prompt.value,
      options: options.value.split('\n').map((item) => item.trim()).filter(Boolean),
      correct_answers: correctAnswers.value.split('\n').map((item) => item.trim()).filter(Boolean),
      explanation: explanation.value,
      category: category.value,
      difficulty: difficulty.value,
    })
    status.value = 'ready'
    message.value = nextStatus === 'approved' ? '题目已通过审核。' : '题目已退回草稿。'
  } catch (error) {
    status.value = 'error'
    message.value = error.message
  }
}

async function publish() {
  if (!question.value?.quiz_set_id) return
  status.value = 'loading'
  try {
    await admin.publishQuizSet(question.value.quiz_set_id)
    status.value = 'ready'
    message.value = '题组已发布。'
  } catch (error) {
    status.value = 'error'
    message.value = error.message
  }
}

onMounted(load)
</script>

<template>
  <section class="admin-resource-view">
    <div class="admin-heading"><div><p class="eyebrow">管理端</p><h1>题目审核</h1></div><RouterLink to="/admin/questions">返回题目列表</RouterLink></div>
    <p v-if="status === 'loading' && !question" class="catalog-state">正在加载题目…</p>
    <p v-else-if="status === 'error' && !question" class="catalog-state error-state" role="alert">{{ message }}</p>
    <form v-else class="admin-form" @submit.prevent="review('approved')">
      <label>题干<textarea v-model="prompt" required /></label>
      <label>选项（每行一项）<textarea v-model="options" required /></label>
      <label>正确答案（每行一项）<textarea v-model="correctAnswers" required /></label>
      <label>解析<textarea v-model="explanation" /></label>
      <label>分类<input v-model="category" /></label>
      <label>难度<select v-model="difficulty"><option value="easy">简单</option><option value="medium">中等</option><option value="hard">困难</option></select></label>
      <div class="admin-actions"><button class="primary-action" type="submit">通过审核</button><button class="secondary-action" type="button" @click="review('rejected')">退回草稿</button><button v-if="question?.quiz_set_id" class="secondary-action" type="button" @click="publish">发布题组</button></div>
    </form>
    <p v-if="message" class="catalog-state" role="status">{{ message }}</p>
  </section>
</template>
