<script setup>
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps({
  disabled:  { type: Boolean, default: false },
  threshold: { type: Number,  default: 80    },
})

const emit = defineEmits(['swipe-right', 'swipe-left'])

const cardRef = ref(null)
const wrapRef = ref(null)
const snapped  = ref('none')

let startX         = 0
let startTranslate = 0

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup',   onMouseUp)
})

// ── Outside-click to close left snap ──
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

// ── Gesture helpers ──
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

  // If already snapped — any further swipe just closes
  if (snapped.value !== 'none') { snapCard('none'); return }

  const direction = dx > props.threshold ? 'right' : dx < -props.threshold ? 'left' : 'none'

  if (direction === 'right') { snapCard('right'); emit('swipe-right'); return }
  if (direction === 'left')  { snapCard('left');  emit('swipe-left');  return }
  snapCard('none')
}

// ── Touch events ──
function onTouchStart(e) {
  if (props.disabled) return
  startX         = e.touches[0].clientX
  startTranslate = getTranslate()
}
function onTouchMove(e) {
  if (props.disabled) return
  setTranslate(startTranslate + e.touches[0].clientX - startX)
}
function onTouchEnd(e) {
  resolve(e.changedTouches[0].clientX - startX)
}

// ── Mouse events (desktop) ──
let onMouseMove = null
let onMouseUp   = null

function onMouseDown(e) {
  if (props.disabled) return
  startX         = e.clientX
  startTranslate = getTranslate()
  onMouseMove = (ev) => setTranslate(startTranslate + ev.clientX - startX)
  onMouseUp   = (ev) => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup',   onMouseUp)
    resolve(ev.clientX - startX)
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup',   onMouseUp)
}

// ── Expose snapCard so parent can reset snap after async work ──
defineExpose({ snapCard })
</script>

<template>
  <div ref="wrapRef" class="relative bg-surface-container-lowest">
    <div class="relative overflow-hidden">

      <!-- Swipe-right panel -->
      <div class="absolute inset-0 flex items-center px-5">
        <slot name="right-panel" :snapped="snapped" />
      </div>

      <!-- Swipe-left panel -->
      <div class="absolute inset-0 flex items-center justify-end px-5">
        <slot name="left-panel" :snapped="snapped" />
      </div>

      <!-- Card surface -->
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
