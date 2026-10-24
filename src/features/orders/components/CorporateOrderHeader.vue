<script setup lang="ts">
import { computed } from 'vue'
import CustomerTabCard from '@/shared/components/CustomerTabCard.vue'
import FormPageHeader from '@/shared/components/FormPageHeader.vue'
import { dueStubLabel, receivedLabel, turnaround } from '@/features/orders/utils/corporate-order-draft'

const props = defineProps<{
  customerName: string | null
  customerSub: string | null
  loading: boolean
  problem: string | null
  receivedDate: string
  dueDate: string
}>()
const emit = defineEmits<{
  close: []
  'update:receivedDate': [value: string]
  'update:dueDate': [value: string]
}>()

const due = computed(() => dueStubLabel(props.dueDate))
const turn = computed(() => turnaround(props.receivedDate, props.dueDate))

function openPicker(event: Event): void {
  try {
    (event.target as HTMLInputElement).showPicker()
  } catch {
    // The native control still opens on a direct tap when showPicker is unavailable.
  }
}
</script>

<template>
  <FormPageHeader eyebrow="New laundry intake" title="New order" @close="emit('close')">
    <CustomerTabCard
      :customer-name="customerName"
      :customer-sub="customerSub"
      :loading="loading"
      :problem="problem"
      :invalid="!turn.valid"
    >
      <label class="rec">
        Received <b>{{ receivedLabel(receivedDate) }}</b> · <span class="turn">{{ turn.label }}</span>
        <input class="ghost" type="date" aria-label="Received date" :value="receivedDate" @click="openPicker" @input="emit('update:receivedDate', ($event.target as HTMLInputElement).value)">
      </label>
      <template #aside>
        <label class="tile">
          <span class="tile__key">Due</span>
          <span class="tile__day">{{ due.day }}</span>
          <span class="tile__month">{{ due.month }}</span>
          <input class="ghost" type="date" aria-label="Due date" :value="dueDate" @click="openPicker" @input="emit('update:dueDate', ($event.target as HTMLInputElement).value)">
        </label>
      </template>
    </CustomerTabCard>
  </FormPageHeader>
</template>

<style scoped>
.rec {
  position: relative;
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  margin-top: auto;
  padding-top: 8px;
  color: var(--color-on-surface-variant);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
}

.rec b {
  border-bottom: 1px dashed var(--color-on-surface-variant);
  color: var(--color-primary);
  font-weight: 800;
}

.turn {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px 3px;
  border-radius: 999px;
  background: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.tile {
  position: relative;
  display: flex;
  flex: none;
  flex-direction: column;
  width: 82px;
  overflow: hidden;
  border: 2px solid var(--color-primary);
  border-radius: 11px 13px 11px 12px;
  background: white;
  color: var(--color-primary);
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  cursor: pointer;
  transform: rotate(2deg);
}

.tile__key {
  padding: 3px 0 4px;
  background: var(--color-primary);
  color: white;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: .16em;
  line-height: 1;
  text-align: center;
  text-transform: uppercase;
}

.tile__day {
  padding-top: 4px;
  font-size: 40px;
  font-weight: 800;
  line-height: 1;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.tile__month {
  padding: 3px 0 7px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .06em;
  line-height: 1;
  text-align: center;
  text-transform: uppercase;
}

.ghost {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  opacity: 0;
  cursor: pointer;
}

.rec:has(.ghost:focus-visible),
.tile:has(.ghost:focus-visible) {
  outline: 2px solid var(--color-lime);
  outline-offset: 2px;
}

.cust--bad .turn,
.cust--bad .tile {
  background: var(--color-warning-container);
  color: var(--color-on-warning-container);
}

.cust--bad .tile__key {
  background: var(--color-warning);
  color: white;
}
</style>
