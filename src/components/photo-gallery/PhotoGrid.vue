<script setup>
import { computed } from 'vue'

const props = defineProps({
  photos: {
    type: Array,
    default: () => [],
  },
  columns: {
    type: [Number, String],
    default: 3,
  },
  variant: {
    type: String,
    default: 'default',
  },
})

const gridStyle = computed(() => {
  const parsedColumns = Number.parseInt(props.columns, 10)
  const columns = Number.isFinite(parsedColumns)
    ? Math.min(Math.max(parsedColumns, 1), 8)
    : 3

  return {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
  }
})
</script>

<template>
  <div
    v-if="photos.length"
    class="photo-grid grid"
    :class="variant === 'liquid' ? 'photo-grid--liquid' : 'gap-[2px]'"
    :style="gridStyle"
  >
    <div
      v-for="(photo, index) in photos"
      :key="photo.id ?? photo.src ?? index"
      class="photo-grid__cell relative aspect-square overflow-hidden bg-surface-variant"
      :class="variant === 'liquid' ? 'photo-grid__cell--liquid' : 'rounded-[3px]'"
    >
      <slot name="cell" :photo="photo" :index="index">
        <img
          v-if="photo.src"
          :src="photo.src"
          :alt="photo.label || `รูปที่ ${index + 1}`"
          class="h-full w-full object-cover"
        />

        <div v-else class="flex h-full w-full items-center justify-center">
          <span class="material-symbols-outlined text-[22px] text-on-surface-variant">image_not_supported</span>
        </div>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.photo-grid--liquid {
  gap: 2px;
  background: #000;
}

.photo-grid__cell {
  -webkit-tap-highlight-color: transparent;
}

.photo-grid__cell--liquid {
  border-radius: 3px;
  background: #0a0e0e;
}
</style>
