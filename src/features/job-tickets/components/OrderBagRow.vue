<script setup lang="ts">
import { computed } from 'vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'

export type BagRowTone = 'success' | 'muted' | 'warning' | 'error'

const props = defineProps<{
  count: number | string | null
  unit: string
  title: string
  badge?: string
  status: string
  tone: BagRowTone
  photoUrl: string | null
  done: boolean
  dimPhoto?: boolean
  deletable?: boolean
  photoAction?: boolean
  uploading?: boolean
}>()
const emit = defineEmits<{ open: []; delete: []; takePhoto: [] }>()

const toneClass = { success: 'text-success', muted: 'text-on-surface-variant', warning: 'text-warning', error: 'text-error' }
const photo = computed(() => props.photoUrl && /^https?:\/\//.test(props.photoUrl) ? props.photoUrl : null)
const countClass = computed(() => props.tone === 'error' ? 'border-error/50 text-error' : props.done ? 'border-lime/60 text-primary' : 'border-outline-variant text-primary')
</script>

<template>
  <li>
    <component
      :is="deletable ? BaseSwipeCard : 'div'"
      v-bind="deletable ? { pressable: true, leftActions: 1 } : {}"
      class="overflow-hidden rounded-[14px] bg-white shadow-[0_1px_0_rgba(7,63,56,0.05)]"
      :class="deletable ? 'ring-1 ring-lime/50' : ''"
      @tap="emit('open')"
    >
      <template v-if="deletable" #left-panel>
        <button type="button" class="absolute inset-y-0 right-0 flex w-16 flex-col items-center justify-center gap-0.5 bg-error font-label text-[10px] font-bold text-on-error focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lime" :aria-label="`Delete ${title}`" @click="emit('delete')">
          <span class="material-symbols-outlined" aria-hidden="true">delete</span>Delete
        </button>
      </template>
      <div class="grid grid-cols-[52px_minmax(0,1fr)_56px] items-center gap-2.5 px-3 py-2.5">
        <p v-if="count !== null" class="flex flex-col items-end border-r pr-2" :class="countClass"><span class="font-headline text-[22px] font-extrabold leading-none tabular-nums">{{ count }}</span><span class="mt-1 font-label text-[11px] text-on-surface-variant">{{ unit }}</span></p>
        <div class="min-w-0" :class="count === null ? 'col-span-2' : ''">
          <p class="flex items-center gap-1.5 truncate font-body text-sm font-extrabold">{{ title }}<BaseBadge v-if="badge" :label="badge" tone="accent" uppercase /></p>
          <p class="mt-1 font-label text-[10px] font-extrabold uppercase" :class="toneClass[tone]">{{ status }}</p>
        </div>
        <div v-if="uploading" role="status" aria-label="Uploading bag photo" class="grid h-14 w-14 place-items-center rounded-[10px] bg-surface-container"><span class="material-symbols-outlined animate-spin" aria-hidden="true">sync</span></div>
        <button v-else-if="photoAction && !photo" type="button" class="grid h-14 w-14 place-items-center rounded-[10px] border-2 border-dashed border-outline-variant bg-white text-on-surface-variant active:bg-surface-container focus-visible:outline-2 focus-visible:outline-lime" aria-label="Take bag photo" @touchstart.stop @touchmove.stop @touchend.stop @mousedown.stop @click="emit('takePhoto')">
          <span class="material-symbols-outlined" aria-hidden="true">photo_camera</span>
        </button>
        <div v-else class="relative h-14 w-14">
          <div class="h-full overflow-hidden rounded-[10px] bg-surface-container" :class="dimPhoto ? 'opacity-60 saturate-50' : ''"><img v-if="photo" :src="photo" :alt="`${title} photo`" class="h-full w-full object-cover"><span v-else class="material-symbols-outlined grid h-full place-items-center text-on-surface-variant" aria-hidden="true">image</span></div>
          <span v-if="done" class="material-symbols-outlined absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-surface bg-lime text-[15px] text-primary" aria-hidden="true">check</span>
          <span v-else class="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full border-2 border-dashed border-outline-variant bg-surface" />
        </div>
      </div>
    </component>
  </li>
</template>
