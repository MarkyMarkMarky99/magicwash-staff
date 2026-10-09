<script setup lang="ts">
import { computed } from 'vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'

const props = defineProps<{ number: number; itemCount: number; photoUrl: string | null; uploading?: boolean }>()
const emit = defineEmits<{ open: []; delete: []; takePhoto: [] }>()

const empty = computed(() => props.itemCount === 0)
</script>

<template>
  <li>
    <BaseSwipeCard class="overflow-hidden rounded-[14px] ring-1 ring-lime/50 shadow-[0_1px_0_color-mix(in_srgb,var(--color-on-surface)_5%,transparent)]" pressable :left-actions="1" @tap="emit('open')">
      <template #left-panel>
        <button type="button" class="absolute inset-y-0 right-0 flex w-16 flex-col items-center justify-center gap-0.5 bg-error font-label text-[10px] font-bold text-on-error focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lime" :aria-label="`Delete bag ${number}`" @click="emit('delete')">
          <span class="material-symbols-outlined" aria-hidden="true">delete</span>Delete
        </button>
      </template>
      <div class="grid grid-cols-[52px_minmax(0,1fr)_56px] items-center gap-2.5 px-3 py-2.5">
        <p class="flex flex-col items-end justify-center self-stretch border-r pr-2" :class="empty ? 'border-error/50 text-error' : 'border-outline-variant text-primary'">
          <span class="font-[Manrope,sans-serif] text-[22px] font-extrabold leading-none tracking-[-0.06em] tabular-nums">{{ itemCount }}</span>
          <span class="mt-[3px] font-label text-[11px] font-semibold leading-none text-on-surface-variant">{{ itemCount === 1 ? 'item' : 'items' }}</span>
        </p>
        <div class="min-w-0">
          <p class="flex items-center gap-1.5 truncate font-body text-sm font-extrabold leading-tight tracking-[-0.015em] text-on-surface">Bag {{ number }}<BaseBadge label="New" tone="accent" uppercase /></p>
          <p class="mt-1.5 min-w-0 font-label text-[10px] font-extrabold uppercase leading-tight tracking-[0.04em]" :class="empty ? 'text-error' : !photoUrl ? 'text-warning' : 'text-success'">{{ empty ? 'Empty · delete or add garments' : !photoUrl ? 'Add bag photo' : 'Ready to confirm' }}</p>
        </div>
        <div v-if="uploading" role="status" aria-label="Uploading bag photo" class="grid h-14 w-14 place-items-center rounded-[10px] bg-surface-container"><span class="material-symbols-outlined animate-spin" aria-hidden="true">sync</span></div>
        <div v-else-if="photoUrl" class="h-14 w-14 overflow-hidden rounded-[10px] bg-surface-container"><img :src="photoUrl" :alt="`Bag ${number} photo`" class="h-full w-full object-cover"></div>
        <button v-else type="button" class="grid h-14 w-14 place-items-center rounded-[10px] border-2 border-dashed border-outline-variant bg-white text-on-surface-variant active:bg-surface-container focus-visible:outline-2 focus-visible:outline-lime" aria-label="Take bag photo" @touchstart.stop @touchmove.stop @touchend.stop @mousedown.stop @click="emit('takePhoto')">
          <span class="material-symbols-outlined" aria-hidden="true">photo_camera</span>
        </button>
      </div>
    </BaseSwipeCard>
  </li>
</template>
