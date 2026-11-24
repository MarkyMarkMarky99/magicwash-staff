<script setup lang="ts">
import { computed } from 'vue'
import PickerOverlay from '@/shared/layouts/PickerOverlay.vue'
import InlineNotice from '@/shared/components/InlineNotice.vue'
import type { StaffDto } from '@/data/staff/staff.service'

const props = defineProps<{
  open: boolean
  people: StaffDto[]
  loading: boolean
  error: string | null
  startError: string | null
  starting: boolean
}>()
const emit = defineEmits<{ close: []; retry: []; pick: [staffId: string] }>()

const sorted = computed(() => [...props.people].sort((a, b) => a.name.localeCompare(b.name)))
</script>

<template>
  <PickerOverlay :open="open" ariaLabel="Start a new chat" @close="emit('close')">
    <template #header>
      <header class="bg-primary px-4 pb-4 pt-5 text-on-primary">
        <p class="font-label text-[11px] font-bold text-lime">CHATS</p>
        <h2 class="mt-1 pr-12 font-headline text-xl font-bold">New chat</h2>
      </header>
    </template>

    <div class="grid gap-2 px-3 pb-6 pt-4" :aria-busy="starting">
      <InlineNotice v-if="startError" tone="error" size="sm">{{ startError }}</InlineNotice>
      <p v-if="loading && !people.length" class="py-6 text-center font-body text-sm text-on-surface-variant" role="status">Loading…</p>
      <div v-else-if="error && !people.length" class="grid gap-2 py-4 text-center" role="alert">
        <p class="font-body text-sm text-on-surface-variant">{{ error }}</p>
        <button type="button" class="mx-auto h-9 rounded-full border-[1.5px] border-outline-variant bg-white px-4 font-body text-[13px] font-extrabold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime active:bg-surface-container" @click="emit('retry')">Retry</button>
      </div>
      <p v-else-if="!sorted.length" class="py-6 text-center font-body text-sm text-on-surface-variant">No one to chat with yet.</p>
      <ul v-else class="grid gap-2">
        <li v-for="person in sorted" :key="person.staffId">
          <button type="button" class="flex min-h-[56px] w-full items-center gap-3 rounded-[14px] bg-white px-3 py-2 text-left shadow-[0_1px_0_color-mix(in_srgb,var(--color-on-surface)_5%,transparent)] transition-transform active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-50" :disabled="starting" @click="emit('pick', person.staffId)">
            <span class="grid h-10 w-10 flex-none place-items-center rounded-full bg-secondary-container font-headline text-base font-extrabold text-primary" aria-hidden="true">{{ Array.from(person.name.trim())[0]?.toUpperCase() ?? '?' }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-body text-sm font-extrabold leading-snug">{{ person.name }}</span>
              <span v-if="person.position" class="block truncate font-label text-[11px] leading-snug text-on-surface-variant">{{ person.position }}</span>
            </span>
            <span class="material-symbols-outlined w-5 text-[22px] text-primary opacity-35" aria-hidden="true">chevron_right</span>
          </button>
        </li>
      </ul>
    </div>
  </PickerOverlay>
</template>
