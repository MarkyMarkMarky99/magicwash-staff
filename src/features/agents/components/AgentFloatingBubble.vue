<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { AgentId } from '../agent-chat.types'
import {
  BUBBLE_DRAG_THRESHOLD,
  BUBBLE_MARGIN,
  bubbleLeft,
  clampBubbleY,
  parseBubblePosition,
  readStored,
  snapSide,
  writeStored,
  type BubblePosition,
} from '../utils/agent-bubble'
import AgentAvatar from './AgentAvatar.vue'

const props = defineProps<{ agentId: AgentId; name: string; text: string; count: number }>()
const emit = defineEmits<{ open: []; dismiss: [] }>()

const POSITION_KEY = 'agent-bubble-position'
const AVATAR_SIZE = 56
const GROUP_GAP = 8
const BOTTOM_NAV_RESERVE = 88
const MAX_BUBBLE_WIDTH = 240

const root = ref<HTMLElement | null>(null)
const group = ref<HTMLElement | null>(null)
const safeAreaProbe = ref<HTMLElement | null>(null)
const container = ref({ width: 0, height: 0 })
const groupHeight = ref(AVATAR_SIZE)
const safeBottom = ref(0)
const position = ref<BubblePosition>(parseBubblePosition(readStored(POSITION_KEY)) ?? { side: 'right', y: Number.MAX_SAFE_INTEGER })
const dragPosition = ref<{ left: number; top: number } | null>(null)

const bubbleWidth = computed(() => Math.max(120, Math.min(MAX_BUBBLE_WIDTH, container.value.width - AVATAR_SIZE - GROUP_GAP - BUBBLE_MARGIN * 2)))
const groupWidth = computed(() => AVATAR_SIZE + GROUP_GAP + bubbleWidth.value)
const bounds = computed(() => ({ width: container.value.width, height: container.value.height, top: 0, bottom: BOTTOM_NAV_RESERVE + safeBottom.value }))
const ready = computed(() => container.value.width > 0)
const side = computed(() => dragPosition.value ? snapSide(dragPosition.value.left, groupWidth.value, container.value.width) : position.value.side)
const left = computed(() => dragPosition.value?.left ?? bubbleLeft(position.value.side, groupWidth.value, container.value.width))
const top = computed(() => dragPosition.value?.top ?? clampBubbleY(position.value.y, groupHeight.value, bounds.value))
const showCount = computed(() => props.count > 1)

let observer: ResizeObserver | null = null

function measure(): void {
  if (root.value) container.value = { width: root.value.clientWidth, height: root.value.clientHeight }
  if (group.value) groupHeight.value = group.value.offsetHeight
  if (safeAreaProbe.value) safeBottom.value = safeAreaProbe.value.offsetHeight
}

onMounted(async () => {
  measure()
  observer = new ResizeObserver(measure)
  if (root.value) observer.observe(root.value)
  await nextTick()
  if (group.value) observer.observe(group.value)
  measure()
})
onBeforeUnmount(() => observer?.disconnect())

type Drag = { pointerId: number; startX: number; startY: number; originLeft: number; originTop: number; moved: boolean }
let drag: Drag | null = null
let suppressClick = false

function onPointerDown(event: PointerEvent): void {
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
  drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originLeft: left.value, originTop: top.value, moved: false }
}

function onPointerMove(event: PointerEvent): void {
  if (!drag || drag.pointerId !== event.pointerId) return
  const dx = event.clientX - drag.startX
  const dy = event.clientY - drag.startY
  if (!drag.moved) {
    if (Math.hypot(dx, dy) < BUBBLE_DRAG_THRESHOLD) return
    drag.moved = true
    try {
      group.value?.setPointerCapture(event.pointerId)
    } catch {
      // The pointer is already gone; the drag still follows move events over the group.
    }
  }
  const maxLeft = Math.max(BUBBLE_MARGIN, container.value.width - groupWidth.value - BUBBLE_MARGIN)
  dragPosition.value = {
    left: Math.min(Math.max(drag.originLeft + dx, BUBBLE_MARGIN), maxLeft),
    top: clampBubbleY(drag.originTop + dy, groupHeight.value, bounds.value),
  }
}

function endDrag(event: PointerEvent, commit: boolean): void {
  if (!drag || drag.pointerId !== event.pointerId) return
  const finished = drag
  drag = null
  if (!finished.moved) return
  suppressClick = true
  setTimeout(() => { suppressClick = false }, 100)
  const dropped = dragPosition.value
  dragPosition.value = null
  if (!commit || !dropped) return
  position.value = { side: snapSide(dropped.left, groupWidth.value, container.value.width), y: dropped.top }
  writeStored(POSITION_KEY, JSON.stringify(position.value))
}

function onOpen(): void {
  if (suppressClick) return
  emit('open')
}
</script>

<template>
  <div ref="root" class="pointer-events-none absolute inset-0 z-[55]">
    <div ref="safeAreaProbe" class="pointer-events-none invisible absolute bottom-0 left-0 h-[env(safe-area-inset-bottom)] w-px" aria-hidden="true" />
    <div
      v-if="ready"
      ref="group"
      role="group"
      aria-label="New message from AI"
      class="agent-bubble pointer-events-auto absolute flex select-none items-center gap-2 [touch-action:none]"
      :class="[side === 'right' ? 'flex-row-reverse' : '', dragPosition ? '' : 'transition-[left,top] duration-200 ease-out motion-reduce:transition-none']"
      :style="{ left: `${left}px`, top: `${top}px`, width: `${groupWidth}px` }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endDrag($event, true)"
      @pointercancel="endDrag($event, false)"
    >
      <div class="relative shrink-0" :style="{ width: `${AVATAR_SIZE}px`, height: `${AVATAR_SIZE}px` }">
        <button type="button" class="block rounded-full shadow-[0_4px_14px_color-mix(in_srgb,var(--color-on-surface)_25%,transparent)] ring-2 ring-white focus-visible:outline-2 focus-visible:outline-lime" :aria-label="`Open ${name}`" @click="onOpen">
          <AgentAvatar :agent-id="agentId" :size="AVATAR_SIZE" />
        </button>
        <span v-if="showCount" class="pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-error px-1.5 text-[11px] font-bold leading-none text-on-error ring-2 ring-white" :aria-label="`${count} unread`">{{ count > 99 ? '99+' : count }}</span>
      </div>
      <div class="relative min-w-0 flex-1">
        <button
          type="button"
          class="block w-full bg-white py-2 pl-3 pr-8 text-left shadow-[0_4px_14px_color-mix(in_srgb,var(--color-on-surface)_20%,transparent)] focus-visible:outline-2 focus-visible:outline-lime"
          :class="side === 'right' ? 'rounded-[18px_6px_18px_18px]' : 'rounded-[6px_18px_18px_18px]'"
          @click="onOpen"
        >
          <span class="block truncate font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-primary">{{ name }}</span>
          <span class="mt-0.5 line-clamp-3 block font-body text-[13px] leading-snug text-on-surface [overflow-wrap:anywhere]">{{ text }}</span>
        </button>
        <button type="button" class="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant focus-visible:outline-2 focus-visible:outline-lime" aria-label="Dismiss" @pointerdown.stop @click.stop="emit('dismiss')">
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .agent-bubble {
    animation: agent-bubble-in 220ms ease-out;
  }
}

@keyframes agent-bubble-in {
  from {
    opacity: 0;
    scale: 0.94;
  }
}
</style>
