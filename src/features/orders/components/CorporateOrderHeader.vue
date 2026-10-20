<script setup lang="ts">
import { computed } from 'vue'
import CloseButton from '@/shared/components/CloseButton.vue'
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
  <header class="hdr">
    <div class="relative z-[1] flex items-start justify-between">
      <div>
        <p class="font-label text-[10px] font-extrabold uppercase tracking-[0.12em] text-secondary-container">New laundry intake</p>
        <h1 class="font-headline text-[23px] font-extrabold leading-[1.2] tracking-[-0.03em]">New order</h1>
      </div>
      <CloseButton tone="onDark" @click="emit('close')" />
    </div>
    <div class="cust" :class="{ 'cust--bad': !turn.valid }">
      <span class="cust__tab">Customer</span>
      <div class="flex min-w-0 flex-1 flex-col self-stretch">
        <template v-if="customerName">
          <p class="text-sm font-extrabold leading-tight text-primary">{{ customerName }}</p>
          <p v-if="customerSub" class="mt-px text-[11px] text-on-surface-variant">{{ customerSub }}</p>
        </template>
        <template v-else-if="loading">
          <div class="h-4 w-40 animate-pulse rounded bg-surface-container" />
          <div class="mt-1.5 h-3 w-24 animate-pulse rounded bg-surface-container" />
        </template>
        <p v-else class="text-sm font-extrabold leading-tight text-error" role="alert">{{ problem }}</p>
        <label class="rec">
          Received <b>{{ receivedLabel(receivedDate) }}</b> · <span class="turn">{{ turn.label }}</span>
          <input class="ghost" type="date" aria-label="Received date" :value="receivedDate" @click="openPicker" @input="emit('update:receivedDate', ($event.target as HTMLInputElement).value)">
        </label>
      </div>
      <label class="tile">
        <span class="tile__key">Due</span>
        <span class="tile__day">{{ due.day }}</span>
        <span class="tile__month">{{ due.month }}</span>
        <input class="ghost" type="date" aria-label="Due date" :value="dueDate" @click="openPicker" @input="emit('update:dueDate', ($event.target as HTMLInputElement).value)">
      </label>
    </div>
  </header>
</template>

<style scoped>
.hdr {
  position: relative;
  flex: none;
  padding: calc(16px + env(safe-area-inset-top)) 16px 36px;
  background: var(--color-primary);
  color: white;
  overflow: hidden;
}

.hdr::before {
  position: absolute;
  top: -100px;
  right: -130px;
  width: 250px;
  height: 250px;
  border: 32px solid color-mix(in srgb, var(--color-lime) 17%, transparent);
  border-radius: 50%;
  content: '';
}

.hdr::after {
  position: absolute;
  right: 30px;
  bottom: -14px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--color-lime);
  box-shadow: -22px -11px 0 color-mix(in srgb, var(--color-lime) 22%, transparent);
  content: '';
}

.cust {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: stretch;
  gap: 10px;
  margin-top: 22px;
  padding: 15px 10px 10px 12px;
  border: 2px solid var(--color-primary);
  border-radius: 11px 15px 12px 14px;
  background: white;
  color: var(--color-on-surface);
  box-shadow: 4px 4px 0 color-mix(in srgb, black 35%, transparent);
}

.cust__tab {
  position: absolute;
  top: -11px;
  left: 10px;
  z-index: 2;
  padding: 3px 9px 4px;
  border-radius: 6px 8px 6px 7px;
  background: var(--color-lime);
  color: var(--color-primary);
  box-shadow: 1px 1px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.1;
  transform: rotate(-3deg);
  pointer-events: none;
}

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
