<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import LaundryItemDetailView from '../components/LaundryItemDetailView.vue'

defineOptions({ name: 'LaundryItemDetailPage' })

const route = useRoute()
const tagId = computed(() => typeof route.params.tagId === 'string' ? route.params.tagId : '')
const orderId = computed(() => typeof route.query.order === 'string' && route.query.order.trim() !== '' ? route.query.order.trim() : null)
</script>

<template>
  <AppLayout><ScrollRegion><LaundryItemDetailView :tag-id="tagId" :order-id="orderId" /></ScrollRegion></AppLayout>
</template>
