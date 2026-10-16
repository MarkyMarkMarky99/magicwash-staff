<script setup lang="ts">
import { computed } from 'vue'

// The photo block of a capture sheet: a dashed "No photo yet" frame that becomes a square preview once a photo exists.
// Passive by default; with `tappable` the frame and the preview become one button that emits `capture`, and the preview
// shows a Retake pill and an uploading veil. The overlay slot sits on top of the preview (e.g. a tag label).
const props = withDefaults(defineProps<{
  photoUrl: string
  uploading: boolean
  title: string
  hint: string
  alt: string
  tappable?: boolean
}>(), { tappable: false })
const emit = defineEmits<{ capture: [] }>()
const tag = computed(() => props.tappable ? 'button' : 'div')
</script>

<template>
  <div v-if="photoUrl" class="relative aspect-square overflow-hidden rounded-[18px] bg-surface-container-low">
    <img :src="photoUrl" :alt="alt" class="h-full w-full object-cover" />
    <slot name="overlay" />
    <button v-if="tappable" type="button" class="photo-panel__tap" :disabled="uploading" :aria-label="uploading ? 'Uploading photo' : 'Retake photo'" @click="emit('capture')">
      <span v-if="uploading" class="photo-panel__veil" role="status"><span class="material-symbols-outlined animate-spin" aria-hidden="true">sync</span></span>
      <span v-else class="photo-panel__retake"><span class="material-symbols-outlined" aria-hidden="true">flip_camera_ios</span>Retake</span>
    </button>
  </div>
  <component :is="tag" v-else class="photo-panel__empty" v-bind="tappable ? { type: 'button', disabled: uploading, 'aria-label': uploading ? 'Uploading photo' : 'Take photo' } : {}" @click="tappable && emit('capture')">
    <span class="photo-panel__icon"><span class="material-symbols-outlined fill" aria-hidden="true">{{ uploading ? 'cloud_upload' : 'photo_camera' }}</span></span>
    <span class="mt-3 block font-body text-sm font-extrabold tracking-[-0.015em] text-on-surface">{{ uploading ? 'Uploading photo…' : title }}</span>
    <span class="mt-1 block font-body text-[13px] text-on-surface-variant">{{ hint }}</span>
  </component>
</template>

<style scoped>
/* Before the photo: a dashed frame with the bag-scan empty state in the middle. */
.photo-panel__empty {
  display: flex;
  width: 100%;
  height: 200px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  border: 2px dashed color-mix(in srgb, var(--color-primary) 40%, white);
  border-radius: 18px;
  text-align: center;
}

button.photo-panel__empty:focus-visible,
.photo-panel__tap:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: -2px;
}

.photo-panel__icon {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  border-radius: 18px;
  background: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
  transform: rotate(-7deg);
}

.photo-panel__icon .material-symbols-outlined {
  font-size: 28px;
}

.fill {
  font-variation-settings: "FILL" 1;
}

/* Tappable preview: one button over the whole photo; the pill is only the visual cue. */
.photo-panel__tap {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.photo-panel__retake {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 12px 7px 9px;
  border-radius: 999px;
  background: var(--color-primary);
  color: var(--color-lime);
  font-family: var(--font-label);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.photo-panel__retake .material-symbols-outlined {
  font-size: 18px;
}

.photo-panel__veil {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--color-primary) 60%, transparent);
  color: var(--color-lime);
}

.photo-panel__veil .material-symbols-outlined {
  font-size: 36px;
}
</style>
