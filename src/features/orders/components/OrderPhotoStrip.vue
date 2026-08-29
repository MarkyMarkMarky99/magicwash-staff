<script setup lang="ts">
defineProps<{ photos: Array<{ id: string; imagePath: string | null; imageType: string | null; quantity: number | null }>; loading?: boolean }>()
const emit = defineEmits<{ capture: [] }>()
</script>

<template>
  <section class="border-t border-outline-variant/20 bg-surface px-4 py-5" aria-labelledby="order-photos-title">
    <div class="mb-3 flex items-center justify-between gap-3"><div><p class="font-label text-[9px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">หลักฐานรับผ้า</p><h2 id="order-photos-title" class="font-headline text-base font-bold text-primary">รูปภาพของออเดอร์</h2></div><button type="button" class="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 font-label text-[11px] font-bold text-on-primary" @click="emit('capture')"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">photo_camera</span>เพิ่มรูป</button></div>
    <div v-if="loading" class="flex gap-2 overflow-hidden"><span v-for="item in 3" :key="item" class="h-20 w-20 animate-pulse rounded-xl bg-surface-container" /></div>
    <div v-else-if="photos.length" class="flex gap-2 overflow-x-auto pb-1 no-scrollbar"><figure v-for="photo in photos" :key="photo.id" class="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-container"><img v-if="photo.imagePath" :src="photo.imagePath" :alt="photo.imageType ?? 'Order photo'" class="h-full w-full object-cover"><div v-else class="flex h-full items-center justify-center text-on-surface-variant"><span class="material-symbols-outlined">image</span></div><figcaption v-if="photo.quantity !== null" class="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5 text-center font-label text-[9px] font-bold text-white">{{ photo.quantity }} kg</figcaption></figure></div>
    <p v-else class="rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low px-3 py-4 font-body text-sm text-on-surface-variant">ยังไม่มีรูปภาพสำหรับออเดอร์นี้</p>
  </section>
</template>
