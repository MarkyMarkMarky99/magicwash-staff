<script setup lang="ts">
import type { AppointmentsAgentEventImage } from '@/data/appointments-agent/appointments-agent.service'
import type { AppointmentsImageState } from '@/data/appointments-agent/appointments-agent.store'

const props = defineProps<{
  images: AppointmentsAgentEventImage[]
  states: Record<string, AppointmentsImageState>
  alignEnd?: boolean
}>()

function readyUrl(id: string): string | null {
  const state = props.states[id]
  return state?.status === 'ready' ? state.url : null
}
</script>

<template>
  <div v-if="images.length" class="flex flex-wrap gap-1.5" :class="alignEnd ? 'justify-end' : ''">
    <template v-for="image in images" :key="image.id">
      <img v-if="readyUrl(image.id)" :src="readyUrl(image.id) ?? undefined" :alt="image.name" class="rounded-xl border-2 border-white bg-surface-container object-cover" :class="images.length === 1 ? 'h-40 w-40' : 'h-[92px] w-[92px]'" />
      <span v-else class="grid place-items-center rounded-xl border-2 border-white bg-surface-container text-on-surface-variant" :class="images.length === 1 ? 'h-40 w-40' : 'h-[92px] w-[92px]'" :role="states[image.id]?.status === 'failed' ? undefined : 'status'" :aria-label="states[image.id]?.status === 'failed' ? undefined : 'Loading image'">
        <span v-if="states[image.id]?.status === 'failed'" class="material-symbols-outlined text-[24px]" aria-label="Image unavailable">broken_image</span>
      </span>
    </template>
  </div>
</template>
