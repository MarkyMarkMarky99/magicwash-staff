import { nextTick, onBeforeUnmount, onMounted, reactive, watch, type Ref, type WatchSource } from 'vue'

export interface LensTile {
  src: string
  x: number
  y: number
  width: number
  height: number
}

export interface LensView {
  width: number
  height: number
  tiles: LensTile[]
}

export const LENS_BLEED_PX = 24

const EMPTY_VIEW: LensView = { width: 0, height: 0, tiles: [] }

export function useGlassLens(scroller: Ref<HTMLElement | null>, invalidate: WatchSource[]) {
  const targets = new Map<string, HTMLElement>()
  const views = reactive<Record<string, LensView>>({})
  let frame = 0

  function update() {
    frame = 0
    const source = scroller.value
    if (!source) return
    const images = Array.from(source.querySelectorAll<HTMLImageElement>('[data-photo-index] img'))
    for (const [key, element] of targets) {
      const box = element.getBoundingClientRect()
      const tiles: LensTile[] = []
      for (const image of images) {
        const rect = image.getBoundingClientRect()
        if (
          rect.right < box.left - LENS_BLEED_PX || rect.left > box.right + LENS_BLEED_PX
          || rect.bottom < box.top - LENS_BLEED_PX || rect.top > box.bottom + LENS_BLEED_PX
        ) continue
        tiles.push({
          src: image.currentSrc || image.src,
          x: rect.left - box.left + LENS_BLEED_PX,
          y: rect.top - box.top + LENS_BLEED_PX,
          width: rect.width,
          height: rect.height,
        })
      }
      views[key] = { width: box.width, height: box.height, tiles }
    }
  }

  function schedule() {
    if (frame === 0) frame = requestAnimationFrame(update)
  }

  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)

  const binders = new Map<string, (element: unknown) => void>()

  function bind(key: string) {
    const existing = binders.get(key)
    if (existing) return existing
    const binder = (element: unknown) => {
      const previous = targets.get(key)
      if (previous && previous !== element) resizeObserver?.unobserve(previous)
      if (element instanceof HTMLElement) {
        targets.set(key, element)
        resizeObserver?.observe(element)
        schedule()
      } else {
        targets.delete(key)
        delete views[key]
      }
    }
    binders.set(key, binder)
    return binder
  }

  function view(key: string): LensView {
    return views[key] ?? EMPTY_VIEW
  }

  watch(invalidate, () => { void nextTick(schedule) }, { deep: true })

  watch(scroller, (element, previous) => {
    previous?.removeEventListener('scroll', schedule)
    element?.addEventListener('scroll', schedule, { passive: true })
    schedule()
  })

  onMounted(() => {
    scroller.value?.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    schedule()
  })

  onBeforeUnmount(() => {
    scroller.value?.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    resizeObserver?.disconnect()
    cancelAnimationFrame(frame)
  })

  return { bind, view, refresh: schedule }
}
