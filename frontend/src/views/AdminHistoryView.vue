<script setup>
import { onMounted } from 'vue'

import AdminResourceView from './AdminResourceView.vue'
import { useAdminStore } from '../stores/admin'

const admin = useAdminStore()
onMounted(() => admin.loadResource('history'))
</script>

<template>
  <AdminResourceView
    resource="history"
    title="管理历史"
    :loading="admin.resourceStatus.history === 'loading'"
    :error="admin.error"
  />
</template>
