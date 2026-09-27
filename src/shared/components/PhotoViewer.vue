<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useSlots, watch } from 'vue'
import PhotoSwipe from 'photoswipe'
import type { SlideData } from 'photoswipe'
import 'photoswipe/style.css'
import CloseButton from '@/shared/components/CloseButton.vue'

export interface PhotoViewerImage {
  id: string
  src: string
  alt: string
}

const props = defineProps<{
  images: readonly PhotoViewerImage[]
  activeId: string | null
}>()

const emit = defineEmits<{
  change: [id: string]
  close: []
}>()

const FALLBACK_SIZE = { width: 1200, height: 1600 }
const THUMB_STRIP_SPACE = 96
const TOP_BAR_SPACE = 64
const FOOTER_SPACE = 88

const slots = useSlots()

const host = ref<HTMLElement | null>(null)
const strip = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const index = ref(0)
const sizes = new Map<string, { width: number, height: number }>()
let pswp: PhotoSwipe | null = null
let slides: SlideData[] = []
let opening = false

function measure(src: string): Promise<void> {
  if (sizes.has(src)) return Promise.resolve()
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      if (image.naturalWidth > 0) sizes.set(src, { width: image.naturalWidth, height: image.naturalHeight })
      resolve()
    }
    image.onerror = () => resolve()
    image.src = src
  })
}

function slideFor(image: PhotoViewerImage): SlideData {
  return { src: image.src, alt: image.alt, ...(sizes.get(image.src) ?? FALLBACK_SIZE) }
}

function measureAround(center: number): void {
  for (const position of [center - 1, center, center + 1]) {
    const image = props.images[position]
    if (!image || sizes.has(image.src)) continue
    void measure(image.src).then(() => {
      if (!pswp || !sizes.has(image.src) || slides[position]?.src !== image.src) return
      slides[position] = slideFor(image)
      pswp.refreshSlideContent(position)
    })
  }
}

function scrollThumbIntoView(position: number, behavior: ScrollBehavior): void {
  void nextTick(() => {
    const thumb = strip.value?.children[position] as HTMLElement | undefined
    thumb?.scrollIntoView({ inline: 'center', block: 'nearest', behavior })
  })
}

async function open(position: number): Promise<void> {
  if (opening || pswp || !host.value) return
  opening = true
  await measure(props.images[position].src)
  opening = false
  if (props.activeId !== props.images[position]?.id || pswp || !host.value) return

  slides = props.images.map(slideFor)
  const hasStrip = props.images.length > 1
  const bottomSpace = (hasStrip ? THUMB_STRIP_SPACE : TOP_BAR_SPACE) + (slots.footer ? FOOTER_SPACE : 0)
  pswp = new PhotoSwipe({
    dataSource: slides,
    index: position,
    appendToEl: host.value,
    bgOpacity: 1,
    showHideAnimationType: 'fade',
    arrowPrev: false,
    arrowNext: false,
    zoom: false,
    close: false,
    counter: false,
    trapFocus: false,
    returnFocus: false,
    tapAction: false,
    bgClickAction: 'close',
    getViewportSizeFn: () => ({ x: host.value?.clientWidth ?? 0, y: host.value?.clientHeight ?? 0 }),
    padding: { top: TOP_BAR_SPACE, bottom: bottomSpace, left: 0, right: 0 },
  })
  pswp.on('change', () => {
    if (!pswp) return
    index.value = pswp.currIndex
    measureAround(pswp.currIndex)
    scrollThumbIntoView(pswp.currIndex, 'smooth')
    const id = props.images[pswp.currIndex]?.id
    if (id && id !== props.activeId) emit('change', id)
  })
  pswp.on('close', () => {
    isOpen.value = false
    if (props.activeId !== null) emit('close')
  })
  pswp.on('destroy', () => {
    pswp = null
    isOpen.value = false
  })
  index.value = position
  isOpen.value = true
  pswp.init()
  measureAround(position)
  scrollThumbIntoView(position, 'auto')
}

function goTo(position: number): void {
  pswp?.goTo(position)
}

function close(): void {
  pswp?.close()
}

watch(
  [() => props.activeId, () => props.images],
  ([id]) => {
    if (id === null) {
      pswp?.close()
      return
    }
    const position = props.images.findIndex(image => image.id === id)
    if (position < 0) return
    if (pswp) {
      if (pswp.currIndex !== position) pswp.goTo(position)
      return
    }
    void nextTick(() => open(position))
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  pswp?.destroy()
})
</script>

<template>
  <Teleport to="#overlay-root">
    <div class="photo-viewer absolute inset-0" :class="isOpen ? 'pointer-events-auto' : 'pointer-events-none'">
      <div ref="host" class="absolute inset-0" />
      <template v-if="isOpen">
        <div class="photo-viewer-layer pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
          <span class="font-label text-sm font-semibold tabular-nums" :class="images.length > 1 ? '' : 'invisible'">{{ index + 1 }} / {{ images.length }}</span>
          <CloseButton class="pointer-events-auto" tone="onDark" @click="close" />
        </div>
        <div
          v-if="$slots.footer && images[index]"
          class="photo-viewer-layer pointer-events-none absolute inset-x-0 flex justify-center px-4 text-white"
          :style="{ bottom: `${images.length > 1 ? THUMB_STRIP_SPACE : 12}px` }"
        >
          <div class="pointer-events-auto flex max-w-full flex-col items-center gap-2">
            <slot name="footer" :image="images[index]" :index="index" />
          </div>
        </div>
        <div
          v-if="images.length > 1"
          ref="strip"
          class="photo-viewer-layer photo-viewer-strip absolute inset-x-0 bottom-0 flex gap-2 overflow-x-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
        >
          <button
            v-for="(image, position) in images"
            :key="image.id"
            type="button"
            class="h-16 w-16 shrink-0 overflow-hidden transition-opacity"
            :class="position === index ? 'opacity-100 outline-2 -outline-offset-2 outline-white' : 'opacity-50'"
            :aria-label="`${image.alt} ${position + 1}`"
            :aria-current="position === index"
            @click="goTo(position)"
          >
            <img :src="image.src" alt="" class="h-full w-full object-cover" loading="lazy" decoding="async">
          </button>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style>
.photo-viewer {
  isolation: isolate;
}

.photo-viewer .pswp {
  position: absolute;
}

.photo-viewer-layer {
  z-index: calc(var(--pswp-root-z-index, 100000) + 1);
}

.photo-viewer-strip {
  scrollbar-width: none;
}
</style>
