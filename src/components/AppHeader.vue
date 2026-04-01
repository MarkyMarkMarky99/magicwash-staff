<script setup>
import logoUrl from '../assets/logo.png'
</script>

<template>
  <header class="flex-none bg-primary text-on-primary px-4 py-3 flex items-center justify-between shadow-md z-50 w-full min-w-0">
    <div class="flex items-center gap-2">
      <img :src="logoUrl" alt="Magicwash Laundry" class="h-9 w-9 object-contain" />
      <h1 class="text-lg font-headline font-bold tracking-tight">Magicwash Laundry</h1>
    </div>
    <div class="flex items-center gap-4">
      <button class="material-symbols-outlined hover:bg-white/10 rounded-full transition-colors p-1" aria-label="Search">search</button>
      <button class="material-symbols-outlined hover:bg-white/10 rounded-full transition-colors p-1" aria-label="More options">more_vert</button>
    </div>
  </header>
</template>
