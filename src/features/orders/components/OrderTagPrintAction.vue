<script setup lang="ts">
defineProps<{
  totalCount: number | null
  canPrint: boolean
  printing: boolean
  printSuccess: string | null
  printError: string | null
}>()

defineEmits<{ print: [] }>()
</script>

<template>
  <section class="mt-3 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-3">
    <button
      type="button"
      class="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-label text-[13px] font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="!canPrint || printing"
      :aria-busy="printing"
      @click="$emit('print')"
    >
      <span class="material-symbols-outlined text-[19px]" aria-hidden="true">{{ printing ? 'progress_activity' : 'print' }}</span>
      <span>{{ printing ? 'กำลังส่งแท็ก…' : 'พิมพ์แท็ก ' + (totalCount ?? 0) + ' ใบ' }}</span>
    </button>
    <p v-if="!canPrint" class="mt-2 text-xs text-on-surface-variant">
      ต้องมีรหัสลูกค้าและจำนวนชิ้นในออเดอร์ก่อนพิมพ์แท็ก
    </p>
    <p v-if="printSuccess" class="mt-2 rounded-xl bg-success-container px-3 py-2 text-xs text-on-success-container" role="status">{{ printSuccess }}</p>
    <p v-else-if="printError" class="mt-2 rounded-xl bg-error-container px-3 py-2 text-xs text-on-error-container" role="alert">{{ printError }}</p>
  </section>
</template>
