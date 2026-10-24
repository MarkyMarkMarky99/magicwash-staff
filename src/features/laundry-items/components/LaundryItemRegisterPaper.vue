<script setup lang="ts">
import PaperCard from '@/shared/components/PaperCard.vue'
import { computed } from 'vue'

export interface LaundryItemRegisterRow {
  id: string
  tag: string
  previewUrl: string
  status: 'uploading' | 'done' | 'failed'
}

const props = defineProps<{ rows: readonly LaundryItemRegisterRow[] }>()
const emit = defineEmits<{ view: [id: string], remove: [id: string], retry: [id: string] }>()

const total = computed(() => props.rows.length)
</script>

<template>
  <PaperCard tab="Items">
    <div class="cols paper__head">
      <span>Garment</span>
      <span>Status</span>
    </div>
    <div v-if="rows.length === 0" class="paper__state" role="status">
      <span class="material-symbols-outlined paper__state-icon" aria-hidden="true">checkroom</span>
      <p>Scan a tag, then photograph the garment</p>
    </div>
    <ul v-else class="m-0 list-none p-0">
      <li v-for="row in rows" :key="row.id" class="row">
        <div class="row__main">
          <button type="button" class="row__thumb" :aria-label="`View garment ${row.tag}`" @click="emit('view', row.id)">
            <img :src="row.previewUrl" :alt="`Garment ${row.tag}`">
          </button>
          <span class="row__tag font-mono">{{ row.tag }}</span>
          <button type="button" class="row__remove" :aria-label="`Remove garment ${row.tag}`" @click="emit('remove', row.id)">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
          </button>
        </div>
        <div class="row__status">
          <template v-if="row.status === 'uploading'">
            <span class="material-symbols-outlined animate-spin text-[18px] text-primary" aria-hidden="true">progress_activity</span>
            <span class="text-on-surface-variant" role="status">Uploading…</span>
          </template>
          <span v-else-if="row.status === 'done'" class="text-success">Uploaded</span>
          <template v-else>
            <span class="text-error" role="alert">Failed</span>
            <button type="button" class="row__retry" @click="emit('retry', row.id)">Retry</button>
          </template>
        </div>
      </li>
    </ul>
    <div class="cols paper__total">
      <div>Total</div>
      <div><span>{{ total }}</span><small>pcs</small></div>
    </div>
  </PaperCard>
</template>

<style scoped>
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 118px;
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

.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 118px;
  align-items: center;
  border-bottom: 1px solid var(--color-outline-variant);
}

.row__main {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
  padding: 8px 4px 8px 12px;
}

.row__thumb {
  flex: none;
  width: 48px;
  height: 48px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--color-surface-container);
}

.row__thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.row__tag {
  min-width: 0;
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: .02em;
}

.row__remove {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  color: var(--color-on-surface-variant);
}

.row__remove:focus-visible,
.row__thumb:focus-visible,
.row__retry:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: 2px;
}

.row__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px;
  font-size: 12px;
  font-weight: 700;
}

.row__retry {
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 800;
  text-decoration: underline;
}
</style>
