<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status: string }>()

const status = computed(() => {
  const labels: Record<string, string> = {
    OPEN: 'เปิด',
    IN_PROGRESS: 'กำลังแก้ไข',
    RESOLVED: 'แก้ไขแล้ว',
    CLOSED: 'ปิด',
  }
  const classes: Record<string, string> = {
    OPEN: 'bg-blue-100 text-blue-700',
    IN_PROGRESS: 'bg-amber-100 text-amber-800',
    RESOLVED: 'bg-green-100 text-green-700',
    CLOSED: 'bg-surface-container text-on-surface-variant',
  }

  return {
    label: labels[props.status] ?? (props.status || 'ไม่ทราบสถานะ'),
    classes: classes[props.status] ?? 'bg-surface-container text-on-surface-variant',
  }
})
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2.5 py-1 font-label text-[10px] font-bold" :class="status.classes">
    {{ status.label }}
  </span>
</template>
