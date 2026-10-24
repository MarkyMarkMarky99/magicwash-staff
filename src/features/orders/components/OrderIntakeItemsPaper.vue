<script setup lang="ts">
import PaperCard from '@/shared/components/PaperCard.vue'
import ImageOrIcon from '@/shared/components/ImageOrIcon.vue'
import type { OrderIntakeRow } from '@/features/orders/utils/order-intake-items'

defineProps<{ rows: readonly OrderIntakeRow[], total: number }>()
const emit = defineEmits<{ select: [key: string] }>()

function defectCount(row: OrderIntakeRow): number {
  return row.garments.filter((garment) => garment.defectPhotos.length > 0).length
}

function figureClass(count: number): string {
  return count >= 100 ? 'text-[20px]' : 'text-[28px]'
}
</script>

<template>
  <PaperCard tab="Items">
    <div class="cols paper__head">
      <span>Qty</span>
      <span>Item</span>
    </div>
    <div v-if="rows.length === 0" class="paper__state" role="status">
      <span class="material-symbols-outlined paper__state-icon" aria-hidden="true">checkroom</span>
      <p>Scan a garment tag to add it</p>
    </div>
    <ul v-else class="paper__rows">
      <li v-for="row in rows" :key="row.key">
        <button
          type="button"
          class="cols paper__row"
          :class="{ 'paper__row--warning': row.uncategorized }"
          :aria-label="`${row.name}, ${row.garments.length} ${row.garments.length === 1 ? 'garment' : 'garments'}. Open garments`"
          @click="emit('select', row.key)"
        >
          <span class="paper__figure">
            <span class="font-headline font-extrabold leading-none tabular-nums" :class="figureClass(row.garments.length)">{{ row.garments.length }}</span>
            <span class="paper__unit">pcs</span>
          </span>
          <span class="min-w-0">
            <span class="flex items-center gap-1.5 font-body text-sm font-extrabold">
              <span v-if="row.uncategorized" class="material-symbols-outlined text-[18px]" aria-hidden="true">warning</span>
              <span class="truncate">{{ row.name }}</span>
            </span>
            <span v-if="row.uncategorized" class="mt-1 block font-label text-[10px] font-extrabold uppercase text-warning">Choose a type</span>
            <span v-else-if="defectCount(row) > 0" class="mt-1 block font-label text-[10px] font-extrabold uppercase text-warning">{{ defectCount(row) }} with defect</span>
            <span v-if="row.nameTh" class="mt-1 block truncate font-label text-[11px] text-on-surface-variant">{{ row.nameTh }}</span>
          </span>
          <ImageOrIcon :image-url="row.imageUrl" :icon="row.uncategorized ? 'help' : 'checkroom'" class="h-14 w-14 rounded-[10px]" />
        </button>
      </li>
    </ul>
    <div class="paper__total">
      <span class="paper__total-label">Total</span>
      <span class="paper__total-figure">{{ total }}<small>pcs</small></span>
    </div>
  </PaperCard>
</template>

<style scoped>
/* Same columns as a WashQueue row: figure | details | photo. */
.cols {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) 56px;
  align-items: center;
  column-gap: 10px;
  padding: 0 12px;
}

.paper__head {
  padding-top: 6px;
  border-bottom: 2px solid var(--color-primary);
  border-radius: 9px 13px 0 0;
  background: white;
}

.paper__head > span {
  padding: 6px 0 7px;
  color: var(--color-on-surface-variant);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.paper__head > span:first-child {
  padding-right: 8px;
  text-align: center;
}

.paper__state {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 22px 16px;
  color: var(--color-on-surface-variant);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  text-align: center;
}

.paper__state-icon {
  color: var(--color-primary);
  font-size: 28px;
}

.paper__rows > li + li {
  border-top: 1px dashed var(--color-outline-variant);
}

.paper__row {
  width: 100%;
  padding-top: 10px;
  padding-bottom: 10px;
  color: var(--color-primary);
  text-align: left;
}

.paper__row:active {
  background: var(--color-surface-container-low);
}

.paper__row:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: -2px;
}

.paper__row--warning {
  background: var(--color-warning-container);
  color: var(--color-on-warning-container);
}

.paper__row--warning:active {
  background: var(--color-warning-container);
}

.paper__figure {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  padding-right: 8px;
  border-right: 1px solid var(--color-outline-variant);
}

.paper__unit {
  margin-top: 6px;
  color: var(--color-on-surface-variant);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.paper__total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 10px 14px 10px 12px;
  border-top: 2px solid var(--color-primary);
  border-radius: 0 0 9px 12px;
  background: var(--color-secondary-container);
  color: var(--color-primary);
}

.paper__total-figure {
  font-size: 18px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.paper__total-figure small {
  margin-left: 3px;
  color: var(--color-on-secondary-container);
  font-size: 10px;
  font-weight: 700;
}

.paper__total-label {
  color: var(--color-on-secondary-container);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}
</style>
