<script setup lang="ts">
/** Presentation only — props in, events out. */
import type { LineItemFormRow } from '../types/invoice-create.types'
import InvoiceLineCard from './InvoiceLineCard.vue'

const props = defineProps<{
  modelValue: LineItemFormRow[]
  /** Net total per line, computed by the page with the shared invoice calculator. */
  lineTotals: number[]
}>()

const emit = defineEmits<{
  'update:modelValue': [rows: LineItemFormRow[]]
  addLine: []
  pickFromPriceList: []
}>()

function updateLine(index: number, patch: Partial<LineItemFormRow>) {
  const next = props.modelValue.map((row, i) => (i === index ? { ...row, ...patch } : row))
  emit('update:modelValue', next)
}

function removeLine(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}
</script>

<template>
  <section aria-labelledby="invoice-lines-title">
    <header class="mb-2.5 flex items-center justify-between gap-3">
      <div class="border-l-4 border-lime pl-2.5">
        <h2 id="invoice-lines-title" class="font-headline text-[17px] font-extrabold tracking-[-0.03em] text-primary">Line items</h2>
        <p class="mt-[3px] font-label text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-on-surface-variant">
          {{ modelValue.length }} {{ modelValue.length === 1 ? 'item' : 'items' }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          class="min-h-[34px] rounded px-1 font-label text-[10px] font-extrabold uppercase tracking-[0.04em] text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-lime"
          @click="emit('pickFromPriceList')"
        >
          Price list
        </button>
        <button
          type="button"
          class="min-h-[34px] rounded px-1 font-label text-[10px] font-extrabold uppercase tracking-[0.04em] text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-lime"
          @click="emit('addLine')"
        >
          Add line
        </button>
      </div>
    </header>

    <p v-if="modelValue.length === 0" class="rounded-[14px] bg-white px-3 py-3 font-body text-[13px] text-on-surface-variant">
      Add at least one line to create this invoice.
    </p>

    <ol v-else class="grid gap-2">
      <InvoiceLineCard
        v-for="(line, index) in modelValue"
        :key="line.key"
        :line="line"
        :line-total="lineTotals[index] ?? 0"
        @update="updateLine(index, $event)"
        @remove="removeLine(index)"
      />
    </ol>
  </section>
</template>
