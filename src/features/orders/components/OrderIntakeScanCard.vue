<script setup lang="ts">
import { ref, watch } from 'vue'
import type { OrderIntakeGarment } from '@/features/orders/utils/order-intake-draft'
import type { OrderIntakeScanBanner } from '@/features/orders/utils/order-intake-scan'

// The large scan result shown in the middle of the Intake page after every scan.
// It does not block the page: the next scan replaces it.
const props = defineProps<{
  banner: OrderIntakeScanBanner
  garment: OrderIntakeGarment | null
  itemName: string | null
}>()
const emit = defineEmits<{ dismiss: [], defect: [], changeType: [] }>()

const imageFailed = ref(false)
watch(() => props.garment?.imageUrl, () => { imageFailed.value = false })

const ACTION = 'inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/15 px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-lime'
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4">
    <div role="status" class="scan-card pointer-events-auto relative w-full max-w-[22rem] rounded-3xl bg-black/65 p-3 text-white shadow-2xl backdrop-blur-md backdrop-saturate-150">
      <button type="button" class="absolute right-6 top-6 z-[1] flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white focus-visible:outline-2 focus-visible:outline-lime" aria-label="Dismiss" @click="emit('dismiss')">
        <span class="material-symbols-outlined text-[22px]" aria-hidden="true">close</span>
      </button>

      <div v-if="banner.tone === 'error'" class="grid h-40 w-full place-items-center rounded-2xl bg-error text-on-error" aria-hidden="true">
        <span class="material-symbols-outlined text-[64px]">cancel</span>
      </div>
      <div v-else class="relative aspect-square w-full overflow-hidden rounded-2xl bg-white/10">
        <img v-if="garment?.imageUrl && !imageFailed" :src="garment.imageUrl" alt="" class="h-full w-full object-cover" @error="imageFailed = true">
        <span v-else class="absolute inset-0 grid place-items-center text-white/60" aria-hidden="true">
          <span class="material-symbols-outlined text-[64px]">checkroom</span>
        </span>
      </div>

      <div class="flex flex-col gap-1.5 px-1 pb-1 pt-3">
        <div class="flex items-center gap-2">
          <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span class="font-headline text-2xl font-extrabold tracking-[0.06em]">{{ banner.tag ?? 'Scan' }}</span>
            <span v-if="banner.message" class="rounded-full px-3 py-1 text-xs font-bold" :class="banner.tone === 'error' ? 'bg-error text-on-error' : 'bg-warning text-white'">{{ banner.message }}</span>
          </div>
          <span
            v-if="banner.tone !== 'error'"
            class="grid h-8 w-8 shrink-0 place-items-center rounded-full"
            :class="banner.tone === 'success' ? 'bg-lime text-primary' : 'bg-warning text-white'"
            aria-hidden="true"
          >
            <span class="material-symbols-outlined text-[22px]">{{ banner.tone === 'success' ? 'check' : 'priority_high' }}</span>
          </span>
        </div>
        <template v-if="banner.tone !== 'error'">
          <span v-if="itemName" class="font-headline text-lg font-bold">{{ itemName }}</span>
          <span v-else class="font-headline text-lg font-bold text-warning">Uncategorized</span>
          <div class="mt-2 flex gap-2">
            <button type="button" :class="ACTION" @click="emit('defect')">
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">photo_camera</span>{{ garment && garment.defectPhotos.length > 0 ? `Defect ${garment.defectPhotos.length}` : 'Defect photo' }}
            </button>
            <button type="button" :class="ACTION" @click="emit('changeType')">
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">swap_horiz</span>Change type
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scan-card {
  animation: scan-card-pop 160ms ease-out;
}
@keyframes scan-card-pop {
  from { opacity: 0; transform: scale(0.94); }
  to { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .scan-card { animation: none; }
}
</style>
