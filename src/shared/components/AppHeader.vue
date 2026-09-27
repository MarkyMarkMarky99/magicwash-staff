<script setup>
import { computed, inject, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import logoUrl from '../../assets/logo.png'
import { appointmentPendingCountKey } from '@/shared/appointment-pending-count'
import { useGoBack } from '@/shared/composables/use-go-back'
import { APP_Z_INDEX_CLASS } from '@/shared/layouts/z-index'
import NavSidebar from './NavSidebar.vue'
import CloseButton from './CloseButton.vue'

const router = useRouter()
const route  = useRoute()
const pendingCount = inject(appointmentPendingCountKey, ref(0))
const sidebarOpen = ref(false)
const { goBack } = useGoBack()

const canGoBack = computed(() => Boolean(route.meta.parent))

</script>

<template>
  <header
    class="flex-none bg-primary text-on-primary px-4 pb-3 flex items-center justify-between shadow-md w-full min-w-0 pt-[calc(0.75rem+env(safe-area-inset-top))]"
    :class="APP_Z_INDEX_CLASS.header"
  >
    <div class="flex items-center gap-2">
      <CloseButton icon="menu" label="Open menu" tone="onDark" @click="sidebarOpen = true" />
      <img :src="logoUrl" alt="Magicwash Laundry" class="h-9 w-9 object-contain" />
      <h1 class="text-lg font-headline font-bold tracking-tight">Magicwash Laundry</h1>
    </div>
    <div class="flex items-center gap-2">
      <CloseButton
        v-if="canGoBack"
        icon="arrow_back"
        label="Go back"
        tone="onDark"
        @click="goBack"
      />

      <template v-else-if="route.name === 'appointment-schedule'">
        <CloseButton icon="pending_actions" label="Pending requests" tone="onDark" @click="router.push('/pending')">
          <span
            v-if="pendingCount > 0"
            class="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] rotate-[7deg] items-center justify-center rounded-full bg-error px-1 text-[9px] font-bold leading-none text-on-error"
          >
            {{ pendingCount > 99 ? '99+' : pendingCount }}
          </span>
        </CloseButton>
      </template>
    </div>
  </header>

  <NavSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
</template>
