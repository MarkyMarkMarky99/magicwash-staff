<script setup lang="ts">
import AppLayout from '@/shared/layouts/AppLayout.vue'
import OrderBagsView from '../components/OrderBagsView.vue'

// Both bag departments share this page. KeepAlive reuses one instance across their routes, so the
// view is keyed by department to rebuild its workflow when the department changes.
defineProps<{ department: string; orderId: string }>()
</script>

<template>
  <AppLayout>
    <OrderBagsView :key="department" :department="department" :order-id="orderId" />
  </AppLayout>
</template>
