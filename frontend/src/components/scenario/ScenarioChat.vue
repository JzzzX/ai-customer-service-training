<script setup>
import { ref } from 'vue'

defineProps({
  messages: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['send'])
const draft = ref('')

function submit() {
  const content = draft.value.trim()
  if (!content) return
  emit('send', content)
  draft.value = ''
}
</script>

<template>
  <section class="scenario-chat" aria-label="实战对话">
    <div class="scenario-message-list" aria-live="polite">
      <article
        v-for="message in messages"
        :key="message.id || `${message.position}-${message.sender}`"
        class="scenario-message"
        :class="`scenario-message-${message.sender}`"
      >
        <small>{{ message.sender === 'customer' ? '顾客' : '我' }}</small>
        <p>{{ message.content }}</p>
      </article>
    </div>
    <form class="scenario-chat-form" @submit.prevent="submit">
      <label class="sr-only" for="scenario-message-input">回复顾客</label>
      <textarea
        id="scenario-message-input"
        v-model="draft"
        rows="3"
        :disabled="disabled"
        placeholder="输入你的客服回复…"
      />
      <button class="primary-action" type="submit" :disabled="disabled || !draft.trim()">
        {{ disabled ? '处理中…' : '发送回复' }}
      </button>
    </form>
  </section>
</template>
