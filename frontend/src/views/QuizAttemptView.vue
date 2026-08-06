<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { useQuizAttemptStore } from '../stores/quizAttempt'

const route = useRoute()
const quiz = useQuizAttemptStore()

const topicId = computed(() => String(route.params.topicId))

onMounted(() => {
  if (!quiz.attempt || quiz.attempt.topic_id !== topicId.value) {
    quiz.startAttempt(topicId.value)
  }
})

function setAnswer(question, event) {
  if (question.question_type === 'multiple_choice') {
    const selected = Array.from(
      event.currentTarget.form.querySelectorAll(
        `input[name="${question.id}"]:checked`,
      ),
    ).map((input) => input.value)
    quiz.selectAnswer(question.id, selected)
    return
  }
  quiz.selectAnswer(question.id, [event.target.value])
}

function isSelected(questionId, option) {
  return quiz.answers[questionId]?.includes(option)
}

async function submit() {
  await quiz.submitAttempt()
}
</script>

<template>
  <section class="quiz-attempt-view">
    <p class="eyebrow">专题练习</p>
    <div v-if="quiz.status === 'loading'" class="catalog-state">
      正在准备题目…
    </div>
    <div v-else-if="quiz.status === 'error'" class="catalog-state error-state">
      <p role="alert">{{ quiz.error }}</p>
      <button type="button" @click="quiz.startAttempt(topicId)">重新开始</button>
    </div>
    <template v-else-if="quiz.attempt">
      <div class="quiz-attempt-heading">
        <div>
          <h1>{{ quiz.attempt.topic_label }}</h1>
          <p>完成 {{ quiz.attempt.questions.length }} 道题，达到 {{ quiz.attempt.passing_score }} 分即可通过。</p>
        </div>
        <RouterLink to="/practice/quiz/topics">返回专题</RouterLink>
      </div>

      <div v-if="quiz.submitStatus === 'error'" class="catalog-state error-state">
        <p role="alert">{{ quiz.error }}</p>
      </div>

      <form v-if="!quiz.result" class="quiz-question-list" @submit.prevent="submit">
        <fieldset v-for="(question, index) in quiz.attempt.questions" :key="question.id">
          <legend>{{ index + 1 }}. {{ question.prompt }}</legend>
          <label v-for="option in question.options" :key="option" class="quiz-option">
            <input
              :name="question.id"
              :type="question.question_type === 'multiple_choice' ? 'checkbox' : 'radio'"
              :value="option"
              :checked="isSelected(question.id, option)"
              @change="setAnswer(question, $event)"
            />
            <span>{{ option }}</span>
          </label>
        </fieldset>
        <button class="primary-action" type="submit" :disabled="quiz.submitStatus === 'loading'">
          {{ quiz.submitStatus === 'loading' ? '正在判分…' : '提交答案' }}
        </button>
      </form>

      <section v-else class="quiz-result-card">
        <p class="eyebrow">本次结果</p>
        <h2>{{ quiz.result.score }} 分 · {{ quiz.result.status === 'passed' ? '练习通过' : '需要再练习' }}</h2>
        <p>答对 {{ quiz.result.correct_count }} / {{ quiz.result.total_questions }} 题</p>
        <ol class="quiz-feedback-list">
          <li v-for="feedback in quiz.result.answers" :key="feedback.question_id">
            <strong>{{ feedback.is_correct ? '回答正确' : '回答错误' }}</strong>
            <span>正确答案：{{ feedback.correct_answers.join('、') }}</span>
            <small>{{ feedback.explanation }}</small>
          </li>
        </ol>
        <RouterLink class="primary-action" to="/practice/quiz/topics">选择其他专题</RouterLink>
      </section>
    </template>
  </section>
</template>
