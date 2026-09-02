<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSelectedCustomerStore } from '@/shared/stores/selected-customer.store'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import CardLeadingIcon from '@/shared/components/CardLeadingIcon.vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import type { CustomerListDto } from '../services/customer.service'

type BadgeTone = 'neutral' | 'brand' | 'accent' | 'info' | 'warning' | 'success' | 'danger'

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
const selectedCustomerStore = useSelectedCustomerStore()

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

// One of three writers of the shared selected-customer store (see its doc
// comment): stash the full DTO so the booking form can read
// customerId/customerName/address, then hand off.
function openNewBooking() {
  selectedCustomerStore.select(props.customer)
  router.push('/new-booking')
}

function openOrderHistory() {
  router.push(`/customers/${encodeURIComponent(props.customer.customerId)}/orders`)
}
</script>

<template>
  <BaseSwipeCard ref="baseRef" @tap="openOrderHistory" @swipe-right="onSwipeRight">
    <!-- Left panel: action buttons -->
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

    <!-- Card content -->
    <div class="px-4 py-3 flex gap-3">
      <CardLeadingIcon icon="person" label="Customer" />

      <!-- Info -->
      <div class="flex-grow min-w-0 flex flex-col justify-center">
        <!-- Row 1: name + type badge -->
        <div class="flex items-center gap-1.5 mb-0.5 min-w-0">
          <h3 class="font-headline font-bold text-primary text-[14px] leading-tight truncate">
            {{ customer.customerName || '—' }}{{ customer.customerIndex ? ` (${customer.customerIndex})` : '' }}
          </h3>
          <BaseBadge
            v-if="customer.customerType"
            :label="customer.customerType"
            size="xs"
            :uppercase="true"
            :tone="TYPE_TONES[customer.customerType] || 'neutral'"
          />
        </div>

        <!-- Row 2: phone -->
        <div v-if="customer.phone" class="flex items-center gap-1 min-w-0">
          <span class="material-symbols-outlined text-[14px] text-on-surface-variant shrink-0">phone</span>
          <p class="font-body text-xs text-on-surface-variant truncate">{{ customer.phone }}</p>
        </div>

        <!-- Row 3: address -->
        <div v-if="customer.address" class="flex items-center gap-1 min-w-0">
          <span class="material-symbols-outlined text-[14px] text-on-surface-variant shrink-0">location_on</span>
          <p class="font-body text-xs text-on-surface-variant truncate">{{ customer.address }}</p>
        </div>
      </div>
    </div>
  </BaseSwipeCard>
</template>
