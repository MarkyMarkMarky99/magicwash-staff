<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import PickerOverlay from '@/shared/layouts/PickerOverlay.vue'
import LightboxOverlay from '@/shared/layouts/LightboxOverlay.vue'
import { currentActor } from '@/shared/config/actor'
import { useCloseRoute } from '@/shared/navigation/use-close-route'
import { getWorkOrder, type WorkOrderDetailDto } from '@/data/work-orders/work-order.service'
import { listLaundryPhotos, reassignLaundryPhoto, type GalleryPhoto } from '@/data/laundry-photos/laundry-photo.service'
import { listAfterPhotos, reassignAfterPhoto } from '@/data/after-photos/after-photo.service'
import { usePhotoDragSelect } from '../composables/use-photo-drag-select'

type PhotoType = 'BEF' | 'AFT'
type OrderItem = WorkOrderDetailDto['items'][number]

const TYPE_QUERY_KEY = 'type'
const PHOTO_QUERY_KEY = 'photo'
const MOVE_QUERY_KEY = 'move'
const UNASSIGNED_KEY = '__unassigned__'
const PHOTO_TABS: { key: PhotoType; label: string }[] = [
  { key: 'BEF', label: 'Before' },
  { key: 'AFT', label: 'After' },
]

const REFRACT_SUPPORTED = typeof navigator !== 'undefined' && 'userAgentData' in navigator
const REFRACT_MAP_X = svgMap(`<linearGradient id='m' x1='0' x2='1' y1='0' y2='0'><stop offset='0' stop-color='rgb(255,0,0)'/><stop offset='0.24' stop-color='rgb(128,0,0)'/><stop offset='0.76' stop-color='rgb(128,0,0)'/><stop offset='1' stop-color='rgb(0,0,0)'/></linearGradient>`)
const REFRACT_MAP_Y = svgMap(`<linearGradient id='m' x1='0' x2='0' y1='0' y2='1'><stop offset='0' stop-color='rgb(0,255,0)'/><stop offset='0.3' stop-color='rgb(0,128,0)'/><stop offset='0.7' stop-color='rgb(0,128,0)'/><stop offset='1' stop-color='rgb(0,0,0)'/></linearGradient>`)

