<script setup lang="ts">
import BaseBadge from '@/shared/components/BaseBadge.vue'
import ImageOrIcon from '@/shared/components/ImageOrIcon.vue'
import DetailOverlay from '@/shared/layouts/DetailOverlay.vue'
import type { OrderIntakeGarment } from '@/features/orders/utils/order-intake-draft'

defineProps<{ open: boolean, title: string, garments: readonly OrderIntakeGarment[], chooseType: boolean }>()
const emit = defineEmits<{
  close: []
  changeType: [tag: string]
  note: [tag: string, value: string]
  defect: [tag: string]
  viewDefect: [id: string]
  remove: [tag: string]
}>()

const ACTION = 'inline-flex h-10 items-center gap-1.5 rounded-full border border-outline-variant bg-white px-3.5 text-[13px] font-bold text-primary focus-visible:outline-2 focus-visible:outline-lime'
</script>

<template>
  <DetailOverlay :open="open" :ariaLabel="title" @close="emit('close')">
    <template #header>
      <h2 class="px-5 pb-2 pr-16 pt-1 font-headline text-lg font-extrabold">{{ title }}<small class="ml-1.5 text-xs font-bold text-on-surface-variant">{{ garments.length }}</small></h2>
    </template>
    <ul class="flex flex-col gap-3 px-5 pb-5">
      <li v-for="garment in garments" :key="garment.tag" class="rounded-2xl border border-outline-variant bg-surface-container-lowest p-3">
        <div class="flex gap-3">
          <ImageOrIcon :image-url="garment.imageUrl" icon="checkroom" class="h-16 w-16 rounded-xl" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-body text-sm font-extrabold tracking-[0.06em] text-primary">{{ garment.tag }}</span>
              <BaseBadge v-if="garment.defectPhotos.length > 0" :label="`Defect ${garment.defectPhotos.length}`" tone="warning" />
            </div>
            <input
              :value="garment.note ?? ''"
              type="text"
              autocomplete="off"
              :aria-label="`Note for ${garment.tag}`"
              placeholder="Note (stain, missing button)"
              class="mt-1.5 h-10 w-full rounded-xl border border-outline-variant bg-white px-3 font-body text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-lime focus:ring-2 focus:ring-lime"
              @input="emit('note', garment.tag, ($event.target as HTMLInputElement).value)"
            >
          </div>
        </div>
        <ul v-if="garment.defectPhotos.length > 0" class="mt-2.5 flex flex-wrap gap-2">
          <li v-for="(photo, index) in garment.defectPhotos" :key="photo.id">
            <button type="button" class="block h-14 w-14 overflow-hidden rounded-lg border border-outline-variant bg-surface-container focus-visible:outline-2 focus-visible:outline-lime" :aria-label="`View defect photo ${index + 1} of ${garment.tag}`" @click="emit('viewDefect', photo.id)">
              <img :src="photo.previewUrl" alt="" class="h-full w-full object-cover">
            </button>
          </li>
        </ul>
        <div class="mt-2.5 flex flex-wrap gap-2">
          <button v-if="chooseType" type="button" :class="ACTION" :aria-label="`Choose type of ${garment.tag}`" @click="emit('changeType', garment.tag)">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">category</span>Choose type
          </button>
          <button type="button" :class="ACTION" :aria-label="`Add defect photo for ${garment.tag}`" @click="emit('defect', garment.tag)">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">photo_camera</span>Defect photo
          </button>
          <button type="button" class="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold text-error focus-visible:outline-2 focus-visible:outline-lime" :aria-label="`Remove ${garment.tag} from this order`" @click="emit('remove', garment.tag)">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>Remove
          </button>
        </div>
      </li>
    </ul>
  </DetailOverlay>
</template>
