<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'

const props = withDefaults(defineProps<{
  suspended?: boolean
  panelClass?: string
}>(), {
  suspended: false,
  panelClass: '',
})

const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
type PanelPosition = { right: string; maxHeight: string; top?: string; bottom?: string }
const position = ref<PanelPosition | null>(null)

// A dropdown opened near the bottom of the viewport has to flip above its trigger. maxHeight
// has a 96px floor, not a ceiling, and most callers clip rather than scroll their panel, so
// anchoring downward into 20px of free room silently cut the last row off the menu.
const MIN_PANEL_SPACE = 160
const panelId = `base-dropdown-${useId()}`

const triggerAttrs = computed(() => ({
  'aria-controls': panelId,
  'aria-expanded': open.value,
}))

// Matches Vue's VNodeRef callback signature: a template ref can hand back a
// component instance, not just an element, so the wider parameter is required
// for `:ref="setTrigger"` to type-check at every call site.
function setTrigger(element: Element | ComponentPublicInstance | null) {
  triggerRef.value = element instanceof HTMLElement ? element : null
}

function openPopover() {
  const rect = triggerRef.value?.getBoundingClientRect()
  if (!rect) return

  const right = `${Math.max(8, window.innerWidth - rect.right)}px`
  const spaceBelow = window.innerHeight - rect.bottom - 16
  const spaceAbove = rect.top - 16

  position.value = spaceBelow < MIN_PANEL_SPACE && spaceAbove > spaceBelow
    ? { right, bottom: `${window.innerHeight - rect.top + 6}px`, maxHeight: `${Math.max(96, spaceAbove)}px` }
    : { right, top: `${rect.bottom + 6}px`, maxHeight: `${Math.max(96, spaceBelow)}px` }
  open.value = true
}

function close(refocus = false) {
  open.value = false
  if (refocus) triggerRef.value?.focus()
}

function toggle() {
  if (open.value) {
    close()
    return
  }

  openPopover()
}

function dismiss() {
  close()
}

function onPointerDown(event: PointerEvent) {
  const target = event.target as Node
  if (panelRef.value?.contains(target) || triggerRef.value?.contains(target)) return
  close()
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') close(true)
}

watch([open, () => props.suspended], ([isOpen, isSuspended], _, onCleanup) => {
  if (!isOpen || isSuspended) return

  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('scroll', dismiss, true)
  window.addEventListener('resize', dismiss)

  onCleanup(() => {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('scroll', dismiss, true)
    window.removeEventListener('resize', dismiss)
  })
})

onBeforeUnmount(() => close())
</script>

<template>
  <slot
    name="trigger"
    :open="open"
    :toggle="toggle"
    :set-trigger="setTrigger"
    :trigger-attrs="triggerAttrs"
  />

  <Teleport to="body">
    <div
      v-if="open && position"
      :id="panelId"
      ref="panelRef"
      class="fixed z-[60]"
      :class="panelClass"
      :style="position"
    >
      <slot :close="close" />
    </div>
  </Teleport>
</template>
