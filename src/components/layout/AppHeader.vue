<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter, useRoute } from 'vue-router'
import logoUrl from '../../assets/logo.png'
import { useAppointmentStore } from '@/features/appointments/stores/appointment.store'
import { useHeaderSearch } from '@/shared/composables/useHeaderSearch'
import NavSidebar from './NavSidebar.vue'

const router = useRouter()
const route  = useRoute()
const sidebarOpen = ref(false)
const { searchOpen, toggleSearch } = useHeaderSearch()
const { pendingCount } = storeToRefs(useAppointmentStore())

const SEARCHABLE_ROUTES = ['/customers', '/invoices']
const canSearch = computed(() => SEARCHABLE_ROUTES.includes(route.path))
const isGallery = computed(() => route.path.startsWith('/gallery/'))

function goBack() {
  if (route.name === 'customer-packages-preview') {
    router.push({ name: 'customer-list' })
    return
  }

  if (route.name === 'invoice-detail') {
    router.push({ name: 'invoice-list' })
    return
  }

  if (isGallery.value || route.name === 'invoice-create') {
    router.back()
    return
  }

  router.push({ name: 'customer-list' })
}
</script>

<template>
  <header class="flex-none bg-primary text-on-primary px-4 py-3 flex items-center justify-between shadow-md z-50 w-full min-w-0">
    <div class="flex items-center gap-2">
      <button
        class="material-symbols-outlined hover:bg-white/10 rounded-full transition-colors p-1"
        aria-label="Open menu"
        @click="sidebarOpen = true"
      >menu</button>
      <img :src="logoUrl" alt="Magicwash Laundry" class="h-9 w-9 object-contain" />
      <h1 class="text-lg font-headline font-bold tracking-tight">Magicwash Laundry</h1>
    </div>
    <div class="flex items-center gap-2">
      <button
        class="material-symbols-outlined hover:bg-white/10 rounded-full transition-colors p-1"
        :class="searchOpen && canSearch ? 'bg-white/20' : ''"
        aria-label="Search"
        @click="canSearch && toggleSearch()"
      >search</button>

      <!-- Back button — shown on detail pages -->
      <button
        v-if="route.name === 'customer-packages-preview' || route.name === 'customer-order-history' || route.name === 'invoice-create' || route.name === 'invoice-detail' || isGallery"
        class="material-symbols-outlined hover:bg-white/10 rounded-full transition-colors p-1"
        aria-label="Go back"
        @click="goBack"
      >arrow_back</button>

      <!-- Close button — shown on collection pages outside the schedule -->
      <button
        v-else-if="route.name === 'appointment-pending' || route.path === '/customers'"
        class="material-symbols-outlined hover:bg-white/10 rounded-full transition-colors p-1"
        aria-label="Close"
        @click="router.push('/')"
      >close</button>

      <!-- Action buttons — shown on main pages -->
      <template v-else>
        <button
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
      </template>
    </div>
  </header>

  <NavSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
</template>
