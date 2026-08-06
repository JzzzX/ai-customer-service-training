<script setup>
import { RouterLink } from 'vue-router'

const props = defineProps({
  groups: { type: Array, default: () => [] },
  sessionsByScenario: { type: Object, default: () => ({}) },
  expanded: { type: Array, default: () => [] },
})

const emit = defineEmits(['toggle', 'load-more'])

function isExpanded(id) {
  return props.expanded.includes(id)
}

function sessionsFor(group) {
  return props.sessionsByScenario[group.scenario_id]?.items || []
}

function pageFor(group) {
  return props.sessionsByScenario[group.scenario_id]
}

function labelFor(status) {
  return status === 'active' ? '进行中' : '已完成'
}

function formatDate(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
</script>

<template>
  <section class="scenario-history-timeline" aria-label="实战历史时间线">
    <details
      v-for="group in groups"
      :key="group.scenario_id"
      :open="isExpanded(group.scenario_id)"
      @toggle="emit('toggle', group.scenario_id)"
    >
      <summary>
        <span>
          <strong>{{ group.title }}</strong>
          <small>{{ group.category }} · {{ group.total_session_count }} 次训练</small>
        </span>
        <span class="scenario-history-latest">
          {{ labelFor(group.latest_session.status) }} · {{ formatDate(group.latest_activity_at) }}
        </span>
      </summary>
      <div class="scenario-history-group">
        <RouterLink
          v-if="group.latest_session.status === 'active'"
          class="primary-action compact-action"
          :to="`/practice/scenario/session/${group.latest_session.id}`"
        >
          继续最新
        </RouterLink>
        <RouterLink
          v-else
          class="primary-action compact-action"
          :to="`/practice/scenario/report/${group.latest_session.id}`"
        >
          查看报告
        </RouterLink>
        <p v-if="pageFor(group)?.status === 'loading'">正在加载历史会话…</p>
        <ul v-else>
          <li v-for="item in sessionsFor(group)" :key="item.id">
            <span>{{ formatDate(item.updated_at) }} · {{ labelFor(item.status) }}</span>
            <strong v-if="item.score !== null && item.score !== undefined">{{ item.score }} 分</strong>
            <RouterLink
              v-if="item.status === 'active'"
              :to="`/practice/scenario/session/${item.id}`"
            >
              继续
            </RouterLink>
            <RouterLink v-else :to="`/practice/scenario/report/${item.id}`">报告</RouterLink>
          </li>
        </ul>
        <button
          v-if="pageFor(group)?.next_cursor"
          type="button"
          :aria-label="`加载更多${group.title}会话`"
          @click="emit('load-more', group.scenario_id)"
        >
          加载更多
        </button>
      </div>
    </details>
  </section>
</template>
