<script setup lang="ts">
import { computed, ref } from 'vue'
import type { z } from 'zod'
import type { washQueueRowSchema } from '@contracts/wash-queue/wash-queue-api.schema'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import { formatBookedAt, formatStartedAt } from '../format-booked-at'
import { elapsedSeconds, formatElapsed, RUNNING_LONG_SECONDS } from '../format-elapsed'
import { washOptionLabels } from '../wash-options'
import { formatKgFigure } from '../format-weights'

type WashQueueDto = z.infer<typeof washQueueRowSchema>
export type WashQueueRowAction = 'load' | 'unload' | 'collect' | 'cancel'
type PrimaryAction = Exclude<WashQueueRowAction, 'cancel'>

const props = defineProps<{
  row: WashQueueDto
  sender: string
  productName?: (id: string) => string
  position?: number
  machine: string
  now?: number
  mine: boolean
  busy: boolean
  primary: PrimaryAction | null
  cancellable: boolean
}>()
const emit = defineEmits<{ photo: [id: string]; action: [action: WashQueueRowAction]; opened: [] }>()

const root = ref<HTMLElement | null>(null)
const swipe = ref<{ snapCard: (direction: string) => void } | null>(null)
const swipeable = computed(() => props.primary !== null || props.cancellable)
const isNext = computed(() => props.position === 1)
const framed = computed(() => props.row.status === 'In Progress')
const elapsed = computed(() => framed.value && props.now !== undefined ? elapsedSeconds(props.row.loadedAt, props.now) : null)
const runningLong = computed(() => elapsed.value !== null && elapsed.value > RUNNING_LONG_SECONDS)
const frameVars = computed(() => ({
  '--wq-edge': runningLong.value ? 'var(--color-warning)' : 'var(--color-primary)',
  '--wq-shade': 'color-mix(in srgb, var(--wq-edge) 70%, black)',
}))

const statuses = {
  Pending: { text: 'Waiting', tone: 'text-warning' },
  'In Progress': { text: 'In machine', tone: 'text-secondary' },
  Completed: { text: 'Ready for pickup', tone: 'text-success' },
} as const
const status = computed(() => statuses[props.row.status as keyof typeof statuses] ?? { text: props.row.status, tone: 'text-on-surface-variant' })
// The section already names the status, so the line shows the booked machine; legacy rows without one keep the status.
const statusLine = computed(() => props.machine || status.value.text)
const figure = computed(() => {
  const value = props.row.status === 'Completed' ? (props.row.weightAfterKg ?? props.row.weightBeforeKg) : props.row.weightBeforeKg
  return value === null ? '–' : formatKgFigure(value)
})
const meta = computed(() => [
  props.row.status === 'Completed' && props.row.weightBeforeKg !== null ? `Dry ${formatKgFigure(props.row.weightBeforeKg)} kg` : '',
  props.row.status === 'In Progress' && props.row.loadedAt ? formatStartedAt(props.row.loadedAt) : formatBookedAt(props.row.createdAt),
  props.row.washOptions !== null ? washOptionLabels(props.row.washOptions, props.productName ?? ((id) => id)).join(' · ') : props.row.instruction ?? '',
].filter(Boolean).join(' · '))
const busyLabel = computed(() => props.row.status === 'In Progress' ? 'Unloading…' : props.row.status === 'Completed' ? 'Picking up…' : 'Updating…')
const primaryPanels = {
  load: { icon: 'play_arrow', label: 'Load' },
  unload: { icon: 'eject', label: 'Unload' },
  collect: { icon: 'shopping_bag', label: 'Pick up' },
} as const

function trigger(action: WashQueueRowAction): void {
  swipe.value?.snapCard('none')
  emit('action', action)
}
// BaseSwipeCard snaps in either direction; an unavailable direction is reset so it never blocks the next swipe.
function rejectRight(): void {
  if (props.primary) emit('opened')
  else swipe.value?.snapCard('none')
}
function rejectLeft(): void {
  if (props.cancellable) emit('opened')
  else swipe.value?.snapCard('none')
}
function close(): void {
  swipe.value?.snapCard('none')
}
function contains(target: Node): boolean {
  return root.value?.contains(target) ?? false
}
defineExpose({ close, contains })
</script>

