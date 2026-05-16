<script setup>
import { computed, ref } from 'vue'
import PhotoGrid from './PhotoGrid.vue'
import PhotoLightbox from './PhotoLightbox.vue'
import PhotoCell from './PhotoCell.vue'

const props = defineProps({
  photos: {
    type: [Array, Object],
    default: () => [],
  },
  emptyText: {
    type: String,
    default: 'ยังไม่มีรูปภาพ',
  },
  columns: {
    type: [Number, String],
    default: 3,
  },
  title: {
    type: String,
    default: 'Library',
  },
  showToolbar: {
    type: Boolean,
    default: true,
  },
  showAction: {
    type: Boolean,
    default: true,
  },
  actionLabel: {
    type: String,
    default: 'Select',
  },
  actionDisabled: {
    type: Boolean,
    default: false,
  },
  showSecondaryAction: {
    type: Boolean,
    default: true,
  },
  secondaryActionIcon: {
    type: String,
    default: 'search',
  },
  secondaryActionLabel: {
    type: String,
    default: 'Search photos',
  },
  secondaryActionDisabled: {
    type: Boolean,
    default: false,
  },
  statusText: {
    type: String,
    default: '',
  },
  statusError: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['open', 'remove', 'close', 'action', 'secondary-action'])

const lightboxIndex = defineModel({ type: Number, default: null })
const activeTab = ref('photos')
const selectedAlbumKey = ref(null)
const PROCESSING_STATUSES = new Set(['preprocessing', 'compressing', 'uploading', 'saving'])

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasPhotoSource(value) {
  return ['src', 'image_url', 'url', 'previewUrl', 'file'].some((key) => key in value)
}

function isCollectionMap(value) {
  if (!isObject(value) || hasPhotoSource(value)) return false
  const entries = Object.entries(value)
  return entries.length > 0 && entries.every(([, photos]) => Array.isArray(photos))
}

function getPhotoSource(photo) {
  if (typeof photo === 'string') return photo
  if (!isObject(photo)) return ''
  return photo.src ?? photo.image_url ?? photo.url ?? photo.previewUrl ?? ''
}

function getPhotoLabel(photo) {
  if (!isObject(photo)) return null
  return photo.label ?? photo.notes ?? null
}

function normalizePhoto(photo, fallbackId, albumKey = null, showAlbumLabel = false) {
  const base = isObject(photo) ? photo : {}
  const albumLabel = showAlbumLabel ? albumKey : null
  return {
    ...base,
    id: base.id ?? fallbackId,
    src: getPhotoSource(photo),
    label: albumLabel ?? getPhotoLabel(photo),
    badge: albumLabel ?? base.badge ?? null,
    albumKey,
  }
}

const normalizedGallery = computed(() => {
  const flatPhotos = []
  const albumMap = new Map()
  const input = Array.isArray(props.photos) ? props.photos : [props.photos]

  input.forEach((entry, entryIndex) => {
    if (!isCollectionMap(entry)) {
      flatPhotos.push(normalizePhoto(entry, `photo-${entryIndex}`))
      return
    }

    Object.entries(entry).forEach(([albumKey, albumPhotos]) => {
      const albumItems = albumPhotos.map((photo, photoIndex) => ({
        ...normalizePhoto(photo, `album-${albumKey}-${photoIndex}`, albumKey, false),
        label: null,
        badge: null,
      }))
      const currentItems = albumMap.get(albumKey) ?? []
      albumMap.set(albumKey, [...currentItems, ...albumItems])

      flatPhotos.push(...albumPhotos.map((photo, photoIndex) => (
        normalizePhoto(photo, `flat-${albumKey}-${entryIndex}-${photoIndex}`, albumKey, true)
      )))
    })
  })

  const albums = Array.from(albumMap, ([key, photos]) => ({
    key,
    title: key,
    photos,
  })).filter((album) => album.photos.length)

  return { flatPhotos, albums }
})

const flatPhotos = computed(() => normalizedGallery.value.flatPhotos)
const collectionAlbums = computed(() => {
  if (normalizedGallery.value.albums.length) return normalizedGallery.value.albums
  if (!flatPhotos.value.length) return []

  return [{
    key: '__all__',
    title: props.title,
    photos: flatPhotos.value.map((photo) => ({
      ...photo,
      label: null,
      badge: null,
    })),
  }]
})
const selectedAlbum = computed(() => (
  collectionAlbums.value.find((album) => album.key === selectedAlbumKey.value) ?? null
))
const albumCovers = computed(() => collectionAlbums.value.map((album) => ({
  ...album.photos[0],
  id: `album-cover-${album.key}`,
  kind: 'album',
  albumKey: album.key,
  albumTitle: album.title,
  albumCount: album.photos.length,
  label: album.title,
  badge: null,
  removable: false,
})))

const displayPhotos = computed(() => {
  if (activeTab.value === 'collections') {
    return selectedAlbum.value?.photos ?? albumCovers.value
  }

  return flatPhotos.value
})

const headerTitle = computed(() => selectedAlbum.value?.title ?? props.title)

const itemSummary = computed(() => {
  const count = displayPhotos.value.length
  const noun = activeTab.value === 'collections' && !selectedAlbum.value ? 'album' : 'item'
  return `${count.toLocaleString()} ${count === 1 ? noun : `${noun}s`}`
})

function isProcessing(status) {
  return PROCESSING_STATUSES.has(status)
}

function openLightbox(index) {
  lightboxIndex.value = index
  emit('open', index)
}

function closeLightbox() {
  emit('close')
}

function showPhotos() {
  activeTab.value = 'photos'
  selectedAlbumKey.value = null
  lightboxIndex.value = null
}

function showCollections() {
  activeTab.value = 'collections'
  selectedAlbumKey.value = null
  lightboxIndex.value = null
}

function openAlbum(albumKey) {
  selectedAlbumKey.value = albumKey
  lightboxIndex.value = null
}

function backToAlbums() {
  selectedAlbumKey.value = null
  lightboxIndex.value = null
}

function handleCellClick(photo, index) {
  if (photo.kind === 'album') {
    openAlbum(photo.albumKey)
    return
  }

  openLightbox(index)
}
</script>

<template>
  <section class="photo-gallery relative flex h-full min-h-full overflow-hidden text-white isolate">
    <header class="photo-gallery__topbar absolute top-0 inset-x-0 z-[4] flex items-end justify-between gap-4 px-4 pt-[1.65rem] pb-[0.55rem]">
      <div class="flex min-w-0 items-center gap-[0.55rem]">
        <button
          v-if="selectedAlbum"
          class="photo-gallery__back inline-flex w-8 h-8 flex-none items-center justify-center rounded-full text-white transition-all duration-200 ease-in-out active:scale-[0.92]"
          type="button"
          aria-label="กลับไปหน้า albums"
          @click="backToAlbums"
        >
          <span class="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>

        <div class="min-w-0">
          <h2 class="photo-gallery__title m-0 overflow-hidden font-headline text-[1.9rem] font-[760] leading-[0.98] tracking-normal text-ellipsis whitespace-nowrap">{{ headerTitle }}</h2>
          <p class="photo-gallery__count mt-[0.22rem] font-body text-[0.72rem] font-[480] leading-none text-white/70">{{ itemSummary }}</p>
        </div>
      </div>

      <button
        v-if="showAction && !selectedAlbum"
        class="photo-gallery__select inline-flex min-w-[4.5rem] h-[2.2rem] items-center justify-center rounded-full font-body text-[0.85rem] font-[650] leading-none text-white disabled:opacity-45 disabled:pointer-events-none transition-all duration-200 ease-in-out active:scale-95"
        type="button"
        :disabled="actionDisabled"
        @click="emit('action')"
      >
        {{ actionLabel }}
      </button>
    </header>

    <div class="photo-gallery__content relative z-[1] flex-1 w-full min-h-0 overflow-y-auto pb-[5.75rem] pt-[var(--photo-gallery-top-space)]" :class="{ 'flex min-h-full items-center justify-center p-4': !displayPhotos.length }">
      <PhotoGrid
        v-if="displayPhotos.length"
        :photos="displayPhotos"
        :columns="columns"
        variant="liquid"
      >
        <template #cell="{ photo, index }">
          <PhotoCell
            :photo="photo"
            :index="index"
            :is-processing="isProcessing(photo.status)"
            @click="handleCellClick"
            @remove="(id) => emit('remove', id)"
          />
        </template>
      </PhotoGrid>

      <div v-else class="flex flex-col items-center justify-center gap-[0.55rem] text-white/25 font-body text-[0.86rem] font-[520]">
        <span class="material-symbols-outlined text-[28px]">image_not_supported</span>
        <p class="m-0">{{ emptyText }}</p>
      </div>
    </div>

    <footer v-if="showToolbar" class="absolute inset-x-0 z-[4] h-12 pointer-events-none bottom-[max(0.82rem,env(safe-area-inset-bottom))]" aria-label="Gallery controls">
      <p
        v-if="statusText"
        class="photo-gallery__status absolute right-[3.4rem] bottom-[3.1rem] left-[0.35rem] m-0 overflow-hidden font-body text-[0.68rem] font-[650] leading-none text-white/65 text-ellipsis whitespace-nowrap"
        :class="{ 'text-[#ffdad6]': statusError }"
      >
        {{ statusText }}
      </p>

      <div class="photo-gallery__tabs absolute bottom-[0.08rem] left-5 grid grid-cols-2 w-[min(13.5rem,calc(100%-4.5rem))] p-1 rounded-full pointer-events-auto">
        <button
          class="photo-gallery__tab inline-flex min-w-0 h-[2.2rem] items-center justify-center gap-[0.35rem] overflow-hidden rounded-full border border-transparent bg-transparent shadow-none font-body text-[0.75rem] font-[550] leading-none text-white/60 transition-all duration-200 ease-in-out"
          :class="{ 'photo-gallery__tab--active text-white': activeTab === 'photos' }"
          type="button"
          aria-label="Photos"
          @click="showPhotos"
        >
          <span class="material-symbols-outlined text-[20px]" :class="{ 'fill-icon': activeTab === 'photos' }">photo_library</span>
          <span>Photos</span>
        </button>
        <button
          class="photo-gallery__tab inline-flex min-w-0 h-[2.2rem] items-center justify-center gap-[0.35rem] overflow-hidden rounded-full border border-transparent bg-transparent shadow-none font-body text-[0.75rem] font-[550] leading-none text-white/60 transition-all duration-200 ease-in-out"
          :class="{ 'photo-gallery__tab--active text-white': activeTab === 'collections' }"
          type="button"
          aria-label="Collections"
          @click="showCollections"
        >
          <span class="material-symbols-outlined text-[20px]" :class="{ 'fill-icon': activeTab === 'collections' }">auto_awesome_mosaic</span>
          <span>Collections</span>
        </button>
      </div>

      <button
        v-if="showSecondaryAction"
        class="photo-gallery__search absolute right-[0.95rem] bottom-0 inline-flex w-[2.72rem] h-[2.72rem] flex-none items-center justify-center rounded-full pointer-events-auto text-white transition-all duration-200 ease-in-out active:scale-[0.92] disabled:opacity-45 disabled:pointer-events-none"
        type="button"
        :aria-label="secondaryActionLabel"
        :disabled="secondaryActionDisabled"
        @click="emit('secondary-action')"
      >
        <span class="material-symbols-outlined text-[24px]">{{ secondaryActionIcon }}</span>
      </button>
    </footer>
  </section>

  <PhotoLightbox
    v-model="lightboxIndex"
    :photos="displayPhotos"
    @close="closeLightbox"
  />
</template>

<style scoped>
.photo-gallery {
  --photo-gallery-top-space: 4.6rem;
  background:
    radial-gradient(circle at 20% 0%, rgb(255 255 255 / 0.16), transparent 24rem),
    linear-gradient(180deg, #283335 0%, #111616 34%, #070909 100%);
}

.photo-gallery::before,
.photo-gallery::after {
  position: absolute;
  inset-inline: 0;
  z-index: 2;
  pointer-events: none;
  content: "";
}

.photo-gallery::before {
  top: 0;
  height: 7rem;
  background: linear-gradient(180deg, rgb(0 0 0 / 0.32), transparent);
}

.photo-gallery::after {
  bottom: 0;
  height: 8rem;
  background: linear-gradient(0deg, rgb(0 0 0 / 0.62), transparent);
}

.photo-gallery__topbar {
  background: linear-gradient(180deg, rgb(5 10 10 / 0.28), rgb(5 10 10 / 0));
  backdrop-filter: blur(10px) saturate(1.2);
  -webkit-backdrop-filter: blur(10px) saturate(1.2);
}

.photo-gallery__title {
  text-shadow: 0 1px 8px rgb(0 0 0 / 0.22);
}

.photo-gallery__count {
  text-shadow: 0 1px 6px rgb(0 0 0 / 0.32);
}

.photo-gallery__back {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-top-color: rgba(255, 255, 255, 0.4);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.6),
    inset 0 -1px 2px rgba(0, 0, 0, 0.15),
    0 8px 16px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(30px) saturate(2);
  -webkit-backdrop-filter: blur(30px) saturate(2);
}

.photo-gallery__back:active {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.05) 100%);
}

