<script setup>
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
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
  </section>
</template>
