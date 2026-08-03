<script setup lang="ts">
/** Presentation only — props in, events out. */
import { ref } from 'vue'
import {
  createEmptyAdjustmentRow,
  invoiceUnitOptions,
  type InvoiceUnitOption,
  type LineItemFormRow,
} from '../types/invoice-create.types'
import ListContainer from '@/shared/components/ListContainer.vue'
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

function updateUnit(index: number, unitOption: InvoiceUnitOption) {
  updateLine(index, {
    unitOption,
    unit: unitOption === 'custom' ? '' : unitOption,
  })
}

function updateCustomUnit(index: number, unit: string) {
  updateLine(index, { unitOption: 'custom', unit })
}

function removeLine(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}
</script>

<template>
  <ListContainer
    title="Line items"
    icon="checkroom"
    :count="modelValue.length"
    count-label="items"
    :empty="modelValue.length === 0"
    empty-text="No lines yet. Add at least one to create this invoice."
  >
    <template #actions>
      <button
        type="button"
        class="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 font-label text-[11px] font-bold text-on-primary transition-colors hover:bg-primary/90"
        @click.stop="emit('addLine')"
      >
        <span class="material-symbols-outlined text-[14px]" aria-hidden="true">add</span>
        Add line
      </button>
    </template>

    <template #empty>
      <p class="px-4 py-4 font-body text-[13px] italic text-on-surface-variant">
        No lines yet. Add at least one to create this invoice.
      </p>
    </template>

    <article v-for="(line, index) in modelValue" :key="line.key" class="px-4 py-3">
      <div class="flex items-start gap-3">
        <span class="mt-2.5 shrink-0 font-label text-[11px] font-bold text-on-surface-variant/70">
          #{{ index + 1 }}
        </span>

        <div class="min-w-0 flex-1 space-y-3">
          <div class="flex items-start gap-2">
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

          <div class="grid grid-cols-3 gap-2">
            <label class="space-y-1">
              <span class="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">Unit</span>
              <select
                :value="line.unitOption"
                class="h-9 w-full rounded-lg bg-surface-container px-2.5 font-body text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                @change="updateUnit(index, ($event.target as HTMLSelectElement).value as InvoiceUnitOption)"
              >
                <option v-for="option in invoiceUnitOptions" :key="option" :value="option">
                  {{ option === 'custom' ? 'Custom' : option }}
                </option>
              </select>
              <input
                v-if="line.unitOption === 'custom'"
                :value="line.unit"
                type="text"
                placeholder="Enter custom unit"
                aria-label="Custom unit"
                class="mt-1 h-9 w-full rounded-lg bg-surface-container px-2.5 font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary"
                @input="updateCustomUnit(index, ($event.target as HTMLInputElement).value)"
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

          <div>
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
              class="mt-2 border-l-2 border-outline-variant/30 pl-3"
              :model-value="line.adjustments"
              label="Line adjustments"
              compact
              @update:model-value="updateLineAdjustments(index, $event)"
              @add="updateLineAdjustments(index, [...line.adjustments, createEmptyAdjustmentRow()])"
            />
          </div>
        </div>
      </div>
    </article>
  </ListContainer>
</template>
