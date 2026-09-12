<script setup lang="ts">
import { computed } from 'vue'
import type { z } from 'zod'
import { customerPackageDetailResponseSchema } from '@contracts/customer-packages/customer-package-api.schema'
import { formatSheetDate } from '@/shared/utils/sheet-date'

type CustomerPackageDetail = z.infer<typeof customerPackageDetailResponseSchema>

const props = defineProps<{
  customerPackage: CustomerPackageDetail
}>()

const creditBalancePercent = computed(() => {
  const { remainingCredit, totalCredit } = props.customerPackage
  if (!Number.isFinite(totalCredit) || totalCredit <= 0) return 0

  return Math.min(100, Math.max(0, Math.round((remainingCredit / totalCredit) * 100)))
})
const pickupWindow = computed(() => {
  const { serviceDay, timeSlot } = props.customerPackage
  return `${serviceDay?.trim() || 'Flexible'} · ${timeSlot?.trim() || 'By appointment'}`
})
const eligibleServiceLabel = computed(() => {
  return props.customerPackage.packageEligibleService.trim().replace(/_/g, ' ') || '—'
})
</script>

<template>
  <section class="mx-3 rounded-[20px] bg-primary px-5 py-5 text-on-primary shadow-md">
    <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
      <p class="min-w-0 truncate font-label text-[11px] font-bold uppercase tracking-[0.18em] text-on-primary/70">Package detail</p>
      <p class="shrink-0 text-right font-label text-[11px] font-bold uppercase tracking-[0.18em] text-on-primary/70">Credits remaining</p>
      <h2 class="mt-2 min-w-0 truncate self-center font-headline text-2xl font-extrabold leading-tight tracking-tight">{{ props.customerPackage.packageName }}</h2>
      <p class="mt-2 shrink-0 self-center text-right font-headline text-[26px] font-extrabold leading-none text-secondary-container">{{ props.customerPackage.remainingCredit }}</p>
      <p class="mt-2 min-w-0 truncate font-body text-sm leading-tight text-on-primary/75">{{ props.customerPackage.packageCode }} · {{ eligibleServiceLabel }}</p>
      <p class="mt-2 shrink-0 text-right font-body text-sm leading-tight text-on-primary/75">of {{ props.customerPackage.totalCredit }} included</p>
    </div>

    <div class="mt-6">
      <div class="h-2.5 overflow-hidden rounded-full bg-on-surface/45" role="progressbar" aria-label="Package credit balance" :aria-valuemin="0" :aria-valuemax="100" :aria-valuenow="creditBalancePercent">
        <div class="h-full rounded-full bg-secondary-container transition-[width] duration-300 motion-reduce:transition-none" :style="{ width: `${creditBalancePercent}%` }" />
      </div>
      <p class="mt-3 font-body text-sm text-on-primary/85">{{ creditBalancePercent }}% balance</p>
    </div>

    <div class="mt-6 grid grid-cols-2 gap-4 border-t border-on-primary/20 pt-5">
      <div class="min-w-0">
        <p class="font-label text-[10px] font-bold uppercase tracking-[0.12em] text-on-primary/65">Valid until</p>
        <p class="mt-1 font-headline text-[15px] font-bold leading-tight">{{ formatSheetDate(props.customerPackage.expiryDate) }}</p>
      </div>
      <div class="min-w-0">
        <p class="font-label text-[10px] font-bold uppercase tracking-[0.12em] text-on-primary/65">Pickup window</p>
        <p class="mt-1 truncate font-headline text-[15px] font-bold leading-tight" :title="pickupWindow">{{ pickupWindow }}</p>
      </div>
    </div>
  </section>
</template>
