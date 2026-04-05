<script setup>
import { ref } from 'vue'
import BaseSwipeCard from './BaseSwipeCard.vue'

const props = defineProps({
  customer: { type: Object, required: true },
})

const TYPE_COLORS = {
  Regular:   'bg-gray-100 text-gray-600',
  Member:    'bg-blue-50 text-blue-700',
  Corporate: 'bg-amber-50 text-amber-700',
}

const baseRef = ref(null)

function onSwipeRight() {
  baseRef.value?.snapCard('none')
}

function callPhone(phone) {
  window.location.href = `tel:${phone}`
}

function openMaps(addr) {
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving`,
    '_blank'
  )
}
</script>

<template>
  <BaseSwipeCard ref="baseRef" @swipe-right="onSwipeRight">

    <!-- Left panel: action buttons -->
    <template #left-panel>
      <div class="absolute inset-0 bg-primary flex items-center justify-end text-on-primary">
        <div class="flex items-center justify-evenly" style="width: var(--snap-left)">
          <button
            :disabled="!customer.phone"
            :class="['flex flex-col items-center gap-0.5 transition-all', customer.phone ? 'hover:scale-110' : 'opacity-30 cursor-not-allowed']"
            @click="customer.phone && callPhone(customer.phone)"
          >
            <span class="material-symbols-outlined text-[20px]">call</span>
            <span class="font-label text-[8px] font-bold uppercase">Call</span>
          </button>
          <button
            disabled
            class="flex flex-col items-center gap-0.5 opacity-30 cursor-not-allowed"
          >
            <span class="material-symbols-outlined text-[20px]">calendar_add_on</span>
            <span class="font-label text-[8px] font-bold uppercase">Book</span>
          </button>
          <button
            :disabled="!customer.address"
            :class="['flex flex-col items-center gap-0.5 transition-all', customer.address ? 'hover:scale-110' : 'opacity-30 cursor-not-allowed']"
            @click="customer.address && openMaps(customer.address)"
          >
            <span class="material-symbols-outlined text-[20px]">near_me</span>
            <span class="font-label text-[8px] font-bold uppercase">Nav</span>
          </button>
        </div>
      </div>
    </template>

    <!-- Card content -->
    <div class="px-4 py-3 flex gap-3">
      <!-- Avatar -->
      <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-outline-variant/10">
        <span class="material-symbols-outlined fill-icon text-[20px]">person</span>
      </div>

      <!-- Info -->
      <div class="flex-grow min-w-0 flex flex-col justify-center">
        <!-- Row 1: name + type badge -->
        <div class="flex items-center gap-1.5 mb-0.5 min-w-0">
          <h3 class="font-headline font-bold text-primary text-[14px] leading-tight truncate">
            {{ customer.name || '—' }}{{ customer.index ? ` (${customer.index})` : '' }}
          </h3>
          <span
            v-if="customer.type"
            class="inline-flex items-center px-1.5 py-px rounded-full font-label text-[9px] font-bold uppercase tracking-wide shrink-0"
            :class="TYPE_COLORS[customer.type] || 'bg-gray-100 text-gray-600'"
          >
            {{ customer.type }}
          </span>
        </div>

        <!-- Row 2: phone -->
        <div v-if="customer.phone" class="flex items-center gap-1 min-w-0">
          <span class="material-symbols-outlined text-[14px] text-on-surface-variant shrink-0">phone</span>
          <p class="font-body text-xs text-on-surface-variant truncate">{{ customer.phone }}</p>
        </div>

        <!-- Row 3: address -->
        <div v-if="customer.address" class="flex items-center gap-1 min-w-0">
          <span class="material-symbols-outlined text-[14px] text-on-surface-variant shrink-0">location_on</span>
          <p class="font-body text-xs text-on-surface-variant truncate">{{ customer.address }}</p>
        </div>
      </div>
    </div>

  </BaseSwipeCard>
</template>
