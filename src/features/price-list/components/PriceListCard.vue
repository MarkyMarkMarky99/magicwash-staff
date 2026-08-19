<script setup lang="ts">
import type { PriceListDto } from '../services/price-list.service'
import ServicePriceTriad from './ServicePriceTriad.vue'

const props = defineProps<{
  item: PriceListDto
}>()

const emit = defineEmits<{
  edit: [id: string]
}>()
</script>

<template>
  <button class="item-card" type="button" @click="emit('edit', props.item.id)">
    <div class="item-card-head">
      <div class="item-identity">
        <div class="item-code">{{ props.item.itemCode }}</div>
        <div class="item-name">{{ props.item.displayNameTh }}</div>
        <div class="item-meta">
          {{ props.item.subcategory }} · {{ props.item.itemType }}<template v-if="props.item.variant"> · {{ props.item.variant }}</template>
        </div>
      </div>
      <span class="state-badge" :class="props.item.active ? 'is-active' : 'is-inactive'">
        {{ props.item.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน' }}
      </span>
    </div>
    <ServicePriceTriad :item="props.item" />
  </button>
</template>

<style scoped>
.item-card {
  width: 100%;
  padding: 14px;
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  background: var(--color-surface-container-lowest);
  color: var(--color-on-surface);
  text-align: left;
}

.item-card:hover {
  border-color: var(--color-primary);
}

.item-card-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.item-identity {
  min-width: 0;
}

.item-code {
  color: var(--color-on-surface-variant);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.item-name {
  margin-top: 3px;
  font-family: var(--font-headline);
  font-size: 17px;
  font-weight: 700;
  line-height: 1.25;
}

.item-meta {
  margin-top: 5px;
  color: var(--color-on-surface-variant);
  font-size: 12px;
  line-height: 1.35;
}

.state-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 9px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.state-badge.is-active {
  background: var(--color-secondary-container);
  color: var(--color-primary);
}

.state-badge.is-inactive {
  background: var(--color-surface-container);
  color: var(--color-on-surface-variant);
}
</style>
