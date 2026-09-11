<script setup>
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps({
  disabled:  { type: Boolean, default: false },
  threshold: { type: Number,  default: 80    },
})

const emit = defineEmits(['swipe-right', 'swipe-left', 'tap'])

const cardRef = ref(null)
const wrapRef = ref(null)
const snapped  = ref('none')

let startX         = 0
let startTranslate = 0
let startSnapped    = 'none'
let maxMovement     = 0
const TAP_THRESHOLD = 8

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

  if (snapped.value !== 'none') { snapCard('none'); return }

  const direction = dx > props.threshold ? 'right' : dx < -props.threshold ? 'left' : 'none'

  if (direction === 'right') { snapCard('right'); emit('swipe-right'); return }
  if (direction === 'left')  { snapCard('left');  emit('swipe-left');  return }
  snapCard('none')
  if (startSnapped === 'none' && Math.max(maxMovement, Math.abs(dx)) <= TAP_THRESHOLD) emit('tap')
}

function onTouchStart(e) {
  if (props.disabled) return
  startX         = e.touches[0].clientX
  startTranslate = getTranslate()
  startSnapped   = snapped.value
  maxMovement    = 0
}
function onTouchMove(e) {
  if (props.disabled) return
  const dx = e.touches[0].clientX - startX
  maxMovement = Math.max(maxMovement, Math.abs(dx))
  setTranslate(startTranslate + dx)
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
  if (e.cancelable) e.preventDefault()
  resolve(e.changedTouches[0].clientX - startX)
}

let onMouseMove = null
let onMouseUp   = null

function onMouseDown(e) {
  if (props.disabled) return
  startX         = e.clientX
  startTranslate = getTranslate()
  startSnapped   = snapped.value
  maxMovement    = 0
  onMouseMove = (ev) => {
    const dx = ev.clientX - startX
    maxMovement = Math.max(maxMovement, Math.abs(dx))
    setTranslate(startTranslate + dx)
  }
  onMouseUp   = (ev) => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup',   onMouseUp)
    resolve(ev.clientX - startX)
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup',   onMouseUp)
}

defineExpose({ snapCard })
</script>

<template>
  <div ref="wrapRef" class="relative bg-surface-container-lowest">
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
          'swipe-card relative z-10 bg-surface-container-lowest transition-colors',
          disabled
            ? 'cursor-wait bg-surface-container'
            : 'hover:bg-surface-container-low cursor-grab active:cursor-grabbing',
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
