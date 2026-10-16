<script setup lang="ts">
import type { ScanDisplay } from '../scan-result'
import ScanResultCard from './ScanResultCard.vue'

// Gun-read popup shell. `overlay` renders it into the overlay layer, above an open bottom sheet,
// which otherwise covers and inerts everything in the page.
defineProps<{ notice: ScanDisplay | null; seq: number; overlay?: boolean }>()
defineEmits<{ dismiss: [] }>()
</script>

<template>
  <Teleport to="#overlay-root" :disabled="!overlay">
    <div
      v-if="notice"
      class="pointer-events-none absolute"
      :class="overlay ? 'inset-x-4 top-[max(0.75rem,env(safe-area-inset-top))] z-30' : 'bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-4 right-20 z-20'"
    >
      <div :key="seq" class="pointer-events-auto"><ScanResultCard :result="notice" dismissible @dismiss="$emit('dismiss')" /></div>
    </div>
  </Teleport>
</template>
