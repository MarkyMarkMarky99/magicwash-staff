<script setup lang="ts">
import { computed } from 'vue'
import type { DirectChatMessage } from '@/data/direct-chat/direct-chat.service'

const LANGUAGE_NAMES = { th: 'Thai', my: 'Burmese', en: 'English' } as const

const props = defineProps<{ message: DirectChatMessage; own: boolean; retrying?: boolean }>()
defineEmits<{ retry: [seq: number] }>()

const translate = computed(() => props.message.translate)
const hasText = computed(() => props.message.text.trim().length > 0)
const language = computed(() => (translate.value?.to ? LANGUAGE_NAMES[translate.value.to] : null))
const kind = computed<'pending' | 'unavailable' | 'done' | null>(() => {
  const value = translate.value
  if (!hasText.value || !value || value.state === 'off') return null
  if (props.retrying || value.state === 'pending') return 'pending'
  if (value.state === 'unavailable') return 'unavailable'
  return value.same || !value.text ? null : 'done'
})
</script>

<template>
  <div v-if="kind" class="mt-1 flex max-w-full flex-col gap-0.5 px-1 font-label text-[11px] leading-snug text-on-surface-variant" :class="own ? 'items-end text-right' : 'items-start text-left'">
    <p v-if="kind === 'pending'" role="status">Translating…</p>
    <p v-else-if="kind === 'unavailable'" role="status">
      Translation unavailable
      <button type="button" class="ml-1 min-h-8 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime" @click="$emit('retry', message.seq)">Retry</button>
    </p>
    <p v-else-if="own" class="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      Sent as {{ language ?? 'translation' }}:
      <span class="font-body text-[13px] leading-relaxed text-on-surface" :lang="translate?.to">{{ translate?.text }}</span>
    </p>
    <template v-else>
      <p>Translated{{ language ? ` · ${language}` : '' }}</p>
      <p class="whitespace-pre-wrap break-words font-body text-[13px] leading-relaxed text-on-surface [overflow-wrap:anywhere]" :lang="translate?.to">{{ translate?.text }}</p>
    </template>
  </div>
</template>
