<template>
  <div class="app-shell">
    <header class="app-header">
      <strong>AI 客服训练</strong>
      <span>公司技术栈迁移</span>
    </header>
    <nav class="app-nav" aria-label="主导航">
      <RouterLink to="/profile">个人中心</RouterLink>
      <RouterLink to="/practice/scenario">AI 实战</RouterLink>
      <RouterLink to="/admin">管理端</RouterLink>
    </nav>
    <main class="app-main"><slot /></main>
    <footer class="app-footer">新系统基础环境</footer>
  </div>
</template>
