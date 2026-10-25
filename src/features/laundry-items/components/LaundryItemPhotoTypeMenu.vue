<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import StickerFab from '@/shared/components/StickerFab.vue'
import { garmentPhotoTypeHint, garmentPhotoTypeIcon, garmentPhotoTypeOptions, type GarmentPhotoType } from '../utils/laundry-item-detail'

defineProps<{ destination: string, saving: boolean }>()
const emit = defineEmits<{ select: [type: GarmentPhotoType] }>()

const options = garmentPhotoTypeOptions()
const open = ref(false)
const root = ref<HTMLElement | null>(null)

function onPointerDown(event: PointerEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
}

function choose(type: GarmentPhotoType): void {
  open.value = false
  emit('select', type)
}

watch(open, (isOpen, _, onCleanup) => {
  if (!isOpen) return
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeyDown)
  onCleanup(() => {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKeyDown)
  })
})

onBeforeUnmount(() => { open.value = false })
</script>

<template>
  <div ref="root" class="relative">
    <StickerFab
      size="sm"
      label="Add"
      aria-label="Add photo"
      saving-label="Saving"
      :saving="saving"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="open = !open"
    >
      <span class="material-symbols-outlined text-[22px]" aria-hidden="true">add_a_photo</span>
    </StickerFab>
    <Transition name="photo-type-menu">
      <div v-if="open" class="menu" role="menu" aria-label="Add photo">
        <p class="destination" role="presentation">Saves to: {{ destination }}</p>
        <button v-for="option in options" :key="option.value" type="button" role="menuitem" class="row" @click="choose(option.value)">
          <span class="row__icon"><span class="material-symbols-outlined text-[20px]" aria-hidden="true">{{ garmentPhotoTypeIcon(option.value) }}</span></span>
          <span class="min-w-0 flex-1">
            <b class="block text-sm font-extrabold">{{ option.label }}</b>
            <small v-if="garmentPhotoTypeHint(option.value)" class="mt-px block text-[11.5px] text-on-surface-variant">{{ garmentPhotoTypeHint(option.value) }}</small>
          </span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.menu {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  z-index: 30;
  width: 280px;
  overflow: hidden;
  border: 2px solid var(--color-primary);
  border-radius: 16px;
  background: white;
  box-shadow: 4px 4px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  transform-origin: top right;
}

.destination {
  padding: 10px 14px 8px;
  font-size: 11.5px;
  font-weight: 800;
  color: var(--color-on-surface-variant);
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border-top: 1px solid var(--color-outline-variant);
  text-align: left;
}

.row:active {
  background: var(--color-surface-container-low);
}

.row:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: -2px;
}

.row__icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
}

.photo-type-menu-enter-active,
.photo-type-menu-leave-active {
  transition: transform 150ms ease-out, opacity 150ms ease-out;
}

.photo-type-menu-enter-from,
.photo-type-menu-leave-to {
  opacity: 0;
  transform: scale(.6);
}

@media (prefers-reduced-motion: reduce) {
  .photo-type-menu-enter-active,
  .photo-type-menu-leave-active {
    transition: none;
  }
}
</style>
