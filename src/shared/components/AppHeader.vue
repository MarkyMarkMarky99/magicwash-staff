<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter, useRoute } from 'vue-router'
import logoUrl from '../../assets/logo.png'
import { useAppointmentStore } from '@/features/appointments/stores/appointment.store'
import { useHeaderSearch } from '@/shared/composables/useHeaderSearch'
import { useGoBack } from '@/shared/composables/use-go-back'
import NavSidebar from './NavSidebar.vue'

const router = useRouter()
const route  = useRoute()
const sidebarOpen = ref(false)
const { searchOpen, toggleSearch } = useHeaderSearch()
const { pendingCount } = storeToRefs(useAppointmentStore())
const { goBack } = useGoBack()

const canSearch = computed(() => route.meta.searchable === true)
const canGoBack = computed(() => Boolean(route.meta.parent))

watch(
  () => route.path,
  () => {
    searchOpen.value = false
  },
)

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

      <!-- Back button — shown on routes with a declared parent -->
      <button
        v-if="canGoBack"
        class="material-symbols-outlined hover:bg-white/10 rounded-full transition-colors p-1"
        aria-label="Go back"
        @click="goBack"
      >arrow_back</button>

      <!-- Action buttons — shown on main pages -->
      <template v-else-if="route.name === 'appointment-schedule'">
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
