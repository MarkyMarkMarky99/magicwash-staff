<script setup lang="ts">
import type { z } from 'zod'
import type { washQueueRowSchema } from '@contracts/wash-queue/wash-queue-api.schema'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import { formatBookedAt } from '../format-booked-at'
import { formatWeights } from '../format-weights'
import WashQueueActionButton from './WashQueueActionButton.vue'

type WashQueueDto = z.infer<typeof washQueueRowSchema>

defineProps<{
  row: WashQueueDto
  sender: string
  mine: boolean
  busy: boolean
  canLoad: boolean
  canCancel: boolean
}>()
defineEmits<{ photo: [id: string]; load: []; cancel: [] }>()
</script>

<template>
  <div class="px-4 py-2">
    <div class="relative overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-low">
      <span v-if="mine" class="absolute inset-y-0 left-0 z-10 w-1 bg-lime" aria-hidden="true" />
      <button type="button" class="relative block aspect-4/3 w-full overflow-hidden bg-surface-container focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lime" :aria-label="`View basket photo for ${sender}`" @click="$emit('photo', row.id)">
        <img :src="row.photoUrl" alt="" class="h-full w-full object-cover" />
      </button>
      <div class="space-y-3 p-4">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-label text-[10px] font-extrabold uppercase tracking-[0.1em] text-on-surface-variant">Next in queue</p>
            <h3 class="mt-1 break-words font-headline text-base font-bold text-primary">{{ sender }}<BaseBadge v-if="mine" class="ml-1.5 align-middle" label="You" tone="brand" /></h3>
          </div>
          <BaseBadge label="Waiting" tone="warning" size="sm" />
        </div>
        <p v-if="row.instruction" class="whitespace-pre-wrap break-words font-body text-sm text-on-surface">{{ row.instruction }}</p>
        <p class="font-label text-xs text-on-surface-variant">Booked {{ formatBookedAt(row.createdAt) }}<template v-if="formatWeights(row)"> · <strong class="font-bold text-on-surface">{{ formatWeights(row) }}</strong></template></p>
        <div v-if="canLoad || canCancel" class="flex flex-col gap-3">
          <WashQueueActionButton v-if="canLoad" class="w-full" large label="Load into machine" :busy="busy" @click="$emit('load')" />
          <WashQueueActionButton v-if="canCancel" variant="quiet" class="w-full" label="Cancel booking" :disabled="busy" @click="$emit('cancel')" />
        </div>
      </div>
    </div>
  </div>
</template>
