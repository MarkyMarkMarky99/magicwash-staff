<script setup>
import { computed } from 'vue'

const props = defineProps({
  photos: {
    type: Array,
    default: () => [],
  },
  modelValue: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'close'])

const currentPhoto = computed(() => props.photos[props.modelValue] ?? null)

function close() {
  emit('update:modelValue', null)
  emit('close')
}

function move(delta) {
  const nextIndex = props.modelValue + delta
  if (nextIndex < 0 || nextIndex >= props.photos.length) return
  emit('update:modelValue', nextIndex)
}
</script>

<template>
  <div
    v-if="currentPhoto"
    class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
    @click="close"
  >
    <button
      class="absolute right-4 top-4 text-white"
      type="button"
      aria-label="ปิดรูปภาพ"
      @click="close"
    >
      <span class="material-symbols-outlined text-3xl">close</span>
    </button>

    <img
      v-if="currentPhoto.src"
      :src="currentPhoto.src"
      :alt="currentPhoto.label || `รูปที่ ${modelValue + 1}`"
      class="max-h-[80dvh] max-w-full rounded-2xl object-contain"
      @click.stop
    />

    <div
      v-else
      class="flex h-64 w-full max-w-sm items-center justify-center rounded-2xl bg-white/10"
      @click.stop
    >
      <span class="material-symbols-outlined text-4xl text-white/70">image_not_supported</span>
    </div>

    <p v-if="currentPhoto.label" class="mt-3 text-center font-body text-sm text-white/80">
      {{ currentPhoto.label }}
    </p>

    <div class="mt-4 flex gap-6">
      <button
        :disabled="modelValue === 0"
        class="text-white disabled:opacity-30"
        type="button"
        aria-label="รูปก่อนหน้า"
        @click.stop="move(-1)"
      >
        <span class="material-symbols-outlined text-3xl">chevron_left</span>
      </button>
      <span class="self-center font-body text-sm text-white/60">
        {{ modelValue + 1 }} / {{ photos.length }}
      </span>
      <button
        :disabled="modelValue === photos.length - 1"
        class="text-white disabled:opacity-30"
        type="button"
        aria-label="รูปถัดไป"
        @click.stop="move(1)"
      >
        <span class="material-symbols-outlined text-3xl">chevron_right</span>
      </button>
    </div>
  </div>
</template>
