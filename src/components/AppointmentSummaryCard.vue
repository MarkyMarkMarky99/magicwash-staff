<script setup>
import { computed } from 'vue'

const props = defineProps({
  customer: { type: String, default: '' },
  time:     { type: String, default: '' },
  date:     { type: String, default: '' },
  address:  { type: String, default: '' },
})

const contact = computed(() => {
  if (!props.address) return {}
  try {
    const obj = JSON.parse(props.address)
    if (obj && typeof obj === 'object') return obj
  } catch (_) {}
  return { Address: props.address }
})

const displayName = computed(() => {
  const c = contact.value
  return c.CustomerName
    ? `${c.CustomerName}${c.CustomerLabel ? ` (${c.CustomerLabel})` : ''}`
    : props.customer
})

const displayAddress = computed(() =>
  (contact.value.Address || '').split(',')[0].trim()
)

const formattedDate = computed(() => {
  if (!props.date) return '—'
  const d = new Date(props.date + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
})
</script>

<template>
  <div class="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
    <div class="flex items-center gap-4 mb-4">
      <div class="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0 overflow-hidden">
        <span class="material-symbols-outlined fill-icon text-[48px] text-outline-variant translate-y-1">account_circle</span>
      </div>
      <div>
        <h3 class="font-headline font-bold text-base text-primary leading-tight">{{ displayName }}</h3>
        <p v-if="displayAddress" class="font-body text-xs text-on-surface-variant mt-0.5">{{ displayAddress }}</p>
      </div>
    </div>
    <div class="flex justify-between items-center pt-4 border-t border-outline-variant/20">
      <div class="flex items-center gap-2 text-on-surface">
        <span class="material-symbols-outlined text-primary text-[18px]" aria-hidden="true">calendar_today</span>
        <span class="font-body text-sm font-medium">{{ formattedDate }}</span>
      </div>
      <div class="flex items-center gap-2 text-on-surface">
        <span class="material-symbols-outlined text-primary text-[18px]" aria-hidden="true">schedule</span>
        <span class="font-body text-sm font-medium">{{ time || '—' }}</span>
      </div>
    </div>
  </div>
</template>
