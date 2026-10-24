<script setup lang="ts">
import { ref, watch } from 'vue'
import type { OrderIntakeGarment } from '@/features/orders/utils/order-intake-draft'
import type { OrderIntakeScanBanner } from '@/features/orders/utils/order-intake-scan'

const props = withDefaults(defineProps<{
  banner: OrderIntakeScanBanner
  garment: OrderIntakeGarment | null
  itemName: string | null
  actions?: boolean
}>(), { actions: true })
const emit = defineEmits<{ dismiss: [], defect: [], changeType: [] }>()

const imageFailed = ref(false)
watch(() => props.garment?.imageUrl, () => { imageFailed.value = false })

const ACTION = 'inline-flex h-9 items-center gap-1 rounded-full bg-white/15 px-3 text-[13px] font-bold focus-visible:outline-2 focus-visible:outline-lime'
</script>

<template>
  <div role="status" class="banner relative flex gap-3 rounded-2xl bg-black/75 p-2 pr-10 text-white shadow-lg backdrop-blur-md">
    <button type="button" class="absolute right-1.5 top-1.5 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white/15 text-white focus-visible:outline-2 focus-visible:outline-lime" aria-label="Dismiss" @click="emit('dismiss')">
      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
    </button>

    <div v-if="banner.tone === 'error'" class="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-error text-on-error" aria-hidden="true">
      <span class="material-symbols-outlined text-[36px]">cancel</span>
    </div>
    <div v-else class="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white/10">
      <img v-if="garment?.imageUrl && !imageFailed" :src="garment.imageUrl" alt="" class="h-full w-full object-cover" @error="imageFailed = true">
      <span v-else class="absolute inset-0 grid place-items-center text-white/60" aria-hidden="true">
        <span class="material-symbols-outlined text-[36px]">checkroom</span>
      </span>
      <span
        class="absolute left-1 top-1 grid h-[26px] w-[26px] place-items-center rounded-full ring-2 ring-black/60"
        :class="banner.tone === 'success' ? 'bg-lime text-primary' : 'bg-warning text-white'"
        aria-hidden="true"
      >
        <span class="material-symbols-outlined text-[18px]">{{ banner.tone === 'success' ? 'check' : 'priority_high' }}</span>
      </span>
    </div>

    <div class="flex min-w-0 flex-1 flex-col justify-center gap-1">
      <span class="font-headline text-base font-extrabold tracking-[0.06em]">{{ banner.tag ?? 'Scan' }}</span>
      <span v-if="banner.message" class="w-max max-w-full rounded-full px-2.5 py-0.5 text-xs font-bold" :class="banner.tone === 'error' ? 'bg-error text-on-error' : 'bg-warning text-white'">{{ banner.message }}</span>
      <template v-if="banner.tone !== 'error'">
        <span v-if="itemName" class="text-[15px] font-bold">{{ itemName }}</span>
        <span v-else class="text-[15px] font-bold text-warning">Uncategorized</span>
        <div v-if="actions" class="mt-1 flex gap-2">
          <button type="button" :class="ACTION" @click="emit('defect')">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">photo_camera</span>{{ garment && garment.defectPhotos.length > 0 ? `Defect ${garment.defectPhotos.length}` : 'Defect photo' }}
          </button>
          <button type="button" :class="ACTION" @click="emit('changeType')">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">swap_horiz</span>Change type
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.banner {
  animation: banner-pop 160ms ease-out;
}
@keyframes banner-pop {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .banner { animation: none; }
}
</style>
