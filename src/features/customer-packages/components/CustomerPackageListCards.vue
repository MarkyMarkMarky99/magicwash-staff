<script setup lang="ts">
import type { z } from 'zod'
import { customerPackageListResponseSchema } from '@contracts/customer-packages/customer-package-api.schema'
import BaseBadge from '@/shared/components/BaseBadge.vue'
type CustomerPackageListItem = z.infer<typeof customerPackageListResponseSchema>
import type { BadgeTone } from '@/shared/components/BaseBadge.vue'
defineProps<{ items: CustomerPackageListItem[] }>()
const emit = defineEmits<{ select: [CustomerPackageListItem] }>()
const STATUS_TONES: Record<string, BadgeTone> = {
  ACTIVE: 'accent',
  INACTIVE: 'neutral',
  EXPIRED: 'accent',
  CANCELLED: 'danger',
}
</script>

<template>
  <ul class="divide-y divide-outline-variant/20">
    <li v-for="item in items" :key="item.customerPackageId">
      <button type="button" class="w-full px-4 py-4 text-left" @click="emit('select', item)">
        <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="truncate font-headline text-sm font-bold text-on-surface">{{ item.customerName }}</p><p class="truncate font-body text-xs text-on-surface-variant">{{ item.packageName }} · {{ item.packageCode }}</p></div><BaseBadge :label="item.status" size="md" :tone="STATUS_TONES[item.status] || 'neutral'" /></div>
        <p class="mt-2 font-body text-xs text-on-surface-variant"><span class="font-semibold text-primary">{{ item.remainingCredit }}</span> remaining · {{ item.usedCredit }} used · {{ item.totalCredit }} total</p>
      </button>
    </li>
  </ul>
</template>
