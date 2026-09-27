<script setup lang="ts">
import BaseBadge from '@/shared/components/BaseBadge.vue'
import type { CustomerDetailDto } from '@/data/customers/customer.service'

import type { BadgeTone } from '@/shared/components/BaseBadge.vue'

defineProps<{
  customer: CustomerDetailDto
}>()

const TYPE_TONES: Record<string, BadgeTone> = {
  Regular: 'neutral',
  Member: 'info',
  Corporate: 'warning',
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
            size="lg"
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

    </div>
  </section>
</template>
