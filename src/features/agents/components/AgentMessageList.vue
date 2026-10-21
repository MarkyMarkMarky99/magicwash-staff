<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import {
  isCustomerProposal,
  isPriceProposal,
  isTrackingProposal,
  type AgentChat,
  type CustomerProposal,
} from '../agent-chat.types'
import type { AgentInfo } from '../agents'
import AgentAvatar from './AgentAvatar.vue'
import CustomerProposalCard from './CustomerProposalCard.vue'
import PriceProposalCard from './PriceProposalCard.vue'
import TrackingProposalCard from './TrackingProposalCard.vue'

const props = defineProps<{ agent: AgentInfo; chat: AgentChat }>()
defineEmits<{ suggest: [text: string]; retry: []; openCustomerForm: [proposal: CustomerProposal] }>()

const region = ref<{ el: HTMLElement | null } | null>(null)

watch(() => [props.chat.messages.length, props.chat.thinking], async () => {
  await nextTick()
  const el = region.value?.el
  if (el) el.scrollTop = el.scrollHeight
}, { flush: 'post' })
</script>

<template>
  <ScrollRegion ref="region" class="flex flex-col gap-3 bg-surface px-3 pb-4 pt-3.5">
    <div v-if="!chat.messages.length && !chat.thinking" class="my-auto flex flex-col items-center gap-3.5 px-2 text-center">
      <span class="rounded-full shadow-[0_0_0_4px_white]"><AgentAvatar :agent-id="agent.id" :size="104" /></span>
      <div class="max-w-[340px] rounded-[18px] bg-white px-4 py-3 font-body text-sm leading-relaxed shadow-[0_1px_0_color-mix(in_srgb,var(--color-on-surface)_6%,transparent)]">
        <b class="mb-0.5 block font-headline text-base font-extrabold text-primary">{{ agent.name }}</b>
        {{ agent.greeting }}
      </div>
      <div class="flex w-full max-w-[340px] flex-col gap-2">
        <button v-for="suggestion in agent.suggestions" :key="suggestion.text" type="button" class="flex min-h-[46px] items-center gap-2 rounded-full border-[1.5px] border-outline-variant bg-white px-4 py-2 text-left font-body text-[13.5px] font-bold leading-snug text-primary focus-visible:outline-2 focus-visible:outline-lime active:border-lime active:bg-secondary-container" @click="$emit('suggest', suggestion.text)">
          <span class="material-symbols-outlined shrink-0 text-[18px] text-primary-container" aria-hidden="true">{{ suggestion.icon }}</span>{{ suggestion.text }}
        </button>
      </div>
    </div>

    <template v-else>
      <div v-for="message in chat.messages" :key="message.id" class="flex items-end gap-2" :class="message.role === 'staff' ? 'justify-end' : ''">
        <template v-if="message.role === 'staff'">
          <div class="flex min-w-0 max-w-[86%] flex-col items-end gap-2.5">
            <div v-if="message.imageUrls.length" class="flex flex-wrap justify-end gap-1.5">
              <img v-for="url in message.imageUrls" :key="url" :src="url" alt="รูปที่แนบ" class="rounded-xl border-2 border-white bg-surface-container object-cover" :class="message.imageUrls.length === 1 ? 'h-40 w-40' : 'h-[92px] w-[92px]'" />
            </div>
            <p v-if="message.text" class="whitespace-pre-wrap break-words rounded-[18px_6px_18px_18px] bg-lime px-3.5 py-2 font-body text-sm font-semibold leading-relaxed text-primary [overflow-wrap:anywhere]">{{ message.text }}</p>
          </div>
        </template>

        <template v-else-if="message.role === 'agent'">
          <span class="self-start"><AgentAvatar :agent-id="agent.id" :size="32" /></span>
          <div class="flex min-w-0 max-w-[calc(100%-44px)] flex-col">
            <p class="whitespace-pre-wrap break-words rounded-[6px_18px_18px_18px] bg-white px-3.5 py-2 font-body text-sm leading-relaxed shadow-[0_1px_0_color-mix(in_srgb,var(--color-on-surface)_6%,transparent)] [overflow-wrap:anywhere]">{{ message.text }}</p>
            <template v-if="message.proposal">
              <CustomerProposalCard v-if="isCustomerProposal(message.proposal)" :proposal="message.proposal" :warnings="message.warnings" @open="$emit('openCustomerForm', $event)" />
              <PriceProposalCard v-else-if="isPriceProposal(message.proposal)" :proposal="message.proposal" />
              <TrackingProposalCard v-else-if="isTrackingProposal(message.proposal)" :proposal="message.proposal" />
            </template>
          </div>
        </template>

        <template v-else>
          <span class="self-start"><AgentAvatar :agent-id="agent.id" :size="32" /></span>
          <div role="alert" class="min-w-0 rounded-[6px_18px_18px_18px] bg-error-container px-3.5 py-2 font-body text-sm leading-relaxed text-on-error-container">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined fill-icon text-[20px] text-error" aria-hidden="true">error</span>
              <span>{{ message.text ?? 'AI ไม่ว่างตอนนี้ ลองใหม่อีกครั้ง' }}</span>
            </div>
            <button type="button" class="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full bg-error px-4 font-body text-[13px] font-extrabold text-on-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-50" :disabled="chat.thinking" @click="$emit('retry')">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">refresh</span>ลองใหม่
            </button>
          </div>
        </template>
      </div>

      <div v-if="chat.thinking" class="flex items-end gap-2" role="status">
        <span class="self-start"><AgentAvatar :agent-id="agent.id" :size="32" /></span>
        <div class="flex items-center gap-2.5 rounded-[6px_18px_18px_18px] bg-white px-3.5 py-2.5 shadow-[0_1px_0_color-mix(in_srgb,var(--color-on-surface)_6%,transparent)]">
          <span class="inline-flex gap-1" aria-hidden="true">
            <i v-for="n in 3" :key="n" class="h-[7px] w-[7px] animate-bounce rounded-full bg-primary motion-reduce:animate-none" :style="{ animationDelay: `${(n - 1) * 0.18}s` }" />
          </span>
          <span class="font-body text-[12.5px] font-semibold text-on-surface-variant">กำลังคิด… (ปกติ 10–20 วินาที)</span>
        </div>
      </div>
    </template>
  </ScrollRegion>
</template>
