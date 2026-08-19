<script setup lang="ts">
import type { PriceListDto } from '../services/price-list.service'

const props = defineProps<{
  item: PriceListDto
}>()

const services = [
  { key: 'washDryIronPrice', label: 'ซัก อบ รีด' },
  { key: 'ironOnlyPrice', label: 'รีดอย่างเดียว' },
  { key: 'dryCleanPrice', label: 'ดรายคลีน' },
] as const

function formatPrice(value: number): string {
  return new Intl.NumberFormat('th-TH').format(value)
}
</script>

<template>
  <div class="price-group" aria-label="ราคาตามบริการ">
    <div
      v-for="service in services"
      :key="service.key"
      class="price-slot"
      :class="props.item[service.key] === null ? 'is-empty' : 'has-price'"
      :aria-label="`${service.label}: ${props.item[service.key] === null ? 'ไม่มีราคา' : `${props.item[service.key]} บาท`}`"
    >
      <span class="price-service">{{ service.label }}</span>
      <template v-if="props.item[service.key] === null">
        <span class="empty-mark">—</span>
        <span class="empty-note">ไม่มีราคา</span>
      </template>
      <template v-else>
        <span class="price-value">{{ formatPrice(props.item[service.key]) }}</span>
        <span class="price-unit">บาท</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.price-group {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 14px;
}

.price-slot {
  display: grid;
  align-content: center;
  min-width: 0;
  min-height: 67px;
  padding: 7px 6px;
  border-radius: var(--radius);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.price-slot.has-price {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.price-slot.is-empty {
  background: var(--color-surface-container-low);
  border: 1px dashed var(--color-outline);
  color: var(--color-on-surface-variant);
}

.price-service {
  min-height: 25px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
}

.price-value {
  display: block;
  font-family: var(--font-headline);
  font-size: 20px;
  font-weight: 800;
  line-height: 1.05;
}

.price-unit {
  display: block;
  margin-top: 2px;
  font-size: 10px;
}

.empty-mark {
  display: block;
  font-family: var(--font-headline);
  font-size: 22px;
  line-height: 1;
}

.empty-note {
  display: block;
  margin-top: 3px;
  font-size: 10px;
  line-height: 1.1;
}

@media (max-width: 420px) {
  .price-slot {
    min-height: 64px;
    padding-inline: 4px;
  }

  .price-service {
    font-size: 9px;
  }

  .price-value {
    font-size: 18px;
  }

  .price-unit,
  .empty-note {
    font-size: 9px;
  }
}
</style>
