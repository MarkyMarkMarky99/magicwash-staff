<script setup lang="ts">
defineProps<{ unassigned: number }>()
const emit = defineEmits<{ add: [] }>()
</script>

<template>
  <button type="button" class="mt-2 grid w-full grid-cols-[52px_minmax(0,1fr)_56px] items-center gap-2.5 rounded-[14px] border-2 border-dashed border-outline-variant px-3 py-2.5 text-left active:bg-surface-container focus-visible:outline-2 focus-visible:outline-lime" @click="emit('add')">
    <span class="grid h-12 w-12 -rotate-[7deg] place-items-center rounded-[16px] bg-secondary-container text-on-secondary-container"><span class="material-symbols-outlined text-[28px]" aria-hidden="true">add</span></span>
    <span class="min-w-0">
      <span class="block truncate font-body text-sm font-extrabold leading-tight tracking-[-0.015em] text-on-surface">Add bag</span>
      <span class="mt-1.5 block font-label text-[10px] font-extrabold uppercase leading-tight tracking-[0.04em] text-on-surface-variant">{{ unassigned }} {{ unassigned === 1 ? 'garment' : 'garments' }} not in a bag</span>
    </span>
    <span class="h-14 w-14" />
  </button>
</template>
