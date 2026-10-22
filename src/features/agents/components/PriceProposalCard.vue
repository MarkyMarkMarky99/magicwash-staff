<script setup lang="ts">
import type { PriceProposal } from '../agent-chat.types'
import AgentCardFrame from './AgentCardFrame.vue'
import { serviceTypeLabel } from '@/shared/utils/service-type-labels'

defineProps<{ proposal: PriceProposal }>()

function formatPrice(price: number): string {
  return `฿${price.toLocaleString('en-US')}`
}

const THAI_UNITS: Record<string, string> = { piece: 'ชิ้น', set: 'ชุด', pair: 'คู่' }

// DEFAULT is the standard price, so only a corporate price group is worth naming.
function rowDetail(row: PriceProposal['rows'][number]): string {
  const parts = [serviceTypeLabel(row.serviceType)]
  if (row.priceGroup !== 'DEFAULT') parts.push(row.priceGroup)
  if (row.unit) parts.push(`ต่อ${THAI_UNITS[row.unit] ?? row.unit}`)
  return parts.filter(Boolean).join(' · ')
}
</script>

<template>
  <AgentCardFrame title="ใบราคา">
    <table class="w-full border-collapse font-body text-[13px]">
      <thead>
        <tr class="border-b border-dashed border-outline-variant">
          <th class="pb-1.5 text-left font-label text-[10px] font-extrabold uppercase tracking-[0.06em] text-on-surface-variant">รายการ</th>
          <th class="pb-1.5 text-right font-label text-[10px] font-extrabold uppercase tracking-[0.06em] text-on-surface-variant">ราคา</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in proposal.rows" :key="row.itemCode" class="border-b border-dashed border-outline-variant last:border-b-0">
          <td class="py-2 font-semibold leading-snug">
            {{ row.name }}
            <span class="block text-[11px] font-medium text-on-surface-variant">{{ rowDetail(row) }}</span>
          </td>
          <td class="whitespace-nowrap py-2 text-right text-sm font-extrabold text-primary">{{ formatPrice(row.price) }}</td>
        </tr>
      </tbody>
    </table>
  </AgentCardFrame>
</template>
