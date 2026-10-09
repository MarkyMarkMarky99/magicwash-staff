<script setup lang="ts">
defineProps<{ number: number; itemCount: number; confirmedAt: string; photoUrl: string | null }>()
</script>

<template>
  <li class="grid grid-cols-[52px_minmax(0,1fr)_56px] items-center gap-2.5 rounded-[14px] bg-white px-3 py-2.5 shadow-[0_1px_0_color-mix(in_srgb,var(--color-on-surface)_5%,transparent)]">
    <p class="flex flex-col items-end justify-center self-stretch border-r border-lime/60 pr-2 text-primary">
      <span class="font-[Manrope,sans-serif] text-[22px] font-extrabold leading-none tracking-[-0.06em] tabular-nums">{{ itemCount }}</span>
      <span class="mt-[3px] font-label text-[11px] font-semibold leading-none text-on-surface-variant">{{ itemCount === 1 ? 'item' : 'items' }}</span>
    </p>
    <div class="min-w-0">
      <p class="truncate font-body text-sm font-extrabold leading-tight tracking-[-0.015em] text-on-surface">Bag {{ number }}</p>
      <p class="mt-[3px] font-label text-[10px] font-semibold text-on-surface-variant">{{ confirmedAt }}</p>
      <p class="mt-1 flex items-center gap-1 font-label text-[10px] font-extrabold uppercase leading-none tracking-[0.04em] text-success"><span class="material-symbols-outlined text-[11px]" aria-hidden="true">lock</span>Confirmed</p>
    </div>
    <div class="relative h-14 w-14">
      <div class="h-full w-full overflow-hidden rounded-[10px] bg-surface-container">
        <img v-if="photoUrl" :src="photoUrl" :alt="`Bag ${number} photo`" class="h-full w-full object-cover">
        <span v-else class="material-symbols-outlined grid h-full place-items-center text-on-surface-variant" aria-hidden="true">image</span>
      </div>
      <span class="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-lime text-primary shadow-sm"><span class="material-symbols-outlined" style="font-size: 15px; font-variation-settings: 'wght' 700" aria-hidden="true">check</span></span>
    </div>
  </li>
</template>
