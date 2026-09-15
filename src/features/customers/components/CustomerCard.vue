<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { appointmentCreateRoute } from '@/shared/navigation/form-routes'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import BaseRowCard from '@/shared/components/BaseRowCard.vue'
import CardLeadingIcon from '@/shared/components/CardLeadingIcon.vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import type { CustomerListDto } from '@/data/customers/customer.service'

import type { BadgeTone } from '@/shared/components/BaseBadge.vue'

const props = defineProps<{
  customer: CustomerListDto
}>()

const TYPE_TONES: Record<string, BadgeTone> = {
  Regular: 'neutral',
  Member: 'info',
  Corporate: 'warning',
}

const baseRef = ref<InstanceType<typeof BaseSwipeCard> | null>(null)
const router = useRouter()

function onSwipeRight() {
  baseRef.value?.snapCard('none')
}

function callPhone(phone: string) {
  window.location.href = `tel:${phone}`
}

function openMaps(address: string) {
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`,
    '_blank',
  )
}

function openNewBooking() {
  router.push(appointmentCreateRoute({ customerId: props.customer.customerId }))
}

function openOrderHistory() {
  router.push({ name: 'customer-detail', params: { customerId: props.customer.customerId, tab: 'orders' } })
}
</script>

<template>
  <BaseSwipeCard
    ref="baseRef"
    :swipeable="true"
    :pressable="true"
    @tap="openOrderHistory"
    @swipe-right="onSwipeRight"
  >
    <template #left-panel>
      <div class="absolute inset-0 bg-primary flex items-center justify-end text-on-primary">
        <div class="flex items-center justify-evenly" style="width: var(--snap-left)">
          <button
            :disabled="!customer.phone"
            :class="['flex flex-col items-center gap-0.5 transition-all', customer.phone ? 'hover:scale-110' : 'opacity-30 cursor-not-allowed']"
            @click="customer.phone && callPhone(customer.phone)"
          >
            <span class="material-symbols-outlined text-[20px]">call</span>
            <span class="font-label text-[8px] font-bold uppercase">Call</span>
          </button>
          <button
            class="flex flex-col items-center gap-0.5 transition-all hover:scale-110"
            @click="openNewBooking"
          >
            <span class="material-symbols-outlined text-[20px]">calendar_add_on</span>
            <span class="font-label text-[8px] font-bold uppercase">Book</span>
          </button>
          <button
            :disabled="!customer.address"
            :class="['flex flex-col items-center gap-0.5 transition-all', customer.address ? 'hover:scale-110' : 'opacity-30 cursor-not-allowed']"
            @click="customer.address && openMaps(customer.address)"
          >
            <span class="material-symbols-outlined text-[20px]">near_me</span>
            <span class="font-label text-[8px] font-bold uppercase">Nav</span>
          </button>
        </div>
      </div>
    </template>

    <BaseRowCard :line1="customer.customerName || '—'">
      <template #lead>
        <CardLeadingIcon icon="person" label="Customer" />
      </template>
      <template #line1>
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate">
            {{ customer.customerName || '—' }}{{ customer.customerIndex ? ` (${customer.customerIndex})` : '' }}
          </span>
          <BaseBadge
            v-if="customer.customerType"
            :label="customer.customerType"
            size="xs"
            :uppercase="true"
            :tone="TYPE_TONES[customer.customerType] || 'neutral'"
          />
        </span>
      </template>
      <template v-if="customer.phone" #line2>
        <span class="flex min-w-0 items-center gap-1">
          <span class="material-symbols-outlined shrink-0 text-[14px] text-on-surface-variant">phone</span>
          <span class="truncate">{{ customer.phone }}</span>
        </span>
      </template>
      <template v-if="customer.address" #line3>
        <span class="flex min-w-0 items-center gap-1">
          <span class="material-symbols-outlined shrink-0 text-[14px] text-on-surface-variant">location_on</span>
          <span class="truncate">{{ customer.address }}</span>
        </span>
      </template>
    </BaseRowCard>
  </BaseSwipeCard>
</template>