function svgMap(gradient: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><defs>${gradient}</defs><rect width='100' height='100' fill='url(#m)'/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const props = defineProps<{ orderId: string }>()
const route = useRoute()
const router = useRouter()
const { close } = useCloseRoute({ name: 'order-detail', params: { orderId: props.orderId } })

function firstQueryValue(key: string): string | null {
  const raw = route.query[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && value ? value : null
}

const photoType = computed<PhotoType>(() => (firstQueryValue(TYPE_QUERY_KEY) === 'AFT' ? 'AFT' : 'BEF'))
const actor = computed(() => currentActor(firstQueryValue('by')))

const photos = ref<GalleryPhoto[]>([])
const photosStatus = ref<'loading' | 'done' | 'error'>('loading')
const items = ref<OrderItem[]>([])
let loadSequence = 0

async function loadPhotos() {
  const sequence = ++loadSequence
  const type = photoType.value
  photosStatus.value = 'loading'
  photos.value = []
  const onFresh = (fresh: GalleryPhoto[]) => {
    if (sequence === loadSequence) photos.value = fresh
  }
  try {
    const loaded = type === 'BEF'
      ? await listLaundryPhotos(props.orderId, onFresh)
      : await listAfterPhotos(props.orderId, onFresh)
    if (sequence !== loadSequence) return
    photos.value = loaded
    photosStatus.value = 'done'
  } catch {
    if (sequence === loadSequence) photosStatus.value = 'error'
  }
}

async function loadItems() {
  try {
    const order = await getWorkOrder(props.orderId)
    items.value = order.items
  } catch {
    items.value = []
  }
}

watch(() => props.orderId, () => { void loadItems() }, { immediate: true })

function itemLabel(item: OrderItem | undefined): string {
  return item?.description?.trim() || 'Unnamed item'
}

const sections = computed(() => {
  const groups = new Map<string, GalleryPhoto[]>()
  for (const photo of photos.value) {
    const key = photo.orderItemId && items.value.some(item => item.orderItemId === photo.orderItemId)
      ? photo.orderItemId
      : UNASSIGNED_KEY
    groups.set(key, [...(groups.get(key) ?? []), photo])
  }
  const ordered = items.value
    .filter(item => groups.has(item.orderItemId))
    .map(item => ({ key: item.orderItemId, label: itemLabel(item), photos: groups.get(item.orderItemId) ?? [] }))
  const unassigned = groups.get(UNASSIGNED_KEY)
  if (unassigned) ordered.push({ key: UNASSIGNED_KEY, label: 'No item', photos: unassigned })
  let offset = 0
  return ordered.map((section) => {
    const withOffset = { ...section, offset }
    offset += section.photos.length
    return withOffset
  })
})

const orderedIds = computed(() => sections.value.flatMap(section => section.photos.map(photo => photo.id)))

const scroller = ref<HTMLElement | null>(null)
const selecting = ref(false)
const { selected, toggle, clear, consumeClick, handlers } = usePhotoDragSelect({
  ids: orderedIds,
  scroller,
  onStart: () => { selecting.value = true },
})

function exitSelect() {
  selecting.value = false
  clear()
  moveError.value = null
}

function toggleSelectMode() {
  if (selecting.value) exitSelect()
  else selecting.value = true
}

function replaceQuery(patch: Record<string, string | null>) {
  const query: LocationQueryRaw = { ...route.query }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete query[key]
    else query[key] = value
  }
  return query
}

function selectType(type: PhotoType) {
  if (type === photoType.value) return
  void router.replace({ query: replaceQuery({ [TYPE_QUERY_KEY]: type === 'BEF' ? null : type }) })
}

let pushedOverlay = false

function openOverlay(key: string, value: string) {
  pushedOverlay = true
  void router.push({ query: replaceQuery({ [key]: value }) })
}

function closeOverlay(key: string) {
  if (!firstQueryValue(key)) return
  if (pushedOverlay) {
    pushedOverlay = false
    router.back()
    return
  }
  void router.replace({ query: replaceQuery({ [key]: null }) })
}

function onTileClick(photo: GalleryPhoto) {
  if (consumeClick()) return
  if (selecting.value) toggle(photo.id)
  else openOverlay(PHOTO_QUERY_KEY, photo.id)
}

const lightboxPhoto = computed(() => {
  const id = firstQueryValue(PHOTO_QUERY_KEY)
  return id ? photos.value.find(photo => photo.id === id) ?? null : null
})

const selectedPhotos = computed(() => photos.value.filter(photo => selected.value.has(photo.id)))
const moveOpen = computed(() => firstQueryValue(MOVE_QUERY_KEY) !== null && selecting.value && selectedPhotos.value.length > 0)
const moving = ref(false)
const moveProgress = ref(0)
const moveTotal = ref(0)
const moveError = ref<string | null>(null)

watch(() => firstQueryValue(MOVE_QUERY_KEY), (value) => {
  if (value !== null && !moveOpen.value && !moving.value) closeOverlay(MOVE_QUERY_KEY)
}, { immediate: true })

function openMovePicker() {
  if (selectedPhotos.value.length === 0 || moving.value) return
  moveError.value = null
  openOverlay(MOVE_QUERY_KEY, '1')
}

function isCurrentTarget(item: OrderItem): boolean {
  return selectedPhotos.value.every(photo => photo.orderItemId === item.orderItemId)
}

async function moveTo(item: OrderItem) {
  if (moving.value) return
  const type = photoType.value
  const targets = selectedPhotos.value.filter(photo => photo.orderItemId !== item.orderItemId)
  closeOverlay(MOVE_QUERY_KEY)
  if (targets.length === 0) return

  moving.value = true
  moveProgress.value = 0
  moveTotal.value = targets.length
  moveError.value = null
  const failed = new Set<string>()
  const payload = { orderItemId: item.orderItemId, updatedBy: actor.value }

  for (const photo of targets) {
    try {
      const encodedId = encodeURIComponent(photo.id)
      if (type === 'BEF') await reassignLaundryPhoto(encodedId, payload)
      else await reassignAfterPhoto(encodedId, payload)
      photos.value = photos.value.map(entry => (entry.id === photo.id ? { ...entry, orderItemId: item.orderItemId } : entry))
    } catch {
      failed.add(photo.id)
    }
    moveProgress.value += 1
  }

  moving.value = false
  if (failed.size === 0) {
    exitSelect()
    return
  }
  selected.value = failed
  moveError.value = `Moved ${targets.length - failed.size} of ${targets.length}. ${failed.size} failed and stay selected.`
}

watch([() => props.orderId, photoType], () => {
  exitSelect()
  void loadPhotos()
}, { immediate: true })

const title = computed(() => (photoType.value === 'BEF' ? 'Before' : 'After'))
const subtitle = computed(() => {
  if (selecting.value) return selected.value.size === 0 ? 'Select photos' : `${selected.value.size} selected`
  return `${props.orderId} · ${photos.value.length} photos`
})
</script>

<template>
  <div class="relative h-full overflow-hidden bg-surface text-on-surface" :class="{ 'lg-refract': REFRACT_SUPPORTED }">
    <svg v-if="REFRACT_SUPPORTED" class="absolute size-0" aria-hidden="true">
      <filter id="lg-refract" x="0" y="0" width="1" height="1" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
        <feImage :href="REFRACT_MAP_X" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="mapX" />
        <feImage :href="REFRACT_MAP_Y" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="mapY" />
        <feComposite in="mapX" in2="mapY" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale="0.09" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
    <div
      ref="scroller"
      class="no-scrollbar h-full overflow-y-auto overscroll-contain pb-32"
      @pointerdown="handlers.onPointerDown"
      @pointermove="handlers.onPointerMove"
      @pointerup="handlers.onPointerEnd"
      @pointercancel="handlers.onPointerEnd"
      @touchmove="handlers.onTouchMove"
      @contextmenu.prevent
    >
      <div class="h-28" aria-hidden="true" />

      <div v-if="photosStatus === 'loading' && photos.length === 0" class="grid grid-cols-3 gap-0.5">
        <div v-for="n in 12" :key="n" class="aspect-square animate-pulse bg-surface-container" />
      </div>

      <div v-else-if="photosStatus === 'error'" class="space-y-3 px-6 py-16 text-center">
        <p class="font-body text-sm text-error">Unable to load photos.</p>
        <button type="button" class="rounded-full bg-surface-container px-5 py-2 font-body text-sm font-medium" @click="loadPhotos">Retry</button>
      </div>

      <p v-else-if="photos.length === 0" class="px-6 py-16 text-center font-body text-sm text-on-surface-variant">
        No {{ title.toLowerCase() }} photos for this order.
      </p>

      <section v-for="section in sections" :key="section.key" class="mb-1">
        <h2 class="px-4 pb-2 pt-4 font-headline text-[15px] font-bold text-on-surface">
          {{ section.label }}
          <span class="ml-1 font-body text-xs font-medium text-on-surface-variant">{{ section.photos.length }}</span>
        </h2>
        <div class="grid grid-cols-3 gap-0.5">
          <button
            v-for="(photo, index) in section.photos"
            :key="photo.id"
            type="button"
            :data-photo-index="section.offset + index"
            class="photo-tile relative aspect-square overflow-hidden bg-surface-container"
            :aria-pressed="selecting ? selected.has(photo.id) : undefined"
            :aria-label="selecting ? `Select photo ${section.offset + index + 1}` : `Open photo ${section.offset + index + 1}`"
            @click="onTileClick(photo)"
          >
            <img :src="photo.imageUrl" alt="" loading="lazy" draggable="false" class="h-full w-full object-cover transition-transform" :class="selected.has(photo.id) ? 'scale-[0.92] rounded-md' : ''">
            <span
              v-if="selecting"
              class="absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-full border-2 border-white shadow"
              :class="selected.has(photo.id) ? 'bg-primary' : 'bg-black/20'"
              aria-hidden="true"
            >
              <span v-if="selected.has(photo.id)" class="material-symbols-outlined text-[16px] font-bold text-on-primary">check</span>
            </span>
          </button>
        </div>
      </section>
    </div>

    <div class="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/55 via-black/20 to-transparent" aria-hidden="true" />
    <header class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div class="min-w-0 text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.35)]">
        <h1 class="font-headline text-[34px] font-extrabold leading-none tracking-tight">{{ title }}</h1>
        <p class="mt-1 truncate font-body text-sm font-semibold">{{ subtitle }}</p>
      </div>
      <button
        type="button"
        class="glass glass-light glass-label pointer-events-auto h-12 shrink-0 rounded-full px-6 text-[17px]"
        :disabled="moving || photos.length === 0"
        @click="toggleSelectMode"
      >
        {{ selecting ? 'Cancel' : 'Select' }}
      </button>
    </header>

    <div class="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-[max(1.75rem,calc(env(safe-area-inset-bottom)+0.5rem))]">
      <p v-if="moveError" role="alert" class="glass glass-light pointer-events-auto mx-auto mb-3 max-w-sm rounded-2xl px-4 py-2 text-center font-body text-xs font-semibold !text-error">
        {{ moveError }}
      </p>

      <div v-if="!selecting" class="flex items-center justify-between gap-3">
        <button type="button" class="glass pointer-events-auto flex size-15 shrink-0 items-center justify-center rounded-full" aria-label="Back to order" @click="close">
          <span class="material-symbols-outlined text-[28px] [font-variation-settings:'wght'_500]" aria-hidden="true">arrow_back_ios_new</span>
        </button>
        <div class="glass pointer-events-auto relative grid h-15 grid-cols-2 items-center rounded-full p-1.5" role="tablist" aria-label="Photo type">
          <span
            class="glass-pill absolute inset-y-1.5 left-1.5 w-[calc(50%-0.375rem)] overflow-hidden rounded-full transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.5,1)]"
            :style="{ transform: photoType === 'AFT' ? 'translateX(100%)' : 'translateX(0)' }"
            aria-hidden="true"
          />
          <button
            v-for="tab in PHOTO_TABS"
            :key="tab.key"
            type="button"
            role="tab"
            :aria-selected="photoType === tab.key"
            class="glass-label relative h-full rounded-full px-7 text-[18px]"
            @click="selectType(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="size-15 shrink-0" aria-hidden="true" />
      </div>

      <div v-else class="glass pointer-events-auto mx-auto flex h-15 max-w-sm items-center justify-between gap-3 rounded-full py-1.5 pl-6 pr-1.5">
        <span class="glass-label text-[18px]">
          {{ moving ? `Moving ${moveProgress}/${moveTotal}…` : `${selected.size} selected` }}
        </span>
        <button
          type="button"
          class="flex h-full items-center gap-1.5 rounded-full bg-primary px-5 font-body text-[15px] font-semibold text-on-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] disabled:opacity-40"
          :disabled="selected.size === 0 || moving"
          @click="openMovePicker"
        >
          <span class="material-symbols-outlined text-[18px]" :class="moving ? 'animate-spin' : ''" aria-hidden="true">{{ moving ? 'sync' : 'drive_file_move' }}</span>
          Move to item
        </button>
      </div>
    </div>

    <PickerOverlay :open="moveOpen" ariaLabel="Choose target item" @close="closeOverlay(MOVE_QUERY_KEY)">
      <template #header>
        <p class="px-5 pb-0 pt-5 text-center font-body text-sm text-on-surface-variant">
          Move {{ selectedPhotos.length }} photo{{ selectedPhotos.length === 1 ? '' : 's' }} to
        </p>
      </template>
      <div class="space-y-3 px-5 pb-5 pt-3">
        <p v-if="items.length === 0" class="py-3 text-center font-body text-sm text-on-surface-variant">This order has no items.</p>
        <button
          v-for="item in items"
          :key="item.orderItemId"
          type="button"
          :disabled="isCurrentTarget(item)"
          class="flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          :class="isCurrentTarget(item) ? 'border-primary bg-primary/10' : 'border-outline-variant/30 bg-surface-variant hover:bg-surface-container'"
          @click="moveTo(item)"
        >
          <span class="min-w-0 font-body text-sm text-on-surface">{{ itemLabel(item) }}</span>
          <span v-if="isCurrentTarget(item)" class="shrink-0 font-body text-xs font-medium text-primary">Current item</span>
        </button>
      </div>
    </PickerOverlay>

    <LightboxOverlay :open="lightboxPhoto !== null" ariaLabel="Photo" @close="closeOverlay(PHOTO_QUERY_KEY)">
      <img v-if="lightboxPhoto" :src="lightboxPhoto.imageUrl" alt="" class="max-h-full max-w-full object-contain">
    </LightboxOverlay>
  </div>
</template>

<style scoped>
.glass {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  color: #fff;
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.4), 0 0 14px rgb(0 0 0 / 0.18);
  background: linear-gradient(180deg, rgb(255 255 255 / 0.1), rgb(255 255 255 / 0.02));
  -webkit-backdrop-filter: blur(2.5px) saturate(1.9) brightness(0.9) contrast(1.06);
  backdrop-filter: blur(2.5px) saturate(1.9) brightness(0.9) contrast(1.06);
  box-shadow:
    0 12px 32px rgb(0 0 0 / 0.3),
    0 2px 6px rgb(0 0 0 / 0.14),
    inset 0 0 22px rgb(255 255 255 / 0.1);
}

