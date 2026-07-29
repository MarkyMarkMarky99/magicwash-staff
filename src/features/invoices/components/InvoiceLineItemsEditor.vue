<script setup lang="ts">
/** Presentation only — props in, events out. */
import { ref } from 'vue'
import { createEmptyAdjustmentRow, type LineItemFormRow } from '../types/invoice-create.types'
import InvoiceAdjustmentsEditor from './InvoiceAdjustmentsEditor.vue'

const props = defineProps<{
  modelValue: LineItemFormRow[]
}>()

const emit = defineEmits<{
  'update:modelValue': [rows: LineItemFormRow[]]
  addLine: []
}>()

const expandedAdjustments = ref<Set<string>>(new Set())

function toggleAdjustments(key: string) {
  const next = new Set(expandedAdjustments.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedAdjustments.value = next
}

function updateLine(index: number, patch: Partial<LineItemFormRow>) {
  const next = props.modelValue.map((row, i) => (i === index ? { ...row, ...patch } : row))
  emit('update:modelValue', next)
}

function updateLineAdjustments(index: number, adjustments: LineItemFormRow['adjustments']) {
  updateLine(index, { adjustments })
}

function removeLine(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}
</script>

<template>
  <section class="space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="font-headline text-base font-bold text-primary">Line items</h2>
      <button
        type="button"
        class="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 font-label text-[11px] font-semibold text-on-primary transition-colors hover:bg-primary/90"
        @click="emit('addLine')"
      >
        <span class="material-symbols-outlined text-[14px]" aria-hidden="true">add</span>
        Add line
      </button>
    </div>

    <p v-if="modelValue.length === 0" class="font-body text-sm text-on-surface-variant">
      No lines yet. Add at least one to create this invoice.
    </p>

    <article
      v-for="(line, index) in modelValue"
      :key="line.key"
      class="space-y-3 rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-3"
    >
      <div class="flex items-start justify-between gap-2">
        <span class="mt-2.5 shrink-0 font-label text-[11px] font-bold text-on-surface-variant/70">
          #{{ index + 1 }}
        </span>

        <input
          :value="line.description"
          type="text"
          placeholder="Description"
          class="h-10 flex-1 min-w-0 rounded-lg bg-surface-container px-3 font-body text-sm font-medium text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary"
          @input="updateLine(index, { description: ($event.target as HTMLInputElement).value })"
        >

        <button
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error-container hover:text-error"
          aria-label="Remove line"
          @click="removeLine(index)"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
        </button>
      </div>

      <div class="grid grid-cols-3 gap-2 pl-6">
        <label class="space-y-1">
          <span class="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">Unit</span>
          <input
            :value="line.unit"
            type="text"
            placeholder="Piece, kg…"
            class="h-9 w-full rounded-lg bg-surface-container px-2.5 font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary"
            @input="updateLine(index, { unit: ($event.target as HTMLInputElement).value })"
          >
        </label>

        <label class="space-y-1">
          <span class="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">Qty</span>
          <input
            :value="line.quantity"
            type="number"
            step="any"
            min="0"
            class="h-9 w-full rounded-lg bg-surface-container px-2.5 font-body text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            @input="updateLine(index, { quantity: ($event.target as HTMLInputElement).value })"
          >
        </label>

        <label class="space-y-1">
          <span class="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">Unit price</span>
          <input
            :value="line.unitPrice"
            type="number"
            step="any"
            placeholder="0.00"
            class="h-9 w-full rounded-lg bg-surface-container px-2.5 font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary"
            @input="updateLine(index, { unitPrice: ($event.target as HTMLInputElement).value })"
          >
        </label>
      </div>

      <div class="pl-6">
        <button
          type="button"
          class="font-label text-[11px] font-semibold text-primary"
          @click="toggleAdjustments(line.key)"
        >
          {{ expandedAdjustments.has(line.key) ? 'Hide' : 'Show' }} adjustments
          <span v-if="line.adjustments.length > 0">({{ line.adjustments.length }})</span>
        </button>

        <InvoiceAdjustmentsEditor
          v-if="expandedAdjustments.has(line.key)"
          class="mt-2"
          :model-value="line.adjustments"
          label="Line adjustments"
          compact
          @update:model-value="updateLineAdjustments(index, $event)"
          @add="updateLineAdjustments(index, [...line.adjustments, createEmptyAdjustmentRow()])"
        />
      </div>
    </article>
  </section>
</template>
