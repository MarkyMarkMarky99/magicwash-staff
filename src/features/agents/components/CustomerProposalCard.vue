<script setup lang="ts">
import { computed } from 'vue'
import type { AgentWarning, CustomerProposal } from '../agent-chat.types'
import AgentCardFrame from './AgentCardFrame.vue'

const props = defineProps<{ proposal: CustomerProposal; warnings: AgentWarning[] }>()
defineEmits<{ open: []; edit: [] }>()

const fields = computed(() => [
  { label: 'ชื่อ', value: props.proposal.customerName },
  { label: 'เบอร์โทร', value: props.proposal.phone },
  { label: 'ที่อยู่', value: props.proposal.address },
  { label: 'LINE', value: props.proposal.lineId },
  { label: 'Facebook', value: props.proposal.facebook },
  { label: 'WhatsApp', value: props.proposal.whatsapp },
  { label: 'อีเมล', value: props.proposal.email },
  { label: 'ประเภท', value: props.proposal.customerType },
].filter(field => field.value))
</script>

<template>
  <AgentCardFrame title="ลูกค้าใหม่ (ร่าง)" tone="warning">
    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 font-body text-[13.5px] leading-snug">
      <template v-for="field in fields" :key="field.label">
        <dt class="pt-1 font-label text-[10px] font-extrabold uppercase tracking-[0.06em] text-on-surface-variant">{{ field.label }}</dt>
        <dd class="break-words font-bold text-primary">{{ field.value }}</dd>
      </template>
    </dl>
    <p v-for="warning in warnings" :key="`${warning.field}-${warning.message}`" class="mt-2.5 flex items-start gap-1.5 font-body text-xs font-bold leading-snug text-warning">
      <span class="material-symbols-outlined mt-px text-[16px]" aria-hidden="true">warning</span>
      <span>{{ warning.message }}</span>
    </p>
    <div class="mt-3 grid gap-2">
      <button type="button" class="flex h-[46px] items-center justify-center gap-1.5 rounded-full bg-primary px-4 font-body text-sm font-extrabold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" @click="$emit('open')">
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">person_add</span>เปิดฟอร์มลูกค้า
      </button>
      <button type="button" class="flex h-[46px] items-center justify-center gap-1.5 rounded-full border-[1.5px] border-outline-variant bg-white px-4 font-body text-sm font-extrabold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" @click="$emit('edit')">
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">edit</span>แก้ไขต่อในแชต
      </button>
    </div>
  </AgentCardFrame>
</template>
