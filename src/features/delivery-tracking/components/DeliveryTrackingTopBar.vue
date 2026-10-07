<script setup lang="ts">
import logoUrl from '@/assets/logo.png'
</script>

<template>
  <header class="flex h-[60px] shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest pl-0.5 pr-4">
    <img :src="logoUrl" alt="Magicwash Laundry, Dry Cleaning" class="-my-[22px] block h-[104px] w-[104px]">
    <span class="text-[13px] font-medium text-on-surface-variant">Your bag</span>
  </header>
</template>
