<script setup lang="ts">
/**
 * Presentation only — props in, events out. Reused at both invoice level and
 * per-line level; the two levels apply the same shape with different
 * arithmetic (see `shared/utils/invoice-calculator.ts`), but this
 * component doesn't know or care which — it just edits a list of rows.
 */
import type { AdjustmentFormRow } from '../types/invoice-create.types'

const props = defineProps<{
  modelValue: AdjustmentFormRow[]
  label: string
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
    <div class="flex items-center justify-between gap-3">
      <h3
        v-if="compact"
        class="font-label text-[11px] font-bold uppercase tracking-wide text-on-surface-variant"
      >
        {{ label }}
      </h3>
      <h2
        v-else
        class="border-l-4 border-lime pl-2.5 font-headline text-[17px] font-extrabold tracking-[-0.03em] text-primary"
      >
        {{ label }}
      </h2>
      <button
        type="button"
        class="min-h-[34px] shrink-0 rounded px-1 font-label text-[10px] font-extrabold uppercase tracking-[0.04em] text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-lime"
        @click="emit('add')"
      >
        Add adjustment
      </button>
    </div>

    <div
      v-for="(row, index) in modelValue"
      :key="row.key"
      class="flex items-start gap-2 rounded-[14px] bg-white p-2.5 shadow-[0_1px_0_rgba(7,63,56,0.05)]"
      :class="compact ? '' : 'sm:items-center'"
    >
      <div class="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <input
          :value="row.label"
          type="text"
          placeholder="Label, e.g. Member discount"
          class="h-9 flex-1 min-w-0 rounded-lg bg-surface-container px-3 font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-lime"
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
          class="h-9 w-24 shrink-0 rounded-lg bg-surface-container px-3 font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-lime"
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
