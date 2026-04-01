<script setup>
import { computed } from 'vue'
import SwipeCard from './SwipeCard.vue'

const props = defineProps({
  title:           { type: String,   required: true },
  icon:            { type: String,   required: true },
  topDivider:      { type: Boolean,  default: false },
  items:           { type: Array,    default: () => [] },
  loading:         { type: Boolean,  default: false },
  error:           { type: String,   default: null },
  onStatusUpdate:  { type: Function, required: true },
  onReschedule:    { type: Function, required: true },
})

const headingId = computed(() =>
  `${props.title.toLowerCase().replace(/\s+/g, '-')}-heading`
)
</script>

<template>
  <section :aria-labelledby="headingId" class="bg-white w-full">

    <!-- Section heading -->
    <div
      :id="headingId"
      class="px-4 py-2 bg-surface-container-low text-primary flex items-center justify-between transition-colors"
      :class="topDivider ? 'border-t border-outline-variant/30' : ''"
    >
      <div class="flex items-center gap-2.5">
        <span class="material-symbols-outlined text-primary text-[16px]">{{ icon }}</span>
        <h2 class="font-headline font-bold text-[13px] tracking-tight">{{ title }}</h2>
      </div>
      <div class="flex items-center gap-1.5 bg-surface-container rounded-full px-2.5 py-1">
        <span class="font-label text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">
          {{ items.length }} Tasks
        </span>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="divide-y divide-outline-variant/10">
      <div v-for="i in 2" :key="i" class="px-4 py-4 flex gap-4 border-b border-gray-100 animate-pulse">
        <div class="w-12 h-12 rounded-full bg-surface-container shrink-0" />
        <div class="flex-grow flex flex-col gap-2 justify-center">
          <div class="h-4 bg-surface-container rounded w-3/4" />
          <div class="h-3 bg-surface-container rounded w-1/2" />
        </div>
      </div>
    </div>

    <!-- Error -->
    <p v-else-if="error" class="px-6 py-4 text-sm text-error">{{ error }}</p>

    <!-- Empty -->
    <p v-else-if="items.length === 0" class="px-6 py-4 text-sm text-on-surface-variant italic">
      No appointments
    </p>

    <!-- Cards -->
    <div v-else class="divide-y divide-outline-variant/10">
      <SwipeCard
        v-for="appt in items"
        :key="appt.appointmentId || appt.customer"
        v-bind="appt"
        :on-status-update="onStatusUpdate"
        :on-reschedule="onReschedule"
      />
    </div>

  </section>
</template>