.lg-refract .glass {
  backdrop-filter: url(#lg-refract) blur(2px) saturate(1.9) brightness(0.9) contrast(1.06);
}

.glass::before,
.glass-pill::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  padding: 1.5px;
  border-radius: inherit;
  background: conic-gradient(
    from 315deg,
    rgb(255 255 255 / 0.95),
    rgb(255 255 255 / 0.18) 50deg,
    rgb(255 255 255 / 0.04) 110deg,
    rgb(255 255 255 / 0.55) 180deg,
    rgb(255 255 255 / 0.1) 240deg,
    rgb(255 255 255 / 0.04) 290deg,
    rgb(255 255 255 / 0.95)
  );
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  pointer-events: none;
}

.glass-light {
  color: #111;
  text-shadow: none;
  background: rgb(255 255 255 / 0.78);
  -webkit-backdrop-filter: blur(12px) saturate(1.8);
  backdrop-filter: blur(12px) saturate(1.8);
}

.lg-refract .glass-light {
  backdrop-filter: url(#lg-refract) blur(10px) saturate(1.8);
}

.glass-pill {
  background: rgb(255 255 255 / 0.2);
  box-shadow:
    0 2px 10px rgb(0 0 0 / 0.14),
    inset 0 0 14px rgb(255 255 255 / 0.18);
}

.glass-pill::before {
  opacity: 0.55;
}

.glass-label {
  font-family: Inter, var(--font-body, system-ui), sans-serif;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.photo-tile {
  -webkit-touch-callout: none;
  user-select: none;
  -webkit-user-select: none;
}
</style>
