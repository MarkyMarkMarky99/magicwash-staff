<script setup>
import { useRouter, useRoute } from 'vue-router'
import logoUrl from '../assets/logo.png'
import { pendingCount } from '../composables/usePendingCount'

const router = useRouter()
const route  = useRoute()
</script>

<template>
  <header class="flex-none bg-primary text-on-primary px-4 py-3 flex items-center justify-between shadow-md z-50 w-full min-w-0">
    <div class="flex items-center gap-2">
      <img :src="logoUrl" alt="Magicwash Laundry" class="h-9 w-9 object-contain" />
      <h1 class="text-lg font-headline font-bold tracking-tight">Magicwash Laundry</h1>
    </div>
    <div class="flex items-center gap-2">
      <button class="material-symbols-outlined hover:bg-white/10 rounded-full transition-colors p-1" aria-label="Search">search</button>

      <!-- Close button — shown only on /pending -->
      <button
        v-if="route.path === '/pending'"
        class="material-symbols-outlined hover:bg-white/10 rounded-full transition-colors p-1"
        aria-label="Close"
        @click="router.push('/')"
      >close</button>

      <!-- Requests button — shown on all other pages -->
      <button
        v-else
        class="relative hover:bg-white/10 rounded-full transition-colors p-1 flex items-center justify-center"
        aria-label="Pending requests"
        @click="router.push('/pending')"
      >
        <span class="material-symbols-outlined">pending_actions</span>
        <span
          v-if="pendingCount > 0"
          class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-error text-on-error text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none"
        >
          {{ pendingCount > 99 ? '99+' : pendingCount }}
        </span>
      </button>
    </div>
  </header>
</template>
