<script setup>
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps({
  disabled:  { type: Boolean, default: false },
  swipeable: { type: Boolean, default: true  },
  pressable: { type: Boolean, default: false },
  threshold: { type: Number,  default: 80    },
  leftActions: Number,
  rightActions: Number,
})

const emit = defineEmits(['swipe-right', 'swipe-left', 'tap'])

const cardRef = ref(null)
const wrapRef = ref(null)
const snapped  = ref('none')

let startX         = 0
let startY         = 0
let lockX          = 0
let axis           = 'pending' // 'pending' until the finger passes DRAG_SLOP, then 'x' (swipe) or 'y' (page scroll)
let startTranslate = 0
let startSnapped    = 'none'
let maxMovement     = 0
const TAP_THRESHOLD = 8
const DRAG_SLOP = 10
const ACTION_WIDTH_REM = 4

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup',   onMouseUp)
})

watch(snapped, (val) => {
  if (val !== 'left') return
  const onOutside = (e) => {
    if (wrapRef.value && !wrapRef.value.contains(e.target)) {
      snapCard('none')
      document.removeEventListener('pointerdown', onOutside, true)
    }
  }
  document.addEventListener('pointerdown', onOutside, true)
})

function getTranslate() {
  if (!cardRef.value) return 0
  return new DOMMatrix(window.getComputedStyle(cardRef.value).transform).m41
}
function setTranslate(px) {
  if (!cardRef.value) return
  cardRef.value.style.transition = 'none'
  cardRef.value.style.transform  = `translateX(${px}px)`
}
function snapCard(direction) {
  if (!cardRef.value) return
  cardRef.value.style.transition = 'transform 0.25s ease'
  cardRef.value.style.transform  = ''
  snapped.value = direction
}

function resolve(dx) {
  if (props.disabled) return

  if (axis === 'y') return

  if (snapped.value !== 'none') { snapCard('none'); return }

  if (props.swipeable) {
    const direction = dx > props.threshold ? 'right' : dx < -props.threshold ? 'left' : 'none'

    if (direction === 'right') { snapCard('right'); emit('swipe-right'); return }
    if (direction === 'left')  { snapCard('left');  emit('swipe-left');  return }
  }
  snapCard('none')
  if (startSnapped === 'none' && Math.max(maxMovement, Math.abs(dx)) <= TAP_THRESHOLD) emit('tap')
}

function beginGesture(x, y) {
  startX         = x
  startY         = y
  axis           = 'pending'
  if (props.swipeable) startTranslate = getTranslate()
  startSnapped   = snapped.value
  maxMovement    = 0
}
function moveGesture(x, y) {
  const dx = x - startX
  const dy = y - startY
  maxMovement = Math.max(maxMovement, Math.hypot(dx, dy))
  if (axis === 'pending') {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_SLOP) return
    axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    lockX = x
  }
  if (axis === 'x' && props.swipeable) setTranslate(startTranslate + x - lockX)
}
function gestureDx(x) {
  return axis === 'x' ? x - lockX : x - startX
}

function onTouchStart(e) {
  if (props.disabled) return
  beginGesture(e.touches[0].clientX, e.touches[0].clientY)
}
function onTouchMove(e) {
  if (props.disabled) return
  moveGesture(e.touches[0].clientX, e.touches[0].clientY)
}
function onTouchEnd(e) {
  // A touch that ends on this card has already been interpreted as a tap or a
  // swipe by the logic above. Left alone, the browser still fires its normal
  // compatibility `click` afterwards at the same coordinates — and once the
  // tap has navigated (e.g. to a page served instantly from cache), that
  // click lands on whatever is now under the finger on the NEW page and
  // activates it too. preventDefault() on touchend cancels that trailing
  // click for this touch, so the gesture is consumed exactly once. Buttons
  // in the swipe-revealed side panels are unaffected: they are separate
  // elements outside this card, and a tap on them is its own touch
  // interaction with its own touchstart/touchend, not this one.
  if (axis === 'y') return
  if (e.cancelable) e.preventDefault()
  resolve(gestureDx(e.changedTouches[0].clientX))
}

let onMouseMove = null
let onMouseUp   = null

function onMouseDown(e) {
  if (props.disabled) return
  beginGesture(e.clientX, e.clientY)
  onMouseMove = (ev) => moveGesture(ev.clientX, ev.clientY)
  onMouseUp   = (ev) => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup',   onMouseUp)
    resolve(gestureDx(ev.clientX))
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup',   onMouseUp)
}

function onKeydown(e) {
  if (!props.pressable || props.disabled) return
  if (e.target !== e.currentTarget) return
  if (e.key !== 'Enter' && e.key !== ' ') return
  if (e.key === ' ') e.preventDefault()
  emit('tap')
}

defineExpose({ snapCard })
</script>

<template>
  <div
    ref="wrapRef"
    :style="{
      ...(leftActions !== undefined ? { '--snap-left': `calc(${leftActions} * ${ACTION_WIDTH_REM}rem)` } : {}),
      ...(rightActions !== undefined ? { '--snap-right': `calc(${rightActions} * ${ACTION_WIDTH_REM}rem)` } : {}),
    }"
    :class="[
      'relative bg-surface-container-lowest',
      pressable ? 'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-lime' : '',
    ].join(' ')"
    :role="pressable ? 'button' : undefined"
    :tabindex="pressable ? 0 : undefined"
    @keydown="onKeydown"
  >
    <div class="relative overflow-hidden">

      <div class="absolute inset-0 flex items-center px-5">
        <slot name="right-panel" :snapped="snapped" />
      </div>

      <div class="absolute inset-0 flex items-center justify-end px-5">
        <slot name="left-panel" :snapped="snapped" />
      </div>

      <div
        ref="cardRef"
        :class="[
          'swipe-card relative z-10 touch-pan-y bg-surface-container-lowest transition-colors',
          disabled
            ? 'cursor-wait bg-surface-container'
            : `${swipeable || pressable ? 'hover:bg-surface-container-low' : ''} ${swipeable ? 'cursor-grab active:cursor-grabbing' : pressable ? 'cursor-pointer' : ''}`,
          snapped === 'right' ? 'swiped-right' : snapped === 'left' ? 'swiped-left' : '',
        ].join(' ')"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @mousedown="onMouseDown"
      >
        <slot :snapped="snapped" :disabled="disabled" />
      </div>

    </div>
  </div>
</template>
