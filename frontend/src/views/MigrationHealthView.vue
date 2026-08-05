<script setup>
import { onMounted } from 'vue'

import { useSystemStore } from '../stores/system'

const system = useSystemStore()
onMounted(() => system.loadHealth())
</script>

<template>
  <section class="status-card">
    <p class="eyebrow">迁移基础</p>
    <h1>系统状态</h1>
    <p v-if="system.status === 'idle' || system.status === 'loading'">
      正在检查新系统基础服务
    </p>
    <template v-else-if="system.status === 'ready'">
      <p>FastAPI 连接正常</p>
      <p>{{ system.health.service }} · {{ system.health.version }}</p>
    </template>
    <template v-else>
      <p role="alert">{{ system.error }}</p>
      <button type="button" @click="system.loadHealth">重新检查</button>
    </template>
  </section>
</template>
