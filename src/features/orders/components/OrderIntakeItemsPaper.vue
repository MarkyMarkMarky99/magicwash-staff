<script setup lang="ts">
import type { OrderIntakeRow } from '@/features/orders/utils/order-intake-items'

defineProps<{ rows: readonly OrderIntakeRow[], total: number }>()
const emit = defineEmits<{ select: [key: string] }>()
</script>

<template>
  <div class="paper">
    <span class="paper__tab">Items</span>
    <div class="cols paper__head">
      <span>Item</span>
      <span>Qty</span>
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
          <span class="paper__name">
            <span v-if="row.uncategorized" class="material-symbols-outlined paper__warn-icon" aria-hidden="true">warning</span>
            <span class="truncate">{{ row.name }}</span>
          </span>
          <span class="paper__qty">{{ row.garments.length }}</span>
        </button>
      </li>
    </ul>
    <div class="cols paper__total">
      <div>Total</div>
      <div><span class="paper__total-num">{{ total }}<small>pcs</small></span></div>
    </div>
  </div>
</template>

<style scoped>
.paper {
  position: relative;
  min-width: 0;
  margin: 22px 4px 6px 2px;
  border: 2px solid var(--color-primary);
  border-radius: 11px 15px 12px 14px;
  background: white;
  box-shadow: 4px 4px 0 color-mix(in srgb, var(--color-primary) 70%, black);
}

.paper__tab {
  position: absolute;
  top: -12px;
  left: 10px;
  z-index: 8;
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

.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px;
}

.paper__head {
  padding-top: 6px;
  border-bottom: 2px solid var(--color-primary);
  border-radius: 9px 13px 0 0;
  background: white;
}

.paper__head > span {
  padding: 6px 8px 7px;
  color: var(--color-on-surface-variant);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .08em;
  text-align: center;
  text-transform: uppercase;
}

.paper__head > span:first-child {
  padding-left: 12px;
  text-align: left;
}

.paper__head > span:last-child {
  padding-right: 30px;
  text-align: right;
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
  border-top: 1px solid var(--color-outline-variant);
}

.paper__row {
  width: 100%;
  align-items: center;
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

.paper__name {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  padding: 12px 8px 12px 12px;
  font-size: 14px;
  font-weight: 700;
}

.paper__warn-icon {
  flex: none;
  font-size: 18px;
}

.paper__qty {
  padding: 12px 30px 12px 6px;
  font-size: 16px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.paper__total {
  border-top: 2px solid var(--color-primary);
  border-radius: 0 0 9px 12px;
  background: var(--color-secondary-container);
}

.paper__total > div {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 6px;
  color: var(--color-primary);
  font-size: 16px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.paper__total > div:last-child {
  justify-content: flex-end;
  padding-right: 30px;
}

.paper__total > div:first-child {
  justify-content: flex-start;
  padding-left: 12px;
  color: var(--color-on-secondary-container);
  font-size: 11px;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.paper__total-num {
  position: relative;
}

/* Numbers share one right edge and grow to the left; "pcs" sits fixed in the 30px gutter. */
.paper__total small {
  position: absolute;
  bottom: 2px;
  left: 100%;
  margin-left: 3px;
  color: var(--color-on-secondary-container);
  font-size: 10px;
  font-weight: 700;
}
</style>