.photo-gallery__select {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-top-color: rgba(255, 255, 255, 0.4);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.6),
    inset 0 -1px 2px rgba(0, 0, 0, 0.15),
    0 6px 16px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(30px) saturate(2);
  -webkit-backdrop-filter: blur(30px) saturate(2);
}

.photo-gallery__select:active {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.05) 100%);
}

.photo-gallery__content {
  scrollbar-width: none;
}

.photo-gallery__content::-webkit-scrollbar {
  display: none;
}

.photo-gallery__status {
  text-shadow: 0 1px 12px rgb(0 0 0 / 0.5);
}

.photo-gallery__tabs {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-top-color: rgba(255, 255, 255, 0.35);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.5),
    inset 0 -1px 2px rgba(0, 0, 0, 0.1),
    0 8px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(40px) saturate(2);
  -webkit-backdrop-filter: blur(40px) saturate(2);
}

.photo-gallery__tab--active {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.1) 100%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-top-color: rgba(255, 255, 255, 0.45);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.5),
    0 2px 8px rgba(0, 0, 0, 0.2);
}

.photo-gallery__search {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-top-color: rgba(255, 255, 255, 0.4);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.6),
    inset 0 -1px 2px rgba(0, 0, 0, 0.15),
    0 8px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(40px) saturate(2);
  -webkit-backdrop-filter: blur(40px) saturate(2);
}

.photo-gallery__search:active {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.05) 100%);
}
</style>
