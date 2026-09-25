<script setup lang="ts">
import type { ScanDisplay } from '../scan-result'

defineProps<{ result: ScanDisplay; dismissible?: boolean }>()
defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div role="status" class="relative mx-auto max-w-sm rounded-xl p-4 font-body shadow-lg" :class="result.tone === 'success' ? 'bg-success-container text-on-success-container' : result.tone === 'warning' ? 'bg-warning-container text-on-warning-container' : result.tone === 'error' ? 'bg-error-container text-on-error-container' : 'bg-surface text-on-surface'">
    <button v-if="dismissible" type="button" class="absolute right-2 top-2 rounded-full p-1 focus-visible:outline-2 focus-visible:outline-primary" aria-label="Dismiss notice" @click="$emit('dismiss')"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span></button>
    <p class="font-headline font-bold" :class="dismissible ? 'pr-6' : ''">{{ result.title }}</p>
    <p v-if="result.orderId" class="text-sm">{{ result.customerName }} · {{ result.orderId }}</p>
    <p v-if="result.status" class="text-sm">Status {{ result.status }}</p>
    <p class="mt-1 text-sm font-semibold">{{ result.message }}</p>
  </div>
</template>
