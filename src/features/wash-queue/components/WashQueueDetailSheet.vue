<script setup lang="ts">
import { computed } from 'vue'
import type { z } from 'zod'
import type { washQueueRowSchema } from '@contracts/wash-queue/wash-queue-api.schema'
import BaseOverlayFrame from '@/shared/layouts/BaseOverlayFrame.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import { formatBookedAt, formatStartedAt } from '../format-booked-at'
import { formatKgFigure } from '../format-weights'
import { stepChips, stepLabel, washOptionsSummary } from '../wash-options'
import './wash-program.css'

type WashQueueDto = z.infer<typeof washQueueRowSchema>

const props = defineProps<{
  open: boolean
  row: WashQueueDto
  sender: string
  machine: string
  programName: (id: string) => string
  productName: (id: string) => string
}>()
const emit = defineEmits<{ close: []; photo: [id: string] }>()
const status = computed(() => ({
  Pending: 'Waiting',
  'In Progress': 'In machine',
  Completed: 'Ready for pickup',
  Collected: 'Collected',
  Cancelled: 'Cancelled',
})[props.row.status])
const facts = computed(() => [
  { label: 'Weight before', value: props.row.weightBeforeKg === null ? null : `${formatKgFigure(props.row.weightBeforeKg)} kg` },
  { label: 'Weight after', value: props.row.weightAfterKg === null ? null : `${formatKgFigure(props.row.weightAfterKg)} kg` },
  { label: 'Machine', value: props.machine || null },
  { label: 'Sender', value: props.sender },
  { label: 'Booked', value: formatBookedAt(props.row.createdAt) },
  { label: 'Loaded', value: props.row.loadedAt === null ? null : formatStartedAt(props.row.loadedAt) },
  { label: 'Unloaded', value: props.row.unloadedAt === null ? null : formatBookedAt(props.row.unloadedAt), wide: true },
])
const summaryTitle = computed(() => props.row.washOptions === null ? '' : props.row.washOptions.program === 'CUSTOM' ? 'Custom' : props.programName(props.row.washOptions.program))
const summaryRest = computed(() => props.row.washOptions === null ? '' : washOptionsSummary(props.row.washOptions, summaryTitle.value).slice(summaryTitle.value.length))
</script>

