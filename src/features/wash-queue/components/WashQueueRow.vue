<script setup lang="ts">
import { computed } from 'vue'
import type { z } from 'zod'
import type { washQueueRowSchema } from '@contracts/wash-queue/wash-queue-api.schema'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import BaseRowCard from '@/shared/components/BaseRowCard.vue'
import { formatBookedAt } from '../format-booked-at'
import { formatWeights } from '../format-weights'
import WashQueueActionButton from './WashQueueActionButton.vue'

type WashQueueDto = z.infer<typeof washQueueRowSchema>
export type WashQueueRowAction = 'unload' | 'collect' | 'cancel'

const props = defineProps<{
  row: WashQueueDto
  sender: string
  position?: number
  mine: boolean
  busy: boolean
  actions: readonly WashQueueRowAction[]
}>()
defineEmits<{ photo: [id: string]; action: [action: WashQueueRowAction] }>()

const statusBadge = {
  Pending: { label: 'Waiting', tone: 'warning' },
  'In Progress': { label: 'In machine', tone: 'accent' },
  Completed: { label: 'Ready for pickup', tone: 'success' },
} as const
const badge = computed(() => statusBadge[props.row.status as keyof typeof statusBadge] ?? { label: props.row.status, tone: 'neutral' as const })
const actionLabels = { unload: 'Unload', collect: 'Pick up', cancel: 'Cancel' } as const
const primary = computed(() => props.actions.filter(action => action !== 'cancel'))
</script>

<template>
  <div class="px-4 py-2">
    <div class="relative overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-low">
      <span v-if="mine" class="absolute inset-y-0 left-0 w-1 bg-lime" aria-hidden="true" />
      <BaseRowCard :line1="sender" :line2="row.instruction ?? ''" line3="">
        <template #lead>
          <div class="flex items-center gap-2.5">
            <p v-if="position" class="flex w-7 flex-col items-end border-r border-outline-variant pr-2 font-headline text-[22px] font-extrabold leading-none tabular-nums text-primary" :aria-label="`Position ${position}`">{{ position }}</p>
            <button type="button" class="block h-14 w-14 shrink-0 overflow-hidden rounded-[10px] bg-surface-container focus-visible:outline-2 focus-visible:outline-lime" :aria-label="`View basket photo for ${sender}`" @click="$emit('photo', row.id)">
              <img :src="row.photoUrl" alt="" class="h-full w-full object-cover" loading="lazy" />
            </button>
          </div>
        </template>
        <template #line1>{{ sender }}<BaseBadge v-if="mine" class="ml-1.5 align-middle" label="You" tone="brand" /></template>
        <template #line3>Booked {{ formatBookedAt(row.createdAt) }}</template>
        <template #top-end><BaseBadge :label="badge.label" :tone="badge.tone" size="sm" /></template>
        <template #bot-end><strong v-if="formatWeights(row)" class="whitespace-nowrap font-label text-xs font-bold text-on-surface">{{ formatWeights(row) }}</strong></template>
      </BaseRowCard>
      <div v-if="actions.length" class="flex items-center gap-2 px-4 pb-3" :class="primary.length ? '' : 'justify-end'">
        <WashQueueActionButton v-for="action in primary" :key="action" class="flex-1" :label="actionLabels[action]" :busy="busy" @click="$emit('action', action)" />
        <WashQueueActionButton v-if="actions.includes('cancel')" variant="quiet" :label="actionLabels.cancel" :disabled="busy" @click="$emit('action', 'cancel')" />
      </div>
    </div>
  </div>
</template>
