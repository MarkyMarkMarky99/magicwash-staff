<script setup lang="ts">
import FormLabel from '@/shared/components/FormLabel.vue'
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
  pickFromPriceList: []
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
      <div class="flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          class="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-label text-[11px] font-bold text-primary transition-colors hover:bg-primary/15"
          @click.stop="emit('pickFromPriceList')"
        >
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">sell</span>
          เลือกจากรายการราคา
        </button>
        <button
          type="button"
          class="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 font-label text-[11px] font-bold text-on-primary transition-colors hover:bg-primary/90"
          @click.stop="emit('addLine')"
        >
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">add</span>
          Add line
        </button>
      </div>
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
            <label :for="`invoice-line-${line.key}-description`" class="sr-only">Description</label>
            <input
              :id="`invoice-line-${line.key}-description`"
              :value="line.description"
              type="text"
              placeholder="Description"
              class="invoice-line-control flex-1"
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
            <div>
              <FormLabel :input-id="`invoice-line-${line.key}-unit`">Unit</FormLabel>
              <select
                :id="`invoice-line-${line.key}-unit`"
                :value="line.unitOption"
                class="invoice-line-control invoice-line-select"
                @change="updateUnit(index, ($event.target as HTMLSelectElement).value as InvoiceUnitOption)"
              >
                <option v-for="option in invoiceUnitOptions" :key="option" :value="option">
                  {{ option === 'custom' ? 'Custom' : option }}
                </option>
              </select>
              <input
                v-if="line.unitOption === 'custom'"
                :id="`invoice-line-${line.key}-custom-unit`"
                :value="line.unit"
                type="text"
                placeholder="Enter custom unit"
                aria-label="Custom unit"
                class="invoice-line-control mt-1"
                @input="updateCustomUnit(index, ($event.target as HTMLInputElement).value)"
              >
            </div>

            <div>
              <FormLabel :input-id="`invoice-line-${line.key}-quantity`">Qty</FormLabel>
              <input
                :id="`invoice-line-${line.key}-quantity`"
                :value="line.quantity"
                type="number"
                step="any"
                min="0"
                class="invoice-line-control"
                @input="updateLine(index, { quantity: ($event.target as HTMLInputElement).value })"
              >
            </div>

            <div>
              <FormLabel :input-id="`invoice-line-${line.key}-unit-price`">Unit price</FormLabel>
              <input
                :id="`invoice-line-${line.key}-unit-price`"
                :value="line.unitPrice"
                type="number"
                step="any"
                placeholder="0.00"
                class="invoice-line-control"
                @input="updateLine(index, { unitPrice: ($event.target as HTMLInputElement).value })"
              >
            </div>
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

<style scoped>
.invoice-line-control {
  display: block;
  width: 100%;
  min-width: 0;
  height: 47px;
  padding: 0 12px;
  color: #073f38;
  border: 1px solid #a9c9c3;
  border-radius: 10px;
  outline: 0;
  background: #fff;
  box-shadow: 0 1px 0 rgba(0, 79, 69, 0.02);
  font-family: 'Noto Sans Thai', system-ui, sans-serif;
  font-size: 14px;
  transition: border-color 150ms, box-shadow 150ms;
}

.invoice-line-control::placeholder {
  color: #5f7772;
}

.invoice-line-control:focus {
  border-color: #007a69;
  box-shadow: 0 0 0 3px rgba(0, 122, 105, 0.14);
}

.invoice-line-select {
  padding-right: 27px;
  appearance: none;
  background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='m1 1 5 5 5-5' fill='none' stroke='%2300564b' stroke-width='1.7' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 11px center;
}

input.invoice-line-control[type='number'] {
  appearance: textfield;
}

input.invoice-line-control[type='number']::-webkit-inner-spin-button,
input.invoice-line-control[type='number']::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
}
</style>
