<script setup lang="ts">
import { computed } from 'vue'
import { dueStubLabel, receivedLabel, turnaround } from '@/features/orders/utils/corporate-order-draft'

const props = defineProps<{
  receivedDate: string
  dueDate: string
  note: string
}>()

const emit = defineEmits<{
  'update:receivedDate': [value: string]
  'update:dueDate': [value: string]
  'update:note': [value: string]
}>()

const stub = computed(() => dueStubLabel(props.dueDate))
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
  <div class="tkt">
    <span class="tkt__tab">Order ticket</span>
    <div class="stub">
      <span class="stub__key">Due</span>
      <span class="stub__day">{{ stub.day }}</span>
      <span class="stub__month">{{ stub.month }}</span>
      <span class="material-symbols-outlined stub__pen" aria-hidden="true">edit_calendar</span>
      <input class="ghost" type="date" aria-label="Due date" :value="dueDate" @click="openPicker" @input="emit('update:dueDate', ($event.target as HTMLInputElement).value)">
    </div>
    <div class="dtl">
      <label class="rrow">
        <span class="key">Received</span>
        <span class="rrow__line">
          <b>{{ receivedLabel(receivedDate) }}<span class="material-symbols-outlined" aria-hidden="true">edit_calendar</span></b>
          <span class="turn" :class="{ 'turn--bad': !turn.valid }">{{ turn.label }}</span>
        </span>
        <input class="ghost" type="date" aria-label="Received date" :value="receivedDate" @click="openPicker" @input="emit('update:receivedDate', ($event.target as HTMLInputElement).value)">
      </label>
      <label class="fl">
        <span class="key">Note</span>
        <textarea class="line-in" placeholder="Anything the laundry team should know" :value="note" @input="emit('update:note', ($event.target as HTMLTextAreaElement).value)" />
      </label>
    </div>
  </div>
</template>

<style scoped>
.tkt {
  position: relative;
  display: grid;
  grid-template-columns: 106px minmax(0, 1fr);
  margin: 18px 4px 6px 2px;
  border: 2px solid var(--color-primary);
  border-radius: 11px 15px 12px 14px;
  background: white;
  box-shadow: 4px 4px 0 color-mix(in srgb, var(--color-primary) 70%, black);
}

.tkt__tab {
  position: absolute;
  top: -12px;
  left: 122px;
  z-index: 2;
  padding: 3px 9px 4px;
  border-radius: 6px 8px 6px 7px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: 1px 1px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.1;
  transform: rotate(-3deg);
  pointer-events: none;
}

.stub {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 14px 6px 12px;
  border-right: 2px dashed var(--color-primary);
  border-radius: 9px 0 0 12px;
  background: var(--color-lime);
  color: var(--color-primary);
}

.stub::before,
.stub::after {
  position: absolute;
  right: -10px;
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-primary);
  border-radius: 50%;
  background: var(--color-surface);
  content: '';
}

.stub::before {
  top: -11px;
  clip-path: inset(50% 0 0 0);
}

.stub::after {
  bottom: -11px;
  clip-path: inset(0 0 50% 0);
}

.stub__key {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.stub__day {
  font-size: 46px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.stub__month {
  font-size: 12px;
  font-weight: 800;
}

.stub__pen {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 14px;
  opacity: .55;
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

.stub:has(.ghost:focus-visible),
.rrow:has(.ghost:focus-visible) {
  outline: 2px solid var(--color-lime);
  outline-offset: 2px;
}

.dtl {
  min-width: 0;
  padding: 16px 12px 8px 14px;
}

.key {
  display: block;
  color: var(--color-on-surface-variant);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.rrow {
  position: relative;
  display: block;
  padding: 2px 0 8px;
  border-bottom: 1px dashed var(--color-outline-variant);
}

.rrow__line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 2px;
}

.rrow__line b {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-primary);
  font-size: 15px;
  font-weight: 800;
  white-space: nowrap;
}

.rrow__line b .material-symbols-outlined {
  color: var(--color-on-surface-variant);
  font-size: 14px;
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

.turn--bad {
  background: var(--color-warning-container);
  color: var(--color-on-warning-container);
}

.fl {
  display: block;
  padding: 8px 0 6px;
}

.line-in {
  display: block;
  width: 100%;
  height: 40px;
  padding: 2px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--color-on-surface);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.4;
  outline: 0;
  resize: none;
  scrollbar-width: none;
  transition: box-shadow 150ms;
}

.line-in:focus {
  box-shadow: 0 2px 0 var(--color-lime);
}

.line-in::placeholder {
  color: var(--color-on-surface-variant);
  font-weight: 500;
}

@media (prefers-reduced-motion: reduce) {
  .line-in {
    transition: none;
  }
}
</style>
