<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import { useGoBack } from '@/shared/composables/use-go-back'
import { customerCreateRoute } from '@/shared/navigation/form-routes'
import AgentChatBar from '../components/AgentChatBar.vue'
import AgentComposer from '../components/AgentComposer.vue'
import AgentMessageList from '../components/AgentMessageList.vue'
import { agentById } from '../agents'
import { isAgentId, type AgentId } from '../agent-chat.types'
import { useAgentChatStore } from '../stores/agent-chat.store'

const props = defineProps<{ agentId: string }>()

const router = useRouter()
const { goBack } = useGoBack()
const store = useAgentChatStore()

const validId = computed<AgentId | null>(() => isAgentId(props.agentId) ? props.agentId : null)
const agent = computed(() => validId.value ? agentById(validId.value) : null)
const chat = computed(() => validId.value ? store.chats[validId.value] : null)
const noticeVisible = ref(true)
const endOpen = ref(false)
const composer = ref<{ focus: () => void } | null>(null)

watch(validId, (id) => {
  if (!id) void router.replace({ name: 'agent-list' })
}, { immediate: true })

function confirmEnd(): void {
  if (validId.value) store.reset(validId.value)
  endOpen.value = false
}

function openCustomerForm(): void {
  void router.push(customerCreateRoute())
}
</script>

<template>
  <div v-if="agent && chat && validId" class="relative flex h-full w-full flex-col overflow-hidden bg-surface font-body text-on-surface">
    <AgentChatBar :agent="agent" @back="goBack" @end="endOpen = true" />

    <div v-if="noticeVisible" class="flex flex-none items-center gap-2 bg-secondary-container py-2 pl-3.5 pr-2 font-body text-xs font-semibold leading-snug text-on-secondary-container" role="status">
      <span class="material-symbols-outlined shrink-0 text-[16px]" aria-hidden="true">info</span>
      <span class="flex-1">บทสนทนาไม่ถูกบันทึก — รีเฟรชหรือปิดแอปจะเริ่มใหม่</span>
      <button type="button" class="grid h-8 w-8 shrink-0 place-items-center rounded-full opacity-70 focus-visible:outline-2 focus-visible:outline-lime active:bg-black/10" aria-label="ปิดข้อความ" @click="noticeVisible = false">
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
      </button>
    </div>

    <AgentMessageList
      :agent="agent"
      :chat="chat"
      @suggest="store.sendText(validId, $event)"
      @retry="store.retry(validId)"
      @open-customer-form="openCustomerForm"
      @edit-in-chat="composer?.focus()"
    />

    <AgentComposer
      ref="composer"
      :text="chat.draftText"
      :images="chat.draftImages"
      :thinking="chat.thinking"
      @update:text="store.setDraftText(validId, $event)"
      @add-files="store.addDraftImages(validId, $event)"
      @remove-image="store.removeDraftImage(validId, $event)"
      @send="store.send(validId)"
    />

    <ConfirmOverlay :open="endOpen" title="จบบทสนทนานี้?" description="ประวัติจะถูกล้าง" @close="endOpen = false" @confirm="confirmEnd">
      <template #footer>
        <footer class="flex flex-none flex-col gap-2 px-5 pb-5 pt-4">
          <button type="submit" class="h-[46px] rounded-full bg-error px-4 font-body text-sm font-extrabold text-on-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime">จบงาน</button>
          <button type="button" class="h-[46px] rounded-full border-[1.5px] border-outline-variant bg-white px-4 font-body text-sm font-extrabold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" @click="endOpen = false">ยกเลิก</button>
        </footer>
      </template>
    </ConfirmOverlay>
  </div>
</template>
