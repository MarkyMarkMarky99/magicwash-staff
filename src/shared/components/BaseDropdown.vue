<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'

const props = withDefaults(defineProps<{
  suspended?: boolean
  panelClass?: string
}>(), {
  suspended: false,
  panelClass: '',
})

const open = ref(false)
const triggerRef = ref<Element | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const position = ref<{ right: string; top: string; maxHeight: string } | null>(null)
const panelId = `base-dropdown-${useId()}`

const triggerAttrs = computed(() => ({
  'aria-controls': panelId,
  'aria-expanded': String(open.value),
}))

function setTrigger(element: Element | null) {
  triggerRef.value = element
}

function openPopover() {
  const rect = triggerRef.value?.getBoundingClientRect()
  if (!rect) return

  position.value = {
    right: `${Math.max(8, window.innerWidth - rect.right)}px`,
    top: `${rect.bottom + 6}px`,
    maxHeight: `${Math.max(96, window.innerHeight - rect.bottom - 16)}px`,
  }
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
