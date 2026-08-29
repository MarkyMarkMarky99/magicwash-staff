<script setup lang="ts">
defineProps<{ page: number; totalPages: number; total?: number }>()
const emit = defineEmits<{ change: [page: number] }>()
</script>

<template>
  <nav v-if="totalPages > 1" class="flex items-center justify-between border-t border-outline-variant/20 bg-surface-container-low px-4 py-3" aria-label="Order pagination">
    <button type="button" class="rounded-lg px-3 py-2 font-label text-xs font-bold text-primary disabled:opacity-35" :disabled="page <= 1" @click="emit('change', page - 1)">ก่อนหน้า</button>
    <p class="font-label text-[10px] font-bold tracking-wide text-on-surface-variant">หน้า {{ page }} / {{ totalPages }}<span v-if="total !== undefined"> · {{ total }} รายการ</span></p>
    <button type="button" class="rounded-lg px-3 py-2 font-label text-xs font-bold text-primary disabled:opacity-35" :disabled="page >= totalPages" @click="emit('change', page + 1)">ถัดไป</button>
  </nav>
</template>