<template>
  <li ref="root" :class="framed ? 'relative rounded-[11px_15px_12px_14px] border-2 border-[color:var(--wq-edge)] bg-white shadow-[4px_4px_0_var(--wq-shade)] [--wq-radius:9px_13px_10px_12px]' : ''" :style="framed ? frameVars : undefined">
    <span v-if="elapsed !== null" role="timer" class="pointer-events-none absolute -top-3 left-2.5 z-40 inline-flex -rotate-3 items-center gap-1 rounded-[6px_8px_6px_7px] bg-[color:var(--wq-edge)] px-[9px] pb-1 pt-[3px] font-headline text-[11px] font-bold leading-[1.1] tabular-nums text-white shadow-[1px_1px_0_var(--wq-shade)]">
      <span class="material-symbols-outlined text-[11px] leading-none" aria-hidden="true">timer</span>{{ formatElapsed(elapsed) }}
    </span>
    <component
      :is="swipeable ? BaseSwipeCard : 'div'"
      ref="swipe"
      v-bind="swipeable ? { disabled: busy, rightActions: primary ? 2 : 0, leftActions: cancellable ? 1 : 0 } : {}"
      class="relative overflow-hidden [border-radius:var(--wq-radius,14px)] bg-white shadow-[0_1px_0_rgba(7,63,56,0.05)]"
      @swipe-right="rejectRight"
      @swipe-left="rejectLeft"
    >
      <template v-if="swipeable && primary" #right-panel>
        <button type="button" tabindex="-1" class="absolute inset-y-0 left-0 z-10 flex w-40 items-center gap-2 bg-lime px-5 font-label text-[11px] font-bold uppercase text-primary" :aria-label="`${primaryPanels[primary].label} basket`" @click="trigger(primary)">
          <span class="material-symbols-outlined text-[26px]" aria-hidden="true">{{ primaryPanels[primary].icon }}</span>{{ primaryPanels[primary].label }}
        </button>
      </template>
      <template v-if="swipeable && cancellable" #left-panel>
        <button type="button" tabindex="-1" class="absolute inset-y-0 right-0 flex w-20 flex-col items-center justify-center gap-0.5 bg-error pl-4 font-label text-[10px] font-bold uppercase text-on-error" aria-label="Cancel booking" @click="trigger('cancel')">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>Cancel
        </button>
      </template>

      <span v-if="swipeable && primary" class="material-symbols-outlined pointer-events-none absolute left-px top-1/2 z-20 -translate-y-1/2 text-[14px] text-primary opacity-30" aria-hidden="true">chevron_right</span>
      <span v-if="swipeable && cancellable" class="material-symbols-outlined pointer-events-none absolute right-px top-1/2 z-20 -translate-y-1/2 text-[14px] text-primary opacity-30" aria-hidden="true">chevron_left</span>
      <div class="grid grid-cols-[52px_minmax(0,1fr)_56px] items-center gap-2.5 px-3 py-2.5">
        <p class="flex flex-col items-end border-r border-outline-variant pr-2 text-primary">
          <span class="font-headline text-[22px] font-extrabold leading-none tabular-nums">{{ figure }}</span>
          <span class="mt-1 font-label text-[11px] text-on-surface-variant">kg</span>
        </p>
        <div class="min-w-0">
          <p class="flex items-center gap-1.5 font-body text-sm font-extrabold">
            <span v-if="row.tagCode" class="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-primary px-1 font-headline text-sm font-extrabold leading-none text-lime" :aria-label="`Tag ${row.tagCode}`">{{ row.tagCode }}</span>
            <span class="truncate">{{ sender }}</span>
            <BaseBadge v-if="mine" label="You" tone="brand" />
            <BaseBadge v-if="isNext" label="Next" tone="lime" uppercase />
          </p>
          <p class="mt-1 font-label text-[10px] font-extrabold uppercase" :class="status.tone">{{ statusLine }}</p>
          <p class="mt-1 truncate font-label text-[11px] text-on-surface-variant">{{ meta }}</p>
        </div>
        <div class="relative h-14 w-14">
          <button type="button" class="block h-full w-full overflow-hidden rounded-[10px] bg-surface-container focus-visible:outline-2 focus-visible:outline-lime" :aria-label="`View basket photo for ${sender}`" @touchstart.stop @touchmove.stop @touchend.stop @mousedown.stop @click="emit('photo', row.id)">
            <img :src="row.photoUrl" alt="" class="h-full w-full object-cover" loading="lazy" />
          </button>
          <button v-if="row.unloadPhotoUrl" type="button" class="absolute -bottom-1.5 -left-1.5 h-[26px] w-[26px] overflow-hidden rounded-lg border-2 border-white bg-surface-container focus-visible:outline-2 focus-visible:outline-lime" :aria-label="`View washed basket photo for ${sender}`" @touchstart.stop @touchmove.stop @touchend.stop @mousedown.stop @click="emit('photo', `${row.id}:after`)">
            <img :src="row.unloadPhotoUrl" alt="" class="h-full w-full object-cover" loading="lazy" />
          </button>
          <span v-if="row.status === 'Completed'" class="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-lime text-primary" aria-hidden="true"><span class="material-symbols-outlined block text-[14px] leading-none">check</span></span>
          <span v-else-if="row.status === 'In Progress'" class="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-primary text-lime" aria-hidden="true"><span class="material-symbols-outlined block text-[14px] leading-none">sync</span></span>
          <span v-else class="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full border-2 border-dashed border-outline-variant bg-surface" aria-hidden="true" />
        </div>
      </div>

      <!-- Keyboard and screen-reader alternative to the swipe panels: Tab reaches these, focus reveals them. -->
      <div v-if="swipeable" class="sr-only flex gap-2 focus-within:not-sr-only focus-within:px-3 focus-within:pb-3">
        <button v-if="primary" type="button" class="h-11 rounded-full bg-primary px-5 font-label text-sm font-bold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-50" :disabled="busy" @click="trigger(primary)">{{ primaryPanels[primary].label }}</button>
        <button v-if="cancellable" type="button" class="h-11 rounded-full border border-outline-variant px-5 font-label text-sm text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-50" :disabled="busy" @click="trigger('cancel')">Cancel booking</button>
      </div>

      <div v-if="busy" class="absolute inset-0 z-30 flex items-center justify-center gap-2 bg-white/85 font-label text-xs font-bold text-primary" role="status">
        <span class="material-symbols-outlined animate-spin text-[18px]" aria-hidden="true">sync</span>{{ busyLabel }}
      </div>
    </component>
  </li>
</template>

<style scoped>
/* BaseSwipeCard moves an unrounded, hover-tinted inner card; keep it a white rounded card mid-swipe.
   The lime panel is wider than the snap distance so its colour shows behind the rounded corners. */
:deep(.swipe-card) {
  border-radius: var(--wq-radius, 14px);
  background-color: var(--color-surface-container-lowest) !important;
  /* Covers the anti-aliased sliver of the lime/red panels at the coinciding rounded corners at rest. */
  box-shadow: 0 0 0 1px var(--color-surface-container-lowest);
}
</style>
