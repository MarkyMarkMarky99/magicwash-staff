<script setup lang="ts">
import type { PriceProposal } from '../agent-chat.types'
import AgentCardFrame from './AgentCardFrame.vue'

defineProps<{ proposal: PriceProposal }>()

function formatPrice(price: number): string {
  return `฿${price.toLocaleString('en-US')}`
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
            <span class="block text-[11px] font-medium text-on-surface-variant">{{ row.serviceType }} · {{ row.priceGroup }} · ต่อ{{ row.unit ?? '' }}</span>
          </td>
          <td class="whitespace-nowrap py-2 text-right text-sm font-extrabold text-primary">{{ formatPrice(row.price) }}</td>
        </tr>
      </tbody>
    </table>
  </AgentCardFrame>
</template>
