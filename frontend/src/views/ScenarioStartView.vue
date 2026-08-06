<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useScenarioTrainingStore } from '../stores/scenarioTraining'

const route = useRoute()
const router = useRouter()
const training = useScenarioTrainingStore()

onMounted(async () => {
  try {
    const session = await training.start(String(route.params.scenarioId))
    await router.replace(`/practice/scenario/session/${session.id}`)
  } catch {
    // The template below exposes the store's stable error message.
  }
})
</script>

<template>
  <section class="scenario-start-view catalog-state">
    <p v-if="training.status === 'error'" role="alert" class="error-state">{{ training.error }}</p>
    <p v-else>正在创建可恢复的实战会话…</p>
  </section>
</template>
