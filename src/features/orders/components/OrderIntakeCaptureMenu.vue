<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import StickerFab from '@/shared/components/StickerFab.vue'
import { orderIntakeCategories, type OrderIntakeCategory } from '@/features/orders/utils/order-intake-draft'

defineProps<{ counts: Record<OrderIntakeCategory, number> }>()
const emit = defineEmits<{ select: [category: OrderIntakeCategory] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

function onPointerDown(event: PointerEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
}

function choose(category: OrderIntakeCategory): void {
  open.value = false
  emit('select', category)
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
      class="[&_.sticker-label]:hidden"
      label="Take photo"
      aria-label="Take photo"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="open = !open"
    >
      <span class="material-symbols-outlined text-[24px]" aria-hidden="true">photo_camera</span>
    </StickerFab>
    <Transition name="capture-menu">
      <div v-if="open" class="menu" role="menu" aria-label="Take photo">
        <button v-for="category in orderIntakeCategories" :key="category.key" type="button" role="menuitem" class="row" @click="choose(category.key)">
          <span class="row__icon"><span class="material-symbols-outlined text-[20px]" aria-hidden="true">{{ category.icon }}</span></span>
          <span class="min-w-0 flex-1">
            <b class="block text-sm font-extrabold">{{ category.name }}</b>
            <small class="mt-px block text-[11.5px] text-on-surface-variant">{{ category.hint }}</small>
          </span>
          <span class="row__count">{{ counts[category.key] }}</span>
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

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border-top: 1px solid var(--color-outline-variant);
  text-align: left;
}

.row:first-child {
  border-top: 0;
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

.row__count {
  font-family: var(--font-headline);
  font-size: 16px;
  font-weight: 800;
  color: var(--color-primary);
}

.capture-menu-enter-active,
.capture-menu-leave-active {
  transition: transform 150ms ease-out, opacity 150ms ease-out;
}

.capture-menu-enter-from,
.capture-menu-leave-to {
  opacity: 0;
  transform: scale(.6);
}

@media (prefers-reduced-motion: reduce) {
  .capture-menu-enter-active,
  .capture-menu-leave-active {
    transition: none;
  }
}
</style>
