<script setup>
defineProps({
  photo: {
    type: Object,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
  isProcessing: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['click', 'remove'])
</script>

<template>
  <button
    class="photo-gallery__cell-button relative block w-full h-full overflow-hidden text-white"
    type="button"
    @click="emit('click', photo, index)"
  >
    <img
      v-if="photo.src"
      :src="photo.src"
      :alt="photo.label || photo.albumTitle || `รูปที่ ${index + 1}`"
      class="h-full w-full object-cover"
    />

    <div v-else class="flex h-full w-full items-center justify-center">
      <span class="material-symbols-outlined text-[22px] text-white/45">image_not_supported</span>
    </div>

    <span
      v-if="photo.badge"
      class="photo-gallery__badge absolute bottom-1 left-1 z-[2] rounded-full px-[0.45rem] py-[0.1rem] font-body text-[0.62rem] font-[650] leading-[1.2] text-white"
    >
      {{ photo.badge }}
    </span>

    <div
      v-if="photo.kind === 'album'"
      class="photo-gallery__album absolute inset-x-0 bottom-0 z-[2] flex min-h-[3.4rem] flex-col justify-end gap-[0.18rem] pt-[1.7rem] px-[0.55rem] pb-[0.55rem] text-white text-left"
    >
      <span class="overflow-hidden font-body text-ellipsis whitespace-nowrap text-[0.78rem] font-[750] leading-[1.05]">{{ photo.albumTitle }}</span>
      <span class="overflow-hidden font-body text-ellipsis whitespace-nowrap text-[0.62rem] font-[560] leading-none text-white/70">{{ photo.albumCount }} รูป</span>
    </div>

    <div
      v-if="isProcessing"
      class="absolute inset-0 flex items-center justify-center bg-black/40 text-white"
    >
      <span class="material-symbols-outlined text-[22px] animate-spin">progress_activity</span>
    </div>

    <div
      v-else-if="photo.status === 'error'"
      class="absolute inset-0 flex items-center justify-center bg-black/40 text-white"
    >
      <span class="material-symbols-outlined text-[22px]">error</span>
    </div>
  </button>

  <button
    v-if="photo.removable"
    class="photo-gallery__remove absolute top-1 right-1 z-[2] inline-flex w-6 h-6 items-center justify-center rounded-full text-white"
    type="button"
    aria-label="ลบรูปภาพ"
    @click.stop="emit('remove', photo.id)"
  >
    <span class="material-symbols-outlined text-[14px]">close</span>
  </button>
</template>

<style scoped>
.photo-gallery__cell-button {
  -webkit-tap-highlight-color: transparent;
}

.photo-gallery__cell-button::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 0.12), transparent 32%),
    linear-gradient(0deg, rgb(0 0 0 / 0.22), transparent 42%);
  content: "";
  opacity: 0;
  transition: opacity 0.18s ease;
}

.photo-gallery__cell-button:active::after,
.photo-gallery__cell-button:focus-visible::after {
  opacity: 1;
}

.photo-gallery__cell-button img {
  transition: transform 0.25s ease, filter 0.25s ease;
}

.photo-gallery__cell-button:active img {
  transform: scale(1.035);
  filter: saturate(1.08) contrast(1.02);
}

.photo-gallery__badge,
.photo-gallery__remove {
  background: rgb(10 14 14 / 0.42);
  border: 1px solid rgb(255 255 255 / 0.22);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.22),
    0 8px 16px rgb(0 0 0 / 0.24);
  backdrop-filter: blur(14px) saturate(1.45);
  -webkit-backdrop-filter: blur(14px) saturate(1.45);
}

.photo-gallery__album {
  background: linear-gradient(0deg, rgb(0 0 0 / 0.7), transparent);
}
</style>
