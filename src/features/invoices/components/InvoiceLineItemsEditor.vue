<script setup lang="ts">
import { ref } from 'vue'
import FormLabel from '@/shared/components/FormLabel.vue'
import FormPicker from '@/shared/components/FormPicker.vue'
import { isValidItemQuantity, isWeightUnit, itemQuantityStep } from '@shared/utils/item-quantity'
/** Presentation only — props in, events out. */
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
const unitOptions = invoiceUnitOptions.map((option) => ({
  value: option,
  label: option === 'custom' ? 'Custom' : option,
}))

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
          class="-my-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 active:bg-primary/20 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
          aria-label="Add line"
          @click.stop="emit('addLine')"
        >
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">playlist_add</span>
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
              <FormPicker
                :id="`invoice-line-${line.key}-unit`"
                :model-value="line.unitOption"
                label="Unit"
                :options="unitOptions"
                :searchable="false"
                @update:model-value="updateUnit(index, $event as InvoiceUnitOption)"
              />
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
                :step="itemQuantityStep(line.unit)"
                :inputmode="isWeightUnit(line.unit) ? 'decimal' : 'numeric'"
                :aria-describedby="`invoice-line-${line.key}-quantity-help`"
                :aria-invalid="line.quantity !== '' && !isValidItemQuantity(line.quantity, line.unit)"
                min="0"
                class="invoice-line-control"
                @input="updateLine(index, { quantity: ($event.target as HTMLInputElement).value })"
              >
              <p :id="`invoice-line-${line.key}-quantity-help`" class="mt-1 font-body text-[10px] text-on-surface-variant">
                {{ isWeightUnit(line.unit) ? 'กิโลกรัม: ทศนิยมได้ 1 ตำแหน่ง' : 'หน่วยนี้ใช้จำนวนเต็ม' }}
              </p>
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
  color: var(--color-on-surface);
  border: 1px solid var(--color-outline-variant);
  border-radius: 10px;
  outline: 0;
  background: white;
  box-shadow: 0 1px 0 color-mix(in srgb, var(--color-primary) 2%, transparent);
  font-family: 'Noto Sans Thai', system-ui, sans-serif;
  font-size: 14px;
  transition: border-color 150ms, box-shadow 150ms;
}

.invoice-line-control::placeholder {
  color: var(--color-on-surface-variant);
}

.invoice-line-control:focus {
  border-color: var(--color-lime);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-lime) 14%, transparent);
}

.invoice-line-select {
  padding-right: 27px;
  appearance: none;
  background: linear-gradient(45deg, transparent 50%, var(--color-primary) 50%) no-repeat right 17px center / 6px 6px, linear-gradient(135deg, var(--color-primary) 50%, transparent 50%) no-repeat right 11px center / 6px 6px; background-color:white;
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
