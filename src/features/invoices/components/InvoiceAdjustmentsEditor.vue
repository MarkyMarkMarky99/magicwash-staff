<script setup lang="ts">
/**
 * Presentation only — props in, events out. Reused at both invoice level and
 * per-line level; the two levels apply the same shape with different
 * arithmetic (see `contracts/invoices/invoice-calculator.ts`), but this
 * component doesn't know or care which — it just edits a list of rows.
 */
import type { AdjustmentFormRow } from '../types/invoice-create.types'

const props = defineProps<{
  modelValue: AdjustmentFormRow[]
  label: string
  /** Denser row layout for per-line use, where several of these sit inside
   *  an already-busy line-item card. */
  compact?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [rows: AdjustmentFormRow[]]
  add: []
}>()

function updateRow(index: number, patch: Partial<AdjustmentFormRow>) {
  const next = props.modelValue.map((row, i) => (i === index ? { ...row, ...patch } : row))
  emit('update:modelValue', next)
}

function removeRow(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}
</script>

<template>
  <section class="space-y-2">
    <div class="flex items-center justify-between">
      <h3 class="font-label text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
        {{ label }}
      </h3>
      <button
        type="button"
        class="flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 font-label text-[11px] font-semibold text-primary transition-colors hover:bg-surface-container-high"
        @click="emit('add')"
      >
        <span class="material-symbols-outlined text-[14px]" aria-hidden="true">add</span>
        Add adjustment
      </button>
    </div>

    <p v-if="modelValue.length === 0" class="font-body text-xs text-on-surface-variant/70">
      No adjustments — the full amount applies as-is.
    </p>

    <div
      v-for="(row, index) in modelValue"
      :key="row.key"
      class="flex items-start gap-2 rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-2.5"
      :class="compact ? '' : 'sm:items-center'"
    >
      <div class="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <input
          :value="row.label"
          type="text"
          placeholder="Label, e.g. Member discount"
          class="h-9 flex-1 min-w-0 rounded-lg bg-surface-container px-3 font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary"
          @input="updateRow(index, { label: ($event.target as HTMLInputElement).value })"
        >

        <div class="flex shrink-0 gap-1 rounded-lg bg-surface-container p-0.5">
          <button
            type="button"
            class="rounded-md px-2 py-1 font-label text-[11px] font-semibold transition-colors"
            :class="row.calculation === 'FIXED' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'"
            @click="updateRow(index, { calculation: 'FIXED' })"
          >฿</button>
          <button
            type="button"
            class="rounded-md px-2 py-1 font-label text-[11px] font-semibold transition-colors"
            :class="row.calculation === 'PERCENT' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'"
            @click="updateRow(index, { calculation: 'PERCENT' })"
          >%</button>
        </div>

        <input
          :value="row.value"
          type="number"
          step="any"
          placeholder="-10"
          class="h-9 w-24 shrink-0 rounded-lg bg-surface-container px-3 font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary"
          @input="updateRow(index, { value: ($event.target as HTMLInputElement).value })"
        >
      </div>

      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error-container hover:text-error"
        aria-label="Remove adjustment"
        @click="removeRow(index)"
      >
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
      </button>
    </div>
  </section>
</template>
