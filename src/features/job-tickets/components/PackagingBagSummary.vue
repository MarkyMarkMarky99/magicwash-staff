<script setup lang="ts">
import { computed } from 'vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'

const props = defineProps<{
  customerIndex: string
  customerName: string
  orderId: string
  statusLabel: string
  total: number
  packed: number
  pending: number
  bagCount: number
  newBagCount: number
}>()

const left = computed(() => props.total - props.packed - props.pending)
const done = computed(() => props.packed === props.total)
</script>

<template>
  <section class="relative mx-3 mt-4 overflow-hidden rounded-[20px] border bg-primary text-on-primary shadow-lg" :class="done ? 'border-lime/60' : 'border-lime/25'">
    <div class="pointer-events-none absolute -right-[138px] -top-[112px] h-[270px] w-[270px] rounded-full border-[34px] border-lime/[0.17]" />
    <div class="pointer-events-none absolute -bottom-[21px] right-[38px] h-[42px] w-[42px] rounded-full bg-lime shadow-[-22px_-11px_0_color-mix(in_srgb,_var(--color-lime)_22%,_transparent)]" />
    <div class="relative px-5 pb-3 pt-4">
      <div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4">
        <p class="min-w-0 truncate font-label text-[9px] font-bold uppercase tracking-[0.18em] text-lime">Customer · {{ customerIndex }}</p>
        <p class="text-right font-label text-[9px] font-bold uppercase tracking-[0.18em] text-lime">Bags created</p>
        <h1 class="mt-0.5 min-w-0 truncate font-headline text-[26px] font-bold leading-8 tracking-tight">{{ customerName }}</h1>
        <p class="mt-0.5 text-right font-headline text-[30px] font-extrabold leading-8 tracking-tight text-lime">{{ bagCount }}</p>
        <p class="mt-1 min-w-0 truncate font-body text-xs font-semibold text-on-primary/80">Order {{ orderId }}</p>
        <p class="mt-1 text-right font-body text-xs font-semibold text-on-primary/80">{{ bagCount === 1 ? 'bag' : 'bags' }}<template v-if="newBagCount"> · {{ newBagCount }} new</template></p>
      </div>
    </div>
    <div class="relative mx-5 border-t border-white/15 pb-6 pt-3">
      <div class="flex items-end justify-between gap-3">
        <p class="font-label text-[9px] font-bold uppercase tracking-[0.14em] text-lime">Garments packed</p>
        <BaseBadge :label="statusLabel" tone="info" size="lg" />
      </div>
      <p class="mt-1 flex items-baseline gap-0.5 font-headline">
        <span class="font-[Manrope,sans-serif] text-[40px] font-extrabold leading-[44px] tracking-[-0.04em] tabular-nums" :class="done ? 'text-lime' : ''">{{ packed }}</span>
        <span class="font-[Manrope,sans-serif] text-[22px] font-bold tracking-[-0.03em] text-on-primary/60 tabular-nums"> / {{ total }}</span>
      </p>
      <div class="mt-2 flex h-1.5 gap-[3px] rounded-full" role="progressbar" aria-label="Garments packed" :aria-valuemin="0" :aria-valuemax="total" :aria-valuenow="packed">
        <div v-for="index in total" :key="index" class="h-full flex-1 rounded-full" :class="index <= packed ? 'bg-lime' : index <= packed + pending ? 'bg-lime/40' : 'bg-white/20'" />
      </div>
      <p v-if="done" class="mt-2 flex items-center gap-1.5 font-body text-xs font-extrabold text-lime">
        <span class="grid h-[18px] w-[18px] place-items-center rounded-full bg-lime text-primary"><span class="material-symbols-outlined" style="font-size: 13px; font-variation-settings: 'wght' 700" aria-hidden="true">check</span></span>All garments packed
      </p>
      <p v-else class="mt-2 font-body text-xs font-semibold text-on-primary/80"><span class="font-extrabold text-on-primary">{{ left }}</span> {{ left === 1 ? 'garment' : 'garments' }} left to pack<template v-if="pending > 0"> · {{ pending }} in new {{ newBagCount === 1 ? 'bag' : 'bags' }}</template></p>
    </div>
  </section>
</template>
