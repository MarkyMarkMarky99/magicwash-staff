<script setup lang="ts">
import GenericTabs from '@/shared/components/GenericTabs.vue'

defineProps<{
  activeStatus: string
}>()

const emit = defineEmits<{
  select: [key: string]
}>()

const STATUS_TABS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'active', label: 'เปิดใช้งาน' },
  { key: 'inactive', label: 'ปิดใช้งาน' },
]
</script>

<template>
  <GenericTabs :tabs="STATUS_TABS" :active-key="activeStatus" @select="emit('select', $event)" />
</template>
