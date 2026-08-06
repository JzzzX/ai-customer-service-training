<script setup>
defineProps({
  events: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
</script>

<template>
  <section class="scenario-report-progress" aria-live="polite">
    <p v-if="loading">正在生成训练报告…</p>
    <ol>
      <li v-for="event in events" :key="`${event.event}-${event.data?.message || ''}`">
        {{ event.data?.message || event.event }}
      </li>
    </ol>
  </section>
</template>
