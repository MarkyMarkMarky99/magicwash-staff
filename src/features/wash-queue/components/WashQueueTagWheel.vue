<script setup lang="ts">
import { nextTick, onUnmounted, ref } from 'vue'
import { washQueueTagCodes } from '@contracts/wash-queue/wash-queue-api.schema'

// Sits inside the square photo preview (position: relative; overflow: hidden). The label is the
// selection window: when open, the letters scroll vertically through it and fade with distance.
const props = defineProps<{ modelValue: string | null; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [tagCode: string] }>()
const ROW = 52
const open = ref(false)
const wheel = ref<HTMLElement | null>(null)
let settle: ReturnType<typeof setTimeout> | undefined

function indexOf(code: string | null): number {
  const index = code ? washQueueTagCodes.indexOf(code as typeof washQueueTagCodes[number]) : -1
  return index < 0 ? 0 : index
}
async function show(): Promise<void> {
  if (props.disabled) return
  open.value = true
  if (props.modelValue === null) emit('update:modelValue', washQueueTagCodes[0])
  await nextTick()
  if (wheel.value) {
    wheel.value.scrollTop = indexOf(props.modelValue) * ROW
    wheel.value.focus({ preventScroll: true })
  }
}
function hide(): void {
  clearTimeout(settle)
  open.value = false
}
function scrolled(): void {
  clearTimeout(settle)
  settle = setTimeout(() => {
    if (!wheel.value) return
    const index = Math.min(washQueueTagCodes.length - 1, Math.max(0, Math.round(wheel.value.scrollTop / ROW)))
    const code = washQueueTagCodes[index]!
    if (code !== props.modelValue) emit('update:modelValue', code)
  }, 90)
}
function pick(index: number): void {
  if (washQueueTagCodes[index] === props.modelValue) { hide(); return }
  wheel.value?.scrollTo({ top: index * ROW, behavior: 'smooth' })
}
function keyboard(event: KeyboardEvent): void {
  if (event.key === 'Escape' || event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); hide(); return }
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
  event.preventDefault()
  const next = Math.min(washQueueTagCodes.length - 1, Math.max(0, indexOf(props.modelValue) + (event.key === 'ArrowUp' ? -1 : 1)))
  wheel.value?.scrollTo({ top: next * ROW, behavior: 'smooth' })
}
onUnmounted(() => clearTimeout(settle))
</script>

<template>
  <div v-if="open" class="wq-tag__dim" aria-hidden="true" @click="hide" />
  <button
    type="button"
    class="wq-tag__label"
    :class="{ open, need: modelValue === null }"
    :disabled="disabled"
    :aria-label="modelValue ? `Tag ${modelValue}. Change` : 'Choose a tag'"
    aria-haspopup="listbox"
    :aria-expanded="open"
    @click="open ? hide() : show()"
  >
    <span class="wq-tag__cap">Tag</span>
    <b v-if="!open">{{ modelValue ?? '?' }}</b>
  </button>
  <template v-if="open">
    <ul ref="wheel" class="wq-tag__wheel" role="listbox" aria-label="Tag letter" tabindex="0" :aria-activedescendant="`wq-tag-${modelValue}`" @scroll="scrolled" @keydown="keyboard">
      <li v-for="(code, index) in washQueueTagCodes" :id="`wq-tag-${code}`" :key="code" role="option" :aria-selected="code === modelValue" @click="pick(index)">{{ code }}</li>
    </ul>
    <button type="button" class="wq-tag__done" aria-label="Done" @click="hide"><span class="material-symbols-outlined" aria-hidden="true">check</span></button>
  </template>
</template>

<style scoped>
/* Label: same sticker family as the weight field's kg badge. Centre sits 46px from the photo top. */
.wq-tag__label {
  position: absolute;
  z-index: 3;
  left: 12px;
  top: 12px;
  width: 60px;
  height: 68px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-primary);
  border-radius: 11px 15px 12px 14px;
  background: #fff;
  color: var(--color-primary);
  box-shadow: 4px 4px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  transform: rotate(-4deg);
}

.wq-tag__label:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: 2px;
}

.wq-tag__cap {
  position: absolute;
  top: 6px;
  font: 800 9px/1 var(--font-body);
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
}

.wq-tag__label b {
  margin-top: 8px;
  font: 800 36px/1 var(--font-headline);
}

.wq-tag__label.need b {
  color: var(--color-warning);
}

.wq-tag__label.need:not(:disabled) {
  animation: wq-tag-nudge 2.4s ease-in-out infinite;
}

.wq-tag__label.open {
  transform: none;
  background: var(--color-primary);
}

.wq-tag__label.open .wq-tag__cap {
  color: var(--color-lime);
}

.wq-tag__dim {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: rgb(0 0 0 / 40%);
}

/* Snap rows start 20px down, so the selected row (52px) is centred on the label (46px). */
.wq-tag__wheel {
  position: absolute;
  z-index: 4;
  left: 12px;
  top: 0;
  width: 60px;
  height: 100%;
  margin: 0;
  padding: 20px 0 calc(100% - 72px);
  list-style: none;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-snap-type: y mandatory;
  scroll-padding-top: 20px;
  scrollbar-width: none;
  outline: none;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, rgb(0 0 0 / 60%) 18px, #000 30px, #000 74px, rgb(0 0 0 / 45%) 130px, rgb(0 0 0 / 15%) 200px, transparent 270px);
  mask-image: linear-gradient(to bottom, transparent 0, rgb(0 0 0 / 60%) 18px, #000 30px, #000 74px, rgb(0 0 0 / 45%) 130px, rgb(0 0 0 / 15%) 200px, transparent 270px);
}

.wq-tag__wheel::-webkit-scrollbar {
  display: none;
}

.wq-tag__wheel li {
  height: 52px;
  display: grid;
  place-items: center;
  padding-top: 8px;
  scroll-snap-align: start;
  color: #fff;
  font: 800 36px/1 var(--font-headline);
  text-shadow: 0 1px 6px rgb(0 0 0 / 45%);
  cursor: pointer;
}

.wq-tag__wheel li[aria-selected="true"] {
  color: var(--color-lime);
  text-shadow: none;
}

.wq-tag__done {
  position: absolute;
  z-index: 5;
  left: 84px;
  top: 28px;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--color-lime);
  color: var(--color-primary);
  box-shadow: 0 2px 8px rgb(0 0 0 / 30%);
}

.wq-tag__done .material-symbols-outlined {
  font-size: 22px;
}

@keyframes wq-tag-nudge {
  0%, 58%, 100% { transform: rotate(-4deg) scale(1); }
  64% { transform: rotate(-10deg) scale(1.06); }
  70% { transform: rotate(2deg) scale(1.06); }
  78% { transform: rotate(-4deg) scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .wq-tag__label.need:not(:disabled) {
    animation: none;
  }
}
</style>
