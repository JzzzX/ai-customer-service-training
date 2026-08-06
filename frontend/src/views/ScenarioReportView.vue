<script setup>
import { onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import ScenarioReportProgress from '../components/scenario/ScenarioReportProgress.vue'
import { useScenarioTrainingStore } from '../stores/scenarioTraining'

const route = useRoute()
const training = useScenarioTrainingStore()
const sessionId = String(route.params.sessionId)

onMounted(async () => {
  try {
    await training.load(sessionId)
    if (!training.report) await training.complete()
  } catch {
    // Keep the retry action visible below.
  }
})

async function retry() {
  try {
    await training.retry()
  } catch {
    // Keep the API error visible below.
  }
}
</script>

<template>
  <section class="scenario-report-view">
    <div class="scenario-session-heading">
      <div>
        <p class="eyebrow">训练报告</p>
        <h1>{{ training.session?.title || '实战报告' }}</h1>
      </div>
      <RouterLink to="/practice/scenario/history">返回历史</RouterLink>
    </div>
    <ScenarioReportProgress :events="training.reportEvents" :loading="training.reportStatus === 'loading'" />
    <p v-if="training.reportStatus === 'error'" class="catalog-state error-state" role="alert">
      {{ training.error }}
      <button type="button" @click="retry">重试报告</button>
    </p>
    <section v-if="training.report" class="scenario-report-card">
      <div class="scenario-score">
        <small>总分</small>
        <strong>{{ training.report.total_score }} 分</strong>
        <span>{{ training.report.verdict === 'passed' ? '训练通过' : '需要再练习' }}</span>
      </div>
      <div class="scenario-dimension-grid">
        <article v-for="dimension in training.report.dimensions" :key="dimension.name">
          <strong>{{ dimension.name }}</strong>
          <span>{{ dimension.score }} / {{ dimension.max_score || 100 }}</span>
        </article>
      </div>
      <div class="scenario-report-columns">
        <div><h2>做得好的地方</h2><ul><li v-for="item in training.report.strengths" :key="item">{{ item }}</li></ul></div>
        <div><h2>下一步建议</h2><ul><li v-for="item in training.report.omissions" :key="item">{{ item }}</li></ul></div>
      </div>
      <p v-if="training.report.low_confidence" class="scenario-low-confidence">本次对话轮次较少，报告置信度偏低，建议继续练习。</p>
    </section>
  </section>
</template>
