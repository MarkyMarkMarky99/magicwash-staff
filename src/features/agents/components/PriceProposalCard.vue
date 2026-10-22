<script setup lang="ts">
import type { PriceProposal } from '../agent-chat.types'
import AgentCardFrame from './AgentCardFrame.vue'

defineProps<{ proposal: PriceProposal }>()

function formatPrice(price: number): string {
  return `฿${price.toLocaleString('en-US')}`
}

const SERVICE_LABELS: Record<string, string> = { WSIR: 'Wash Iron', WASH: 'Wash', DRCL: 'Dry Clean', IRON: 'Iron' }
const UNIT_LABELS: Record<string, string> = { piece: '(pc)', set: '(set)', pair: '(pr)' }

// DEFAULT is the standard price, so only a corporate price group is worth naming.
function rowDetail(row: PriceProposal['rows'][number]): string {
  const parts = [SERVICE_LABELS[row.serviceType] ?? row.serviceType]
  if (row.priceGroup !== 'DEFAULT') parts.push(row.priceGroup)
  if (row.unit) parts.push(UNIT_LABELS[row.unit] ?? `(${row.unit})`)
  return parts.filter(Boolean).join(' · ')
}
</script>

<template>
  <AgentCardFrame title="Price">
    <table class="w-full border-collapse font-body text-[13px]">
      <thead>
        <tr class="border-b border-dashed border-outline-variant">
          <th class="pb-1.5 text-left font-label text-[10px] font-extrabold uppercase tracking-[0.06em] text-on-surface-variant">Item</th>
          <th class="pb-1.5 text-right font-label text-[10px] font-extrabold uppercase tracking-[0.06em] text-on-surface-variant">Price</th>
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
