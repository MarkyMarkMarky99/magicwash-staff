<script setup lang="ts">
export type AppointmentTypeMode = 'PICKUP' | 'DELIVERY'

defineProps<{ type: AppointmentTypeMode }>()
const emit = defineEmits<{ select: [type: AppointmentTypeMode] }>()
const options = [
  { key: 'PICKUP', label: 'Pickup', icon: 'move_to_inbox' },
  { key: 'DELIVERY', label: 'Delivery', icon: 'local_shipping' },
] as const
</script>

<template>
  <div class="pointer-events-none absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 flex justify-center">
    <div role="radiogroup" aria-label="Appointment type" class="pointer-events-auto relative grid h-[60px] w-[300px] max-w-[calc(100%-1.5rem)] grid-cols-2 rounded-2xl bg-primary p-1 shadow-[0_8px_16px_-4px_rgba(0,0,0,0.3)]">
      <span class="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-[12px] bg-lime transition-transform duration-200 motion-reduce:transition-none" :class="type === 'DELIVERY' ? 'translate-x-full' : ''" aria-hidden="true" />
      <button
        v-for="option in options"
        :key="option.key"
        type="button"
        role="radio"
        :aria-checked="type === option.key"
        class="relative z-10 flex items-center justify-center gap-2 rounded-[12px] font-label text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        :class="type === option.key ? 'text-primary' : 'text-on-primary/60'"
        @click="emit('select', option.key)"
      >
        <span class="material-symbols-outlined text-[24px]" aria-hidden="true">{{ option.icon }}</span>{{ option.label }}
      </button>
    </div>
  </div>
</template>
