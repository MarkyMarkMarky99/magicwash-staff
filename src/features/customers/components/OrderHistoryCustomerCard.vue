<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSelectedCustomerStore } from '@/shared/stores/selected-customer.store'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import type { CustomerDetailDto } from '../services/customer.service'

import type { BadgeTone } from '@/shared/components/BaseBadge.vue'

defineProps<{
  customer: CustomerDetailDto
}>()

const TYPE_TONES: Record<string, BadgeTone> = {
  Regular: 'neutral',
  Member: 'info',
  Corporate: 'warning',
}

const router = useRouter()
const selectedCustomerStore = useSelectedCustomerStore()

function openNewBooking(customer: CustomerDetailDto) {
  selectedCustomerStore.select(customer)
  router.push('/new-booking')
}
</script>

<template>
  <section class="bg-surface-container-lowest px-4 py-4 shadow-sm">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary" aria-hidden="true">person</span>
          <h2 class="truncate font-headline text-lg font-bold text-primary">
            {{ customer.customerName || '—' }}
          </h2>
          <BaseBadge
            v-if="customer.customerType"
            :label="customer.customerType"
            size="md"
            :uppercase="true"
            :tone="TYPE_TONES[customer.customerType] || 'neutral'"
          />
        </div>

        <p v-if="customer.phone" class="mt-2 text-sm text-on-surface-variant">
          <span class="material-symbols-outlined mr-1 align-middle text-[15px]" aria-hidden="true">phone</span>
          {{ customer.phone }}
        </p>
        <p v-if="customer.address" class="mt-1 text-sm text-on-surface-variant">
          <span class="material-symbols-outlined mr-1 align-middle text-[15px]" aria-hidden="true">location_on</span>
          {{ customer.address }}
        </p>
      </div>

      <button
        type="button"
        class="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary shadow-sm transition hover:opacity-90"
        @click="openNewBooking(customer)"
      >
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">calendar_add_on</span>
        Schedule Pickup
      </button>
    </div>
  </section>
</template>
