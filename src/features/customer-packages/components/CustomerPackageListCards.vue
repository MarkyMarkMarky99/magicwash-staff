<script setup lang="ts">
import type { z } from 'zod'
import { customerPackageListResponseSchema } from '@contracts/customer-packages/customer-package-api.schema'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import BaseRowCard from '@/shared/components/BaseRowCard.vue'
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
      <BaseSwipeCard
        :swipeable="false"
        :pressable="true"
        @tap="emit('select', item)"
      >
        <BaseRowCard
          :line1="item.customerName"
          :line2="`${item.packageName} · ${item.packageCode}`"
          density="roomy"
        >
          <template #top-end>
            <BaseBadge :label="item.status" size="md" :tone="STATUS_TONES[item.status] || 'neutral'" />
          </template>
          <template #line3>
            <span class="font-semibold text-primary">{{ item.remainingCredit }}</span> remaining · {{ item.usedCredit }} used · {{ item.totalCredit }} total
          </template>
        </BaseRowCard>
      </BaseSwipeCard>
    </li>
  </ul>
</template>
