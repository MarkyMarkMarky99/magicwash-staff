<script setup lang="ts">
import { ref } from 'vue'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import { isValidItemQuantity, isWeightUnit, itemQuantityStep } from '@shared/utils/item-quantity'
/** Presentation only — props in, events out. */
import { createEmptyAdjustmentRow, type LineItemFormRow } from '../types/invoice-create.types'
import InvoiceAdjustmentsEditor from './InvoiceAdjustmentsEditor.vue'

const props = defineProps<{
  line: LineItemFormRow
  lineTotal: number
}>()

const emit = defineEmits<{
  update: [patch: Partial<LineItemFormRow>]
  remove: []
}>()

const adjustmentsOpen = ref(false)

const quantityInvalid = () => props.line.quantity !== '' && !isValidItemQuantity(props.line.quantity, props.line.unit)

function stepQuantity(direction: 1 | -1) {
  const step = Number(itemQuantityStep(props.line.unit))
  const current = Number(props.line.quantity) || 0
  const next = Math.max(step, Math.round((current + direction * step) * 10) / 10)
  emit('update', { quantity: String(next) })
}

function formatCurrency(value: number) {
  return `฿${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
</script>

<template>
  <li>
    <BaseSwipeCard class="invoice-line-swipe" :swipeable="true" :left-actions="1">
      <template #left-panel>
        <div class="absolute inset-y-0 right-0 flex w-28 items-center justify-end rounded-[14px] bg-error text-on-error">
          <button
            type="button"
            class="flex h-full w-16 shrink-0 items-center justify-center"
            aria-label="Remove line"
            @click.stop="emit('remove')"
          >
            <span class="material-symbols-outlined text-[22px]" aria-hidden="true">delete</span>
          </button>
        </div>
      </template>

      <div class="flex items-center gap-3 py-3 pl-3 pr-3">
        <div class="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container">
          <span class="material-symbols-outlined text-[26px]" aria-hidden="true">checkroom</span>
        </div>

        <div class="min-w-0 flex-1 space-y-0.5">
          <input
            :value="line.description"
            type="text"
            placeholder="Item name"
            aria-label="Item name"
            class="w-full truncate rounded bg-transparent font-body text-[14px] font-semibold text-on-surface outline-none placeholder:text-on-surface-variant focus:bg-surface-container-low"
            @mousedown.stop
            @touchstart.stop
            @touchend.stop
            @input="emit('update', { description: ($event.target as HTMLInputElement).value })"
          >

          <p class="flex items-center gap-1 font-body text-[11px] text-on-surface-variant">
            Price:
            <span class="text-primary" aria-hidden="true">฿</span>
            <input
              :value="line.unitPrice"
              type="number"
              step="any"
              inputmode="decimal"
              placeholder="add price"
              aria-label="Unit price"
              class="invoice-line-price"
              :class="{ 'invoice-line-price--empty': line.unitPrice.trim() === '' }"
              @mousedown.stop
              @touchstart.stop
              @touchend.stop
              @input="emit('update', { unitPrice: ($event.target as HTMLInputElement).value })"
            >
          </p>

          <p class="flex items-center gap-1 font-body text-[11px] text-on-surface-variant">
            Discount:
            <button
              type="button"
              class="font-semibold text-primary"
              :aria-expanded="adjustmentsOpen"
              @mousedown.stop
              @touchstart.stop
              @touchend.stop
              @click="adjustmentsOpen = !adjustmentsOpen"
            >
              {{ line.adjustments.length > 0 ? `${line.adjustments.length} applied` : 'add' }}
            </button>
          </p>

          <p class="pt-0.5 font-[Manrope,sans-serif] text-[15px] font-bold tracking-[-0.02em] text-on-surface tabular-nums">
            {{ line.unitPrice.trim() === '' ? '—' : formatCurrency(lineTotal) }}
          </p>
          <p v-if="quantityInvalid()" class="font-body text-[11px] text-error" role="alert">
            {{ isWeightUnit(line.unit) ? 'จำนวนทศนิยมได้ 1 ตำแหน่ง' : 'จำนวนต้องเป็นจำนวนเต็ม' }}
          </p>
        </div>

        <div class="flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            class="invoice-line-step invoice-line-step--filled"
            aria-label="Increase quantity"
            @mousedown.stop
            @touchstart.stop
            @touchend.stop
            @click="stepQuantity(1)"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
          </button>
          <input
            :value="line.quantity"
            type="number"
            min="0"
            :step="itemQuantityStep(line.unit)"
            :inputmode="isWeightUnit(line.unit) ? 'decimal' : 'numeric'"
            aria-label="Quantity"
            :aria-invalid="quantityInvalid()"
            class="invoice-line-qty"
            :class="{ 'text-error': quantityInvalid() }"
            @mousedown.stop
            @touchstart.stop
            @touchend.stop
            @input="emit('update', { quantity: ($event.target as HTMLInputElement).value })"
          >
          <button
            type="button"
            class="invoice-line-step"
            aria-label="Decrease quantity"
            @mousedown.stop
            @touchstart.stop
            @touchend.stop
            @click="stepQuantity(-1)"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">remove</span>
          </button>
        </div>
      </div>
    </BaseSwipeCard>

    <InvoiceAdjustmentsEditor
      v-if="adjustmentsOpen"
      class="mt-1 rounded-[14px] bg-white px-3 py-2.5 shadow-[0_1px_0_rgba(7,63,56,0.05)]"
      :model-value="line.adjustments"
      label="Line adjustments"
      compact
      @update:model-value="emit('update', { adjustments: $event })"
      @add="emit('update', { adjustments: [...line.adjustments, createEmptyAdjustmentRow()] })"
    />
  </li>
</template>

<style scoped>
/* The swipe card is the rounded card itself, so it keeps its corners when it slides and the
   red remove panel shows behind it (its right corners match the card's, so nothing leaks at rest). */
.invoice-line-swipe {
  background: transparent;
}

.invoice-line-swipe :deep(.swipe-card) {
  border-radius: 14px;
  background: white;
  box-shadow: 0 1px 0 rgba(7, 63, 56, 0.05);
}

.invoice-line-price {
  width: 72px;
  min-width: 0;
  padding: 0 2px;
  color: var(--color-primary);
  border-bottom: 1px dashed transparent;
  outline: 0;
  background: transparent;
  font-size: 12px;
  font-weight: 700;
  appearance: textfield;
}

.invoice-line-price--empty {
  border-bottom-color: var(--color-lime);
}

.invoice-line-price::placeholder {
  color: var(--color-on-secondary-container);
  font-weight: 600;
}

.invoice-line-price:focus {
  border-bottom: 1px solid var(--color-lime);
}

.invoice-line-qty {
  width: 36px;
  color: var(--color-on-surface);
  border-radius: 6px;
  outline: 0;
  background: transparent;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  appearance: textfield;
}

.invoice-line-qty:focus {
  background: var(--color-surface-container-low);
}

.invoice-line-price::-webkit-inner-spin-button,
.invoice-line-price::-webkit-outer-spin-button,
.invoice-line-qty::-webkit-inner-spin-button,
.invoice-line-qty::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
}

.invoice-line-step {
  display: flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  border: 1.5px solid var(--color-primary);
  border-radius: 9999px;
}

.invoice-line-step--filled {
  color: var(--color-on-primary);
  background: var(--color-primary);
}

.invoice-line-step:active {
  color: var(--color-on-surface);
  border-color: var(--color-lime);
  background: var(--color-lime);
}
</style>
