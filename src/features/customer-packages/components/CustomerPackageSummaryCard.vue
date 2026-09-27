<script setup lang="ts">
import { computed } from 'vue'
import type { z } from 'zod'
import { customerPackageDetailResponseSchema } from '@contracts/customer-packages/customer-package-api.schema'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import type { BadgeTone, BadgeVariant } from '@/shared/components/BaseBadge.vue'
import { formatSheetDate, normalizeSheetDate, sheetDateDaysBetween, todaySheetDate } from '@/shared/utils/sheet-date'

type CustomerPackageDetail = z.infer<typeof customerPackageDetailResponseSchema>

const props = defineProps<{
  customerPackage: CustomerPackageDetail
  customerIndex?: string | null
}>()

// Share of total credit at or below which an active package is flagged as low.
const LOW_CREDIT_RATIO = 0.2

const creditBalancePercent = computed(() => {
  const { remainingCredit, totalCredit } = props.customerPackage
  if (!Number.isFinite(totalCredit) || totalCredit <= 0) return 0

  return Math.min(100, Math.max(0, Math.round((remainingCredit / totalCredit) * 100)))
})
const customerLabel = computed(() => {
  const index = props.customerIndex?.trim()
  return index ? `Customer · ${index}` : 'Customer'
})
const expiry = computed(() => {
  const end = normalizeSheetDate(props.customerPackage.expiryDate)
  const days = end ? sheetDateDaysBetween(end, todaySheetDate()) : null
  if (days === null) return { label: 'Expires', value: '—', unit: 'No date', expired: false }
  if (days > 0) return { label: 'Expires in', value: String(days), unit: days === 1 ? 'day' : 'days', expired: false }
  if (days === 0) return { label: 'Expires', value: 'Today', unit: '', expired: false }
  return { label: 'Expired', value: String(-days), unit: -days === 1 ? 'day ago' : 'days ago', expired: true }
})
const statusBadge = computed<{ label: string, tone: BadgeTone, variant: BadgeVariant }>(() => {
  const { status, remainingCredit, totalCredit } = props.customerPackage
  if (status === 'EXPIRED') return { label: 'Expired', tone: 'danger', variant: 'solid' }
  if (status === 'CANCELLED') return { label: 'Cancelled', tone: 'danger', variant: 'soft' }
  if (status === 'INACTIVE') return { label: 'Inactive', tone: 'neutral', variant: 'soft' }
  if (totalCredit > 0 && remainingCredit <= totalCredit * LOW_CREDIT_RATIO) return { label: 'Low credit', tone: 'warning', variant: 'soft' }
  return { label: 'Active', tone: 'lime', variant: 'soft' }
})
const pickupWindow = computed(() => {
  const { serviceDay, timeSlot } = props.customerPackage
  return `${serviceDay?.trim() || 'Flexible'} · ${timeSlot?.trim() || 'By appointment'}`
})
</script>

<template>
  <section class="relative mx-3 overflow-hidden rounded-[20px] border border-lime/25 bg-primary text-on-primary shadow-lg">
    <div class="pointer-events-none absolute -right-[138px] -top-[112px] h-[270px] w-[270px] rounded-full border-[34px] border-lime/[0.17]" />
    <div class="pointer-events-none absolute -bottom-[21px] right-[38px] h-[42px] w-[42px] rounded-full bg-lime shadow-[-22px_-11px_0_color-mix(in_srgb,_var(--color-lime)_22%,_transparent)]" />

    <div class="relative px-5 pb-3 pt-4">
      <div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4">
        <p class="min-w-0 truncate font-label text-[9px] font-bold uppercase tracking-[0.18em] text-lime">{{ customerLabel }}</p>
        <p class="text-right font-label text-[9px] font-bold uppercase tracking-[0.18em] text-lime">{{ expiry.label }}</p>
        <h2 class="mt-0.5 min-w-0 truncate font-headline text-[26px] font-bold leading-8 tracking-tight">{{ props.customerPackage.customerName }}</h2>
        <p class="mt-0.5 text-right font-headline text-[30px] font-extrabold leading-8 tracking-tight" :class="expiry.expired ? 'text-error-container' : 'text-lime'">{{ expiry.value }}</p>
        <p class="mt-1 min-w-0 truncate font-body text-xs font-semibold text-on-primary/80">{{ props.customerPackage.packageName }}</p>
        <p class="mt-1 text-right font-body text-xs font-semibold text-on-primary/80">{{ expiry.unit }}</p>
      </div>
    </div>

    <div class="relative mx-5 border-t border-white/15 pb-4 pt-3">
      <div class="flex items-end justify-between gap-3">
        <p class="font-label text-[9px] font-bold uppercase tracking-[0.14em] text-lime">Credits</p>
        <BaseBadge :label="statusBadge.label" size="lg" :tone="statusBadge.tone" :variant="statusBadge.variant" />
      </div>
      <div class="relative mt-2 h-1.5 rounded-full bg-white/20" role="progressbar" aria-label="Package credit balance" :aria-valuemin="0" :aria-valuemax="100" :aria-valuenow="creditBalancePercent">
        <div class="h-full rounded-full bg-lime transition-[width] duration-300 motion-reduce:transition-none" :style="{ width: `${creditBalancePercent}%` }" />
        <span class="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-lime bg-primary" :style="{ left: `${creditBalancePercent}%` }" />
      </div>
      <p class="mt-2 font-body text-xs font-semibold text-on-primary/80"><span class="font-extrabold text-on-primary">{{ props.customerPackage.remainingCredit }}</span> remaining of {{ props.customerPackage.totalCredit }}</p>

      <div class="mt-3 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="font-label text-[9px] font-bold uppercase tracking-wider text-lime">Valid until</p>
          <p class="mt-0.5 font-headline text-[13px] font-bold">{{ formatSheetDate(props.customerPackage.expiryDate) }}</p>
        </div>
        <div class="min-w-0 text-right">
          <p class="font-label text-[9px] font-bold uppercase tracking-wider text-lime">Pickup window</p>
          <p class="mt-0.5 truncate font-headline text-[13px] font-bold" :title="pickupWindow">{{ pickupWindow }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
