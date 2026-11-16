<script setup lang="ts">
import PickerOverlay from '@/shared/layouts/PickerOverlay.vue'
import InlineNotice from '@/shared/components/InlineNotice.vue'
import SectionHeader from '@/shared/components/SectionHeader.vue'
import type {
  AppointmentsAgentNote,
  AppointmentsAgentReminder,
} from '@/data/appointments-agent/appointments-agent.service'
import { formatEventTime } from '../utils/format-event-time'

defineProps<{
  open: boolean
  reminders: AppointmentsAgentReminder[]
  notes: AppointmentsAgentNote[]
  loading: boolean
  error: string | null
  cancellingId: string | null
}>()
defineEmits<{ close: []; cancelReminder: [id: string] }>()
</script>

<template>
  <PickerOverlay :open="open" ariaLabel="Reminders and notes" @close="$emit('close')">
    <div class="flex flex-col gap-5 px-4 pb-6 pt-5">
      <InlineNotice v-if="error" tone="error" icon="error">{{ error }}</InlineNotice>
      <p v-if="loading" class="text-center font-body text-sm text-on-surface-variant" role="status">Loading…</p>

      <section>
        <SectionHeader title="Reminders" subtitle="Pending" />
        <p v-if="!loading && !reminders.length" class="font-body text-sm text-on-surface-variant">No pending reminders.</p>
        <ul class="grid gap-2">
          <li v-for="reminder in reminders" :key="reminder.id" class="flex items-start gap-3 rounded-[14px] bg-white px-3.5 py-3 shadow-[0_1px_0_color-mix(in_srgb,var(--color-on-surface)_5%,transparent)]">
            <div class="min-w-0 flex-1">
              <b class="block font-body text-sm font-extrabold text-primary">{{ formatEventTime(reminder.dueAt) }}</b>
              <p class="mt-0.5 whitespace-pre-wrap break-words font-body text-sm leading-snug [overflow-wrap:anywhere]">{{ reminder.note }}</p>
              <span class="mt-1 block font-label text-[10px] font-bold uppercase text-on-surface-variant">Created {{ formatEventTime(reminder.createdAt) }}</span>
            </div>
            <button type="button" class="h-9 shrink-0 rounded-full border-[1.5px] border-error px-3.5 font-body text-[13px] font-extrabold text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime active:bg-error-container disabled:opacity-50" :disabled="cancellingId !== null" @click="$emit('cancelReminder', reminder.id)">
              {{ cancellingId === reminder.id ? 'Cancelling…' : 'Cancel' }}
            </button>
          </li>
        </ul>
      </section>

      <section>
        <SectionHeader title="AI notes" subtitle="Read only" />
        <p v-if="!loading && !notes.length" class="font-body text-sm text-on-surface-variant">No notes yet.</p>
        <ul class="grid gap-2">
          <li v-for="note in notes" :key="note.name" class="rounded-[14px] bg-white px-3.5 py-3 shadow-[0_1px_0_color-mix(in_srgb,var(--color-on-surface)_5%,transparent)]">
            <b class="block break-words font-body text-sm font-extrabold text-primary [overflow-wrap:anywhere]">{{ note.name }}</b>
            <p class="mt-1 whitespace-pre-wrap break-words font-body text-[13px] leading-relaxed [overflow-wrap:anywhere]">{{ note.content }}</p>
          </li>
        </ul>
      </section>
    </div>
  </PickerOverlay>
</template>
