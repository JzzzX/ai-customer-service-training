<script setup>
import { onMounted } from 'vue'

import ScenarioHistoryTimeline from '../components/scenario/ScenarioHistoryTimeline.vue'
import { useScenarioHistoryStore } from '../stores/scenarioHistory'

const history = useScenarioHistoryStore()
const filters = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
]

onMounted(() => history.load())

async function filter(value) {
  await history.load(value)
}
</script>

<template>
  <section class="scenario-history-view">
    <p class="eyebrow">训练记录</p>
    <div class="scenario-heading">
      <div>
        <h1>实战历史</h1>
        <p>按日期查看训练结果；同一场景的旧会话默认折叠，组内可继续分页加载。</p>
      </div>
    </div>
    <nav class="scenario-history-filters" aria-label="历史状态筛选">
      <button
        v-for="item in filters"
        :key="item.value"
        type="button"
        :aria-pressed="history.statusFilter === item.value"
        @click="filter(item.value)"
      >
        {{ item.label }}
      </button>
    </nav>
    <p v-if="history.status === 'loading'" class="catalog-state">正在加载实战历史…</p>
    <div v-else-if="history.status === 'error'" class="catalog-state error-state" role="alert">{{ history.error }}</div>
    <p v-else-if="history.groups.length === 0" class="catalog-state empty-state">暂无符合条件的实战记录</p>
    <ScenarioHistoryTimeline
      v-else
      :groups="history.groups"
      :sessions-by-scenario="history.sessionsByScenario"
      :expanded="history.expanded"
      @toggle="history.toggle"
      @load-more="history.loadMore"
    />
  </section>
</template>
