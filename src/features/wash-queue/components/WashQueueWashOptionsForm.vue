<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, toRaw, watch } from 'vue'
import type { WashProgramDto } from '@/data/wash-programs/wash-programs.service'
import type { WashProductDto } from '@/data/wash-products/wash-products.service'
import { markCustom, optionsMatchProgram, programToOptions, stepChips, stepLabel, washOptionsSummary, type WashOptions, type WashStep } from '../wash-options'
import WashStepEditor from './WashStepEditor.vue'
import './wash-program.css'
const props = defineProps<{ modelValue: WashOptions; programs: readonly WashProgramDto[]; products: readonly WashProductDto[]; productName: (id: string) => string }>()
const emit = defineEmits<{ 'update:modelValue': [value: WashOptions]; 'update:valid': [valid: boolean] }>()
let nextId = 0
const entries = ref(props.modelValue.steps.map((step) => ({ id: ++nextId, step })))
const openId = ref<number | null>(null)
const list = ref<HTMLElement | null>(null)
const draggingId = ref<number | null>(null)
const pressingId = ref<number | null>(null)
const offset = ref(0)
let expected: WashOptions | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let pointerId: number | null = null
let capture: HTMLElement | null = null
let scroller: HTMLElement | null = null
let previousOverflow = ''
let startX = 0
let startY = 0
let lastY = 0
let suppressClick = false
let originalOrder: number[] = []
watch(() => props.modelValue, (value) => {
  if (toRaw(value) === expected) entries.value = entries.value.map((entry, index) => ({ id: entry.id, step: value.steps[index]! }))
  else { entries.value = value.steps.map((step) => ({ id: ++nextId, step })); openId.value = null }
  expected = null
  emit('update:valid', entries.value.length > 0)
})
const programName = computed(() => props.programs.find((program) => program.id === props.modelValue.program)?.name ?? 'Custom')
const summaryTitle = computed(() => props.modelValue.program === 'CUSTOM' || !entries.value.length ? 'Custom' : programName.value)
const draftOptions = computed(() => ({ ...props.modelValue, steps: entries.value.map(({ step }) => step) }))
function commit(): void {
  emit('update:valid', entries.value.length > 0)
  if (!entries.value.length) return
  const program = props.programs.find((program) => program.id === props.modelValue.program)
  const options = draftOptions.value
  expected = program && optionsMatchProgram(options, program) ? options : markCustom(options)
  emit('update:modelValue', expected)
}
function select(program: WashProgramDto): void {
  openId.value = null
  expected = programToOptions(program)
  entries.value = expected.steps.map((step) => ({ id: ++nextId, step }))
  emit('update:valid', true)
  emit('update:modelValue', expected)
}
function update(id: number, step: WashStep): void {
  entries.value = entries.value.map((entry) => entry.id === id ? { id, step } : entry)
  commit()
}
function remove(id: number): void {
  entries.value = entries.value.filter((entry) => entry.id !== id)
  if (openId.value === id) openId.value = null
  commit()
}
async function add(): Promise<void> {
  const entry = { id: ++nextId, step: { type: 'rinse', products: [] } as WashStep }
  entries.value.push(entry); openId.value = entry.id; commit()
  await nextTick()
  list.value?.querySelector<HTMLElement>(`[data-id="${entry.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}
function toggle(id: number): void { if (!suppressClick) openId.value = openId.value === id ? null : id }
function keyboard(event: KeyboardEvent, id: number): void {
  if (event.target !== event.currentTarget) return
  if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    const from = entries.value.findIndex((entry) => entry.id === id)
    const to = from + (event.key === 'ArrowUp' ? -1 : 1)
    if (to < 0 || to >= entries.value.length) return
    const [entry] = entries.value.splice(from, 1); entries.value.splice(to, 0, entry!)
    openId.value = null; commit()
    void nextTick(() => list.value?.querySelector<HTMLElement>(`[data-id="${id}"]`)?.focus())
  } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(id) }
}
function cancelHold(): void { clearTimeout(timer); timer = undefined; pressingId.value = null; if (draggingId.value === null) capture = null }
function down(event: PointerEvent, id: number): void {
  if (!event.isPrimary || event.button !== 0 || (event.target as HTMLElement).closest('button, input, .step-ed')) return
  cancelHold()
  startX = event.clientX; startY = lastY = event.clientY; pointerId = event.pointerId
  capture = event.currentTarget as HTMLElement; pressingId.value = id
  timer = setTimeout(() => {
    draggingId.value = id; pressingId.value = null; openId.value = null; offset.value = 0
    originalOrder = entries.value.map((entry) => entry.id)
    scroller = list.value?.closest<HTMLElement>('.no-scrollbar') ?? null
    if (scroller) { previousOverflow = scroller.style.overflow; scroller.style.overflow = 'hidden' }
    capture?.setPointerCapture(event.pointerId)
  }, 380)
}
function move(event: PointerEvent): void {
  if (event.pointerId !== pointerId || !capture) return
  if (draggingId.value === null) {
    if (Math.abs(event.clientX - startX) > 8 || Math.abs(event.clientY - startY) > 8) cancelHold()
    return
  }
  event.preventDefault()
  offset.value += event.clientY - lastY; lastY = event.clientY
  const from = entries.value.findIndex((entry) => entry.id === draggingId.value)
  const direction = offset.value > 0 ? 1 : -1
  const to = from + direction
  const neighbour = list.value?.querySelector<HTMLElement>(`[data-id="${entries.value[to]?.id}"]`)
  if (neighbour && Math.abs(offset.value) > neighbour.offsetHeight / 2) {
    const height = neighbour.offsetHeight + 13
    const [entry] = entries.value.splice(from, 1); entries.value.splice(to, 0, entry!)
    offset.value -= direction * height
  }
}
function end(event?: PointerEvent): void {
  if (event && event.pointerId !== pointerId) return
  clearTimeout(timer); pressingId.value = null
  if (draggingId.value !== null) {
    if (capture && pointerId !== null && capture.hasPointerCapture(pointerId)) capture.releasePointerCapture(pointerId)
    if (scroller) scroller.style.overflow = previousOverflow
    draggingId.value = null; offset.value = 0
    suppressClick = true; setTimeout(() => { suppressClick = false }, 0)
    if (event?.type === 'pointercancel') entries.value.sort((a, b) => originalOrder.indexOf(a.id) - originalOrder.indexOf(b.id))
    else if (entries.value.some((entry, i) => entry.id !== originalOrder[i])) commit()
  }
  capture = null; pointerId = null; scroller = null
}
function touchmove(event: TouchEvent): void { if (draggingId.value !== null) event.preventDefault() }
onMounted(() => { emit('update:valid', entries.value.length > 0); list.value?.addEventListener('touchmove', touchmove, { passive: false }) })
onUnmounted(() => { end(); list.value?.removeEventListener('touchmove', touchmove) })
function icon(step: WashStep): string {
  return step.type === 'soak' && step.duration === 'overnight' ? 'bedtime' : { stain_removal: 'cleaning_services', quick_wash: 'bolt', normal_wash: 'local_laundry_service', rinse: 'water_drop', soak: 'hourglass_bottom' }[step.type]
}
</script>
<template>
  <section class="wq-options pb-4">
    <div class="sec"><div class="bar" /><div class="tt"><h3>Wash program</h3><small>Pick a program, then shape the steps</small></div><span v-if="modelValue.program === 'CUSTOM' || !entries.length" class="cpill">Custom</span></div>
    <div class="presets"><button v-for="program in programs" :key="program.id" type="button" class="preset" :class="{ on: modelValue.program === program.id && entries.length > 0 }" :aria-pressed="modelValue.program === program.id && entries.length > 0" @click="select(program)"><span class="dot"><span class="ms" aria-hidden="true">check</span></span><span class="ms fill" aria-hidden="true">local_laundry_service</span><b>{{ program.name }}</b><small>{{ program.steps.length }} steps</small></button></div>
    <div class="sum-col"><div class="sum" :class="{ custom: modelValue.program === 'CUSTOM' || !entries.length }" aria-live="polite"><span class="tab">Program</span><div class="sum-line"><b>{{ summaryTitle }}</b>{{ washOptionsSummary(entries.length ? draftOptions : { program: 'CUSTOM', steps: [] }, programName).slice(summaryTitle.length) }}</div></div></div>
    <p class="drag-hint">Tap a step to edit. Press and hold, then drag to reorder.</p>
    <div ref="list" class="steps" :class="{ 'drag-mode': draggingId !== null }">
      <TransitionGroup name="reorder">
        <article v-for="(entry, index) in entries" :key="entry.id" :data-id="entry.id" class="step" :class="{ open: openId === entry.id, dragging: draggingId === entry.id, pressing: pressingId === entry.id }" :style="draggingId === entry.id ? { transform: `translateY(${offset}px) rotate(-1deg)` } : undefined" tabindex="0" :aria-label="`Step ${index + 1}, ${stepLabel(entry.step.type)}. Alt and arrow keys to reorder.`" @keydown="keyboard($event, entry.id)" @pointerdown="down($event, entry.id)" @pointermove="move" @pointerup="end" @pointercancel="end" @lostpointercapture="end">
          <div class="step-top"><div class="step-tap" role="button" tabindex="0" :aria-expanded="openId === entry.id" :aria-label="`Edit step ${index + 1}, ${stepLabel(entry.step.type)}`" @click="toggle(entry.id)" @keydown="keyboard($event, entry.id)"><span class="num">{{ index + 1 }}</span><span class="ttl"><span class="ms" aria-hidden="true">{{ icon(entry.step) }}</span>{{ stepLabel(entry.step.type) }}</span></div><button type="button" class="ibtn del" :aria-label="`Delete step ${index + 1}`" @click="remove(entry.id)"><svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true"><path d="m8 8 12 12M20 8 8 20" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" /></svg></button></div>
          <div class="step-chips chips" @click="toggle(entry.id)"><span v-for="(chip, i) in stepChips(entry.step, productName)" :key="i" class="chip" :class="{ temp: i === 0 && 'temperature' in entry.step, dur: i === 0 && entry.step.type === 'soak', none: chip === 'By hand' || chip === 'Water only' || chip === 'No product' }">{{ chip }}</span></div>
          <WashStepEditor v-if="openId === entry.id && draggingId === null" :step="entry.step" :products="products" :product-name="productName" @update="update(entry.id, $event)" />
        </article>
      </TransitionGroup>
      <div v-if="!entries.length" class="empty">No steps yet. Add one below.</div>
      <button type="button" class="add" :disabled="entries.length >= 20" @click="add"><span class="ms" aria-hidden="true">add</span>Add step</button>
    </div>
  </section>
</template>
<style scoped>
.reorder-move{transition:transform 160ms}.reorder-leave-active{display:none}.dragging{transition:none!important}.add:disabled{opacity:.5}
</style>
