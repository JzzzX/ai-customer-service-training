<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import ScenarioChat from '../components/scenario/ScenarioChat.vue'
import { useScenarioTrainingStore } from '../stores/scenarioTraining'

const route = useRoute()
const router = useRouter()
const training = useScenarioTrainingStore()
const sessionId = computed(() => String(route.params.sessionId))

onMounted(async () => {
  try {
    await training.load(sessionId.value)
  } catch {
    // Keep the API error visible below.
  }
})

async function send(content) {
  try {
    await training.send(content)
  } catch {
    // Keep the API error visible below.
  }
}

async function complete() {
  try {
    await training.complete()
    await router.push(`/practice/scenario/report/${sessionId.value}`)
  } catch {
    // Keep the retry action visible below.
  }
}
</script>

<template>
  <section class="scenario-session-view">
    <div v-if="training.status === 'loading'" class="catalog-state">正在恢复实战会话…</div>
    <div v-else-if="training.status === 'error'" class="catalog-state error-state">
      <p role="alert">{{ training.error }}</p>
      <RouterLink to="/practice/scenario">返回场景目录</RouterLink>
    </div>
    <template v-else-if="training.session">
      <div class="scenario-session-heading">
        <div>
          <p class="eyebrow">{{ training.session.category }} · {{ training.session.mode === 'mock' ? '确定性 Mock' : 'Ark' }}</p>
          <h1>{{ training.session.title }}</h1>
          <p>第 {{ training.session.turn_count }} / {{ training.session.max_turns }} 轮</p>
        </div>
        <RouterLink to="/practice/scenario/history">历史记录</RouterLink>
      </div>
      <p v-if="training.sendStatus === 'error' || training.reportStatus === 'error'" class="catalog-state error-state" role="alert">
        {{ training.error }}
      </p>
      <ScenarioChat :messages="training.session.messages" :disabled="training.sendStatus === 'loading'" @send="send" />
      <aside v-if="training.session.messages.at(-1)?.metadata?.risk_alert?.risk_label" class="scenario-risk-card" role="alert">
        <strong>风险提示：{{ training.session.messages.at(-1).metadata.risk_alert.risk_label }}</strong>
        <span>{{ training.session.messages.at(-1).metadata.risk_alert.suggestion }}</span>
      </aside>
      <button
        class="primary-action scenario-complete-action"
        type="button"
        :disabled="training.sendStatus === 'loading' || training.session.turn_count === 0"
        @click="complete"
      >
        完成本次训练并生成报告
      </button>
    </template>
  </section>
</template>