<template>
  <BaseOverlayFrame
    :open="open" placement="bottom" size="auto" backdrop="translucent" :draggable="false" :close-button="true"
    panel-class="!max-h-[calc(100%-30px)] !rounded-t-[28px]" close-button-class="!top-3 text-on-surface-variant"
    :ariaLabel="`Basket details for ${sender}`" @close="emit('close')"
  >
    <header class="flex flex-none items-center gap-3.5 pb-2 pl-5 pr-[60px] pt-[18px]">
      <div class="grid h-[60px] w-[60px] shrink-0 -rotate-4 place-items-center rounded-2xl font-headline font-extrabold leading-none tabular-nums"
        :class="[row.tagCode && row.tagCode.length > 1 ? 'text-[19px]' : 'text-[38px]', row.tagCode ? 'bg-primary text-lime shadow-[3px_3px_0_color-mix(in_srgb,var(--color-primary)_70%,black)]' : 'bg-surface-container text-on-surface-variant shadow-[3px_3px_0_var(--color-outline-variant)]']"
        :aria-label="row.tagCode ? `Tag ${row.tagCode}` : 'No tag'"
      >{{ row.tagCode || '–' }}</div>
      <div class="min-w-0">
        <h2 class="break-words font-headline text-[22px] font-extrabold leading-[1.15] text-primary">{{ sender }}</h2>
        <p class="mt-1 font-label text-[10px] font-extrabold uppercase leading-[1.3] tracking-[0.06em] text-secondary">{{ [machine, status].filter(Boolean).join(' · ') }}</p>
      </div>
    </header>
    <ScrollRegion class="wq-options px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-1">
      <div class="mt-2 grid grid-cols-2 gap-2.5">
        <button type="button" class="relative aspect-square overflow-hidden rounded-[18px] bg-surface-container-low focus-visible:outline-2 focus-visible:outline-lime" aria-label="View booking photo" @click="emit('photo', row.id)">
          <img :src="row.photoUrl" alt="Basket on the scale before washing" class="h-full w-full object-cover" />
          <span class="absolute bottom-2 left-2 rounded-full bg-on-surface/80 px-[9px] py-1 font-label text-[10px] font-bold leading-[1.1] text-white">Before wash</span>
        </button>
        <button v-if="row.unloadPhotoUrl" type="button" class="relative aspect-square overflow-hidden rounded-[18px] bg-surface-container-low focus-visible:outline-2 focus-visible:outline-lime" aria-label="View unload photo" @click="emit('photo', `${row.id}:after`)">
          <img :src="row.unloadPhotoUrl" alt="Basket on the scale after washing" class="h-full w-full object-cover" />
          <span class="absolute bottom-2 left-2 rounded-full bg-on-surface/80 px-[9px] py-1 font-label text-[10px] font-bold leading-[1.1] text-white">After wash</span>
        </button>
        <div v-else class="flex aspect-square flex-col items-center justify-center rounded-[18px] border-2 border-dashed border-primary/40 px-3 text-center font-body text-[13px] font-extrabold leading-[1.3]">
          <span class="mb-2 grid h-11 w-11 -rotate-7 place-items-center rounded-[14px] bg-secondary-container text-on-secondary-container"><span class="material-symbols-outlined fill text-[22px]" aria-hidden="true">photo_camera</span></span>
          No unload photo
        </div>
      </div>
      <dl class="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-outline-variant">
        <div v-for="fact in facts" :key="fact.label" class="min-w-0 bg-white px-[13px] py-[11px]" :class="{ 'col-span-2': fact.wide }">
          <dt class="font-label text-[10px] font-extrabold uppercase leading-[1.2] tracking-[0.08em] text-on-surface-variant">{{ fact.label }}</dt>
          <dd class="mt-1 break-words font-headline text-base font-extrabold leading-[1.25] tabular-nums text-primary" :class="{ 'text-on-surface-variant opacity-70': fact.value === null }">{{ fact.value ?? '–' }}</dd>
        </div>
      </dl>
      <section class="pb-1">
        <div class="sec !mt-[22px]"><div class="bar" /><div class="tt"><h3>Wash program</h3><small>{{ row.washOptions ? `${row.washOptions.steps.length} ${row.washOptions.steps.length === 1 ? 'step' : 'steps'}` : 'None recorded' }}</small></div></div>
        <div v-if="row.washOptions" class="sum-col">
          <div class="sum">
            <span class="tab">Program</span>
            <div class="sum-line has-mach"><span class="pn"><b>{{ summaryTitle }}</b>{{ summaryRest }}</span><span v-if="machine" class="mach"><span class="ms fill" aria-hidden="true">local_laundry_service</span>{{ machine }}</span></div>
            <ol class="line">
              <li v-for="(step, index) in row.washOptions.steps" :key="index" class="st">
                <span class="dot" aria-hidden="true" />
                <div class="ttl">{{ stepLabel(step.type) }}</div>
                <div class="sub"><span v-for="(chip, i) in stepChips(step, productName)" :key="i">{{ chip }}</span></div>
              </li>
            </ol>
          </div>
        </div>
        <div v-else class="mt-3.5 flex items-center gap-2 rounded-xl border-[1.5px] border-dashed border-outline-variant px-3 py-[11px] font-body text-[13px] font-semibold leading-[1.35] text-on-surface-variant">
          <span class="material-symbols-outlined text-xl" aria-hidden="true">local_laundry_service</span>No program recorded
        </div>
      </section>
      <aside v-if="row.instruction?.trim()" class="mt-3.5 flex items-start gap-2.5 rounded-xl bg-warning-container px-3 py-2.5 text-on-warning-container">
        <span class="material-symbols-outlined mt-px shrink-0 text-xl" aria-hidden="true">sticky_note_2</span>
        <div><h3 class="font-label text-[10px] font-extrabold uppercase leading-[1.2] tracking-[0.08em]">Instruction note</h3><p class="mt-[3px] whitespace-pre-wrap break-words font-body text-[13px] font-semibold leading-[1.4]">{{ row.instruction }}</p></div>
      </aside>
    </ScrollRegion>
  </BaseOverlayFrame>
</template>

<style scoped>
.sub span + span::before {
  content: "·";
  margin: 0 6px;
  color: var(--color-outline-variant);
  font-weight: 800;
}
</style>
