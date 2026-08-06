<script setup>
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import { useAuthStore } from '../stores/auth'
import { useOverviewStore } from '../stores/overview'

const auth = useAuthStore()
const overview = useOverviewStore()

onMounted(() => overview.loadOverview())
</script>

<template>
  <section class="profile-view">
    <p class="eyebrow">训练中心</p>
    <h1>个人中心</h1>
    <div class="identity-card">
      <div>
        <small>当前账号</small>
        <strong>{{ auth.user?.name }}</strong>
      </div>
      <div>
        <span>{{ auth.user?.email }}</span>
        <small>{{ auth.user?.role === 'admin' ? '管理员' : '学员' }}</small>
      </div>
    </div>
    <div class="migration-card">
      <strong>身份与个人中心迁移</strong>
      <span>飞书身份、Cookie 会话与服务端角色权限已接入新系统。</span>
    </div>
    <RouterLink class="profile-scenario-link" to="/practice/scenario">进入 AI 实战训练 →</RouterLink>
    <p v-if="overview.status === 'loading'" class="overview-state">正在加载训练进度…</p>
    <p v-else-if="overview.status === 'error'" class="overview-state error-state">
      {{ overview.error }}
    </p>
    <template v-else-if="overview.data">
      <section class="overview-grid">
        <article class="overview-card">
          <small>知识覆盖</small>
          <strong>
            {{ overview.data.knowledge.unique_answered_count }} /
            {{ overview.data.knowledge.total_questions }} 题
          </strong>
          <span>
            正确率 {{ overview.data.knowledge.accuracy }}% ·
            {{ overview.data.knowledge.attempt_count }} 次测验
          </span>
        </article>
        <article class="overview-card">
          <small>实战覆盖</small>
          <strong>
            {{ overview.data.scenario.completed_scenario_count }} /
            {{ overview.data.scenario.published_scenario_count }} 个场景
          </strong>
          <span>
            最近平均 {{ overview.data.scenario.recent_average_score }} 分 ·
            {{ overview.data.scenario.completed_session_count }} 次实战
          </span>
        </article>
      </section>
      <section class="assignment-card">
        <div class="section-heading">
          <strong>我的任务</strong>
          <span>{{ overview.data.assignments.length }} 项</span>
        </div>
        <p v-if="overview.data.assignments.length === 0" class="empty-state">
          暂无管理员下发的训练任务
        </p>
        <ul v-else>
          <li v-for="assignment in overview.data.assignments" :key="assignment.id">
            <strong>{{ assignment.target_label }}</strong>
            <span>{{ assignment.status === 'completed' ? '已完成' : '待训练' }}</span>
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>
