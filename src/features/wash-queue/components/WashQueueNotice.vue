<script setup lang="ts">
export type WashQueueNoticeTone = 'success' | 'error' | 'warning'

defineProps<{ tone: WashQueueNoticeTone; message: string; dismissible?: boolean }>()
defineEmits<{ dismiss: [] }>()
const icons = { success: 'check_circle', error: 'error', warning: 'warning' } as const
const toneClass = {
  success: 'bg-success-container text-on-success-container',
  error: 'bg-error-container text-on-error-container',
  warning: 'bg-warning-container text-on-warning-container',
} as const
</script>

<template>
  <div :role="tone === 'error' ? 'alert' : 'status'" class="flex items-start gap-2 rounded-[14px] px-3 py-2.5" :class="toneClass[tone]">
    <span class="material-symbols-outlined mt-px shrink-0" style="font-size: 18px" aria-hidden="true">{{ icons[tone] }}</span>
    <p class="min-w-0 flex-1 font-body text-[13px] font-semibold leading-snug">{{ message }}</p>
    <button v-if="dismissible" type="button" class="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-lime" aria-label="Dismiss notice" @click="$emit('dismiss')">
      <span class="material-symbols-outlined" style="font-size: 18px" aria-hidden="true">close</span>
    </button>
  </div>
</template>
