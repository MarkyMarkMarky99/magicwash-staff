<script setup lang="ts">
import ImageOrIcon from '@/shared/components/ImageOrIcon.vue'
import CountStepper from '@/features/orders/components/CountStepper.vue'
import { lineSubtitle, lineTitle, type CorporateOrderLine } from '@/features/orders/utils/corporate-order-draft'

defineProps<{
  lines: readonly CorporateOrderLine[]
  total: number
  loading: boolean
  error: string | null
  emptyList: boolean
}>()

const emit = defineEmits<{
  count: [key: string, counted: number | null]
  remove: [key: string]
  add: []
}>()
</script>

<template>
  <div class="paper">
    <span class="paper__tab">Count sheet</span>
    <div class="cols paper__head">
      <span>Item</span>
      <span>Counted</span>
    </div>

    <div v-if="loading" class="paper__state" role="status" aria-live="polite">
      <span v-for="n in 4" :key="n" class="paper__skeleton" />
    </div>
    <p v-else-if="error" class="paper__state paper__state--message text-error" role="alert">{{ error }}</p>
    <div v-else-if="emptyList" class="paper__state paper__state--message" role="status">
      <span class="material-symbols-outlined paper__state-icon" aria-hidden="true">playlist_remove</span>
      <p>This customer has no corporate item list yet</p>
    </div>

    <div
      v-for="line in lines"
      :key="line.key"
      class="cols crow"
      :class="{ 'crow--uncounted': line.counted === null, 'crow--added': line.added }"
    >
      <div class="crow__item">
        <ImageOrIcon class="crow__glyph" :image-url="line.imageUrl" :icon="line.added ? 'add_box' : 'checkroom'" fit="contain" />
        <div class="min-w-0">
          <b class="crow__title">
            {{ lineTitle(line) }}
            <span v-if="line.added" class="crow__added">Added</span>
          </b>
          <span v-if="lineSubtitle(line)" class="crow__subtitle">{{ lineSubtitle(line) }}</span>
        </div>
      </div>
      <div class="crow__count">
        <CountStepper :model-value="line.counted" :label="lineTitle(line)" @update:model-value="emit('count', line.key, $event)" />
      </div>
      <button v-if="line.added" type="button" class="crow__remove" :aria-label="`Remove ${lineTitle(line)}`" @click="emit('remove', line.key)">
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
    </div>

    <div v-if="!loading" class="p-2.5">
      <button type="button" class="paper__add" @click="emit('add')">
        <span class="material-symbols-outlined" aria-hidden="true">add_circle</span>
        Add item not on the list
      </button>
    </div>

    <div class="cols paper__total">
      <div>Total</div>
      <div><span>{{ total }}</span><small>pcs</small></div>
    </div>
  </div>
</template>

<style scoped>
.paper {
  position: relative;
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
  grid-template-columns: minmax(0, 1fr) 118px;
}

.paper__head {
  position: sticky;
  top: 0;
  z-index: 4;
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

.paper__state {
  display: grid;
  gap: 10px;
  padding: 14px 12px;
}

.paper__state--message {
  justify-items: center;
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

.paper__skeleton {
  height: 40px;
  border-radius: 11px;
  background: var(--color-surface-container);
  animation: paper-pulse 1.2s ease-in-out infinite;
}

@keyframes paper-pulse {
  50% { opacity: .5; }
}

.crow {
  position: relative;
  min-height: 60px;
  border-bottom: 1px dashed var(--color-outline-variant);
}

.crow > div {
  display: flex;
  align-items: center;
  min-width: 0;
}

.crow__item {
  gap: 8px;
  padding: 8px 6px 8px 10px;
}

.crow__glyph {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 11px;
  background: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
  transform: rotate(-5deg);
}

.crow--added .crow__glyph {
  background: var(--color-info-container);
  color: var(--color-on-info-container);
}

.crow--uncounted .crow__glyph {
  opacity: .65;
}

.crow__title {
  display: block;
  color: var(--color-primary);
  font-size: 12.5px;
  font-weight: 800;
  line-height: 1.25;
}

.crow__subtitle {
  display: block;
  color: var(--color-on-surface-variant);
  font-size: 10.5px;
  line-height: 1.3;
}

.crow__added {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  padding: 1px 6px 2px;
  border-radius: 5px;
  background: var(--color-lime);
  color: var(--color-primary);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
  vertical-align: middle;
}

.crow__count {
  justify-content: center;
  padding-right: 2px;
  border-right: 1px dashed var(--color-outline-variant);
  border-left: 1px dashed var(--color-outline-variant);
  background: var(--color-surface-container-low);
}

.crow__remove {
  position: absolute;
  top: 3px;
  right: 124px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: var(--color-on-surface-variant);
}

.crow__remove .material-symbols-outlined {
  font-size: 16px;
}

.crow__remove:focus-visible,
.paper__add:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: 2px;
}

.paper__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 46px;
  border: 2px dashed color-mix(in srgb, var(--color-primary) 40%, white);
  border-radius: 12px;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 800;
}

.paper__add .material-symbols-outlined {
  font-size: 22px;
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

.paper__total > div:first-child {
  justify-content: flex-start;
  padding-left: 12px;
  color: var(--color-on-secondary-container);
  font-size: 11px;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.paper__total small {
  margin-left: 3px;
  color: var(--color-on-secondary-container);
  font-size: 10px;
  font-weight: 700;
}

@media (prefers-reduced-motion: reduce) {
  .paper__skeleton {
    animation: none;
  }
}
</style>
