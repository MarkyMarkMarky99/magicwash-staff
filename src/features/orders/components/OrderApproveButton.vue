<script setup lang="ts">
import StickerFab from '@/shared/components/StickerFab.vue'

defineProps<{
  saving: boolean
  disabled: boolean
  reason?: string | null
}>()

const emit = defineEmits<{
  approve: []
}>()
</script>

<template>
  <div class="flex flex-col items-center">
    <p v-if="disabled && !saving && reason" class="approve-reason" role="status">{{ reason }}</p>
    <StickerFab
      label="Approve"
      :aria-label="saving ? 'Saving approval' : 'Approve order'"
      :saving="saving"
      :disabled="disabled"
      @click="emit('approve')"
    >
      <svg class="approve-glyph" viewBox="0 0 28 28" aria-hidden="true">
        <path d="m5 14 6 6L23 7" />
      </svg>
    </StickerFab>
  </div>
</template>

<style scoped>
.approve-glyph {
  width: 27px;
  height: 27px;
  overflow: visible;
}

.approve-glyph path {
  fill: none;
  stroke: currentColor;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.approve-reason {
  margin-bottom: 6px;
  max-width: 112px;
  color: var(--color-error);
  font-family: var(--font-label);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
}

.approve-reason::after {
  content: "";
  display: block;
  width: 0;
  height: 0;
  margin: 3px auto 0;
  border: 4px solid transparent;
  border-top-color: var(--color-error);
}
</style>
