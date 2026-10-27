<script setup lang="ts">
import BaseOverlayFrame from '@/shared/layouts/BaseOverlayFrame.vue'

export type BookPhase = 'confirm' | 'booking' | 'success' | 'failed'

defineProps<{
  open: boolean
  phase: BookPhase
  dateLabel: string
  weekRange: string
  failureTitle: string
  failureMessage: string
}>()
const emit = defineEmits<{
  close: []
  confirm: []
}>()

const BUTTON = 'flex h-[52px] w-full items-center justify-center gap-2 rounded-full font-headline text-[15px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime'
</script>

<template>
  <BaseOverlayFrame
    :open="open"
    placement="bottom"
    size="auto"
    backdrop="translucent"
    draggable
    :close-button="false"
    :close-on-backdrop="phase !== 'booking'"
    panel-class="!rounded-t-3xl !bg-surface-container-lowest"
    ariaLabel="Book a day off"
    @close="emit('close')"
  >
    <div class="px-4 pb-[max(24px,env(safe-area-inset-bottom))]">
      <template v-if="phase === 'confirm' || phase === 'booking'">
        <p class="font-label text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary-container">Book a day off</p>
        <h2 class="mt-0.5 font-headline text-[22px] font-extrabold leading-[1.25] tracking-[-0.03em]">{{ dateLabel }}</h2>
        <p class="mt-0.5 text-[12.5px] text-on-surface-variant">Nobody else is off that day. Week of {{ weekRange }}.</p>
        <ul class="mb-4 mt-3.5 flex flex-col gap-2">
          <li class="flex items-start gap-2.5 text-[13px] leading-[1.4]">
            <span class="material-symbols-outlined mt-px text-lg text-primary" aria-hidden="true">looks_one</span>
            <span>This is your one day off for the week.</span>
          </li>
          <li class="flex items-start gap-2.5 text-[13px] leading-[1.4]">
            <span class="material-symbols-outlined mt-px text-lg text-primary" aria-hidden="true">lock</span>
            <span>You can't cancel or change it yourself. Only an admin can.</span>
          </li>
        </ul>
        <button type="button" :class="[BUTTON, 'bg-primary text-on-primary disabled:opacity-75']" :disabled="phase === 'booking'" @click="emit('confirm')">
          <template v-if="phase === 'booking'">
            <span class="h-[18px] w-[18px] animate-spin rounded-full border-[2.5px] border-on-primary/35 border-t-on-primary" aria-hidden="true" />Booking…
          </template>
          <template v-else>Book {{ dateLabel }} off</template>
        </button>
        <button type="button" :class="[BUTTON, 'mt-2 border-2 border-primary bg-surface-container-lowest text-primary disabled:opacity-75']" :disabled="phase === 'booking'" @click="emit('close')">Not now</button>
      </template>

      <template v-else-if="phase === 'success'">
        <div class="mb-2.5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lime">
          <span class="material-symbols-outlined text-[30px] [font-variation-settings:'FILL'_1,'wght'_600]" aria-hidden="true">check</span>
        </div>
        <h2 class="font-headline text-[22px] font-extrabold leading-[1.25] tracking-[-0.03em]">{{ dateLabel }} is yours</h2>
        <p class="mt-0.5 text-[12.5px] text-on-surface-variant">Booked. Your other days that week are now locked.</p>
        <ul class="mb-4 mt-3.5 flex flex-col gap-2">
          <li class="flex items-start gap-2.5 text-[13px] leading-[1.4]">
            <span class="material-symbols-outlined mt-px text-lg text-primary" aria-hidden="true">support_agent</span>
            <span>Need to change it? Ask an admin.</span>
          </li>
        </ul>
        <button type="button" :class="[BUTTON, 'bg-primary text-on-primary']" @click="emit('close')">Done</button>
      </template>

      <template v-else>
        <div class="mb-2.5 flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-on-error-container">
          <span class="material-symbols-outlined text-[30px]" aria-hidden="true">event_busy</span>
        </div>
        <h2 class="font-headline text-[22px] font-extrabold leading-[1.25] tracking-[-0.03em]">{{ failureTitle }}</h2>
        <p role="alert" class="mb-4 mt-3 rounded-xl bg-error-container px-3.5 py-3 text-sm font-bold leading-[1.35] text-on-error-container">{{ failureMessage }}</p>
        <button type="button" :class="[BUTTON, 'bg-primary text-on-primary']" @click="emit('close')">Pick another day</button>
      </template>
    </div>
  </BaseOverlayFrame>
</template>
