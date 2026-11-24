<script setup lang="ts">
import { computed, inject, onActivated, onDeactivated, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useStaffStore } from '@/data/staff/staff.store'
import { useDirectChatStore } from '@/data/direct-chat/direct-chat.store'
import InlineNotice from '@/shared/components/InlineNotice.vue'
import { useAuthStore } from '@/data/auth/auth.store'
import { enablePush, hasActivePushSubscription, needsHomeScreen, pushSupported } from '@/data/team-agent/push-notifications'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import AgentRow from '../components/AgentRow.vue'
import DirectChatRow from '../components/DirectChatRow.vue'
import NewChatPicker from '../components/NewChatPicker.vue'
import { AGENTS, agentVisibleToViewer } from '../agents'
import { agentsUnreadByAgentKey } from '@/shared/agents-unread'
import { isTeamAgentId, type AgentId } from '../agent-chat.types'

const router = useRouter()
const route = useRoute()
const staffStore = useStaffStore()
const directChat = useDirectChatStore()
const { inbox, inboxError } = storeToRefs(directChat)
const { role, isAdmin, staff } = storeToRefs(useAuthStore())
const unreadByAgent = inject(agentsUnreadByAgentKey, ref<Record<string, number>>({}))
const visibleAgents = computed(() => AGENTS.filter(agent => agentVisibleToViewer(agent, role.value, staffStore.hasActiveSecretary(staff.value?.staffId))))
const people = computed(() => [...inbox.value].sort((a, b) => Date.parse(b.last.at) - Date.parse(a.last.at)))
const unavailableNotice = computed(() => route.query.notice === 'conversation-unavailable')
const pickerOpen = ref(false)
const starting = ref(false)
const startError = ref<string | null>(null)
const eligiblePeople = computed(() => staffStore.items.filter(item =>
  item.active
  && (item.role === 'admin' || item.role === 'staff')
  && item.staffId !== staff.value?.staffId
  && !/^AI(-|$)/i.test(item.staffId)))
const peopleLoadError = computed(() => staffStore.error ? 'Could not load people' : null)
const supported = pushSupported()
const homeScreenRequired = needsHomeScreen()
const permission = ref<NotificationPermission>(supported ? Notification.permission : 'default')
const subscribed = ref<boolean>()
const enabling = ref(false)
const enableFailed = ref(false)
const showPushRow = computed(() => (role.value === 'admin' || role.value === 'staff')
  && (homeScreenRequired || supported)
  && (homeScreenRequired || permission.value !== 'granted' || subscribed.value === false || enabling.value))

async function refreshPushStatus(): Promise<void> {
  if (!supported || homeScreenRequired || enabling.value) return
  permission.value = Notification.permission
  const active = await hasActivePushSubscription().catch(() => false)
  if (!enabling.value) subscribed.value = active
}

onActivated(() => {
  window.addEventListener('focus', refreshPushStatus)
  void refreshPushStatus()
  void directChat.refreshInbox()
})
onDeactivated(() => {
  window.removeEventListener('focus', refreshPushStatus)
})

async function turnOnNotifications(): Promise<void> {
  if (!showPushRow.value || !supported || homeScreenRequired || enabling.value || permission.value === 'denied') return
  enabling.value = true
  enableFailed.value = false
  try {
    permission.value = await enablePush()
    subscribed.value = permission.value === 'granted'
  } catch {
    permission.value = Notification.permission
    subscribed.value = false
    enableFailed.value = true
  } finally {
    enabling.value = false
  }
}

function dismissNotice(): void {
  void router.replace({ name: 'agent-list' })
}

function openPicker(): void {
  startError.value = null
  pickerOpen.value = true
  if (!staffStore.loaded || staffStore.error) void staffStore.load()
}

async function startChat(peerStaffId: string): Promise<void> {
  if (starting.value) return
  starting.value = true
  startError.value = null
  try {
    const conversationId = await directChat.startConversation(peerStaffId)
    if (!conversationId) {
      startError.value = 'Could not start the chat. Try again.'
      return
    }
    pickerOpen.value = false
    await router.push({ name: 'direct-chat', params: { conversationId } })
  } catch {
    startError.value = 'Could not start the chat. Try again.'
  } finally {
    starting.value = false
  }
}

function openConversation(conversationId: string): void {
  void router.push({ name: 'direct-chat', params: { conversationId } })
}

function openAgent(agentId: AgentId): void {
  void router.push({ name: isTeamAgentId(agentId) ? 'team-agent-chat' : 'agent-chat', params: { agentId } })
}
</script>

<template>
  <ListPageLayout>
    <section>
      <div class="px-4 pb-2 pt-4">
        <div class="min-w-0 border-l-4 border-lime pl-2">
          <h2 class="font-headline text-xl font-bold leading-tight text-primary">Chats</h2>
          <span class="mt-0.5 block font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant">AI helpers and teammates</span>
        </div>
      </div>
      <div v-if="unavailableNotice" class="mx-3 mb-2.5">
        <InlineNotice tone="error" size="sm" dismissible @dismiss="dismissNotice">Conversation not available</InlineNotice>
      </div>
      <div v-if="showPushRow" class="mx-3 mb-2.5 flex flex-wrap items-center gap-2 font-body text-sm text-on-surface-variant">
        <p v-if="homeScreenRequired">To get notifications, add this app to your Home Screen first</p>
        <p v-else-if="permission === 'denied'">Notifications are blocked in this phone's settings</p>
        <template v-else>
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-full border-[1.5px] border-outline-variant bg-white px-4 font-body text-[13px] font-extrabold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime active:bg-surface-container disabled:opacity-50" :disabled="enabling" @click="turnOnNotifications">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">notifications</span>
            Turn on notifications
          </button>
          <p v-if="enableFailed" role="alert" class="text-error">Couldn’t turn on notifications. Try again.</p>
        </template>
      </div>
      <ul class="grid gap-2.5 px-3">
        <li v-for="agent in visibleAgents" :key="agent.id">
          <AgentRow :agent="agent" :unread="unreadByAgent[agent.id] ?? 0" @open="openAgent(agent.id)" />
        </li>
      </ul>
      <button v-if="isAdmin" type="button" class="mx-3 mt-2.5 grid min-h-[56px] w-[calc(100%-1.5rem)] grid-cols-[56px_minmax(0,1fr)_20px] items-center gap-3 rounded-[14px] bg-white py-2 pl-3 pr-2 text-left shadow-[0_1px_0_color-mix(in_srgb,var(--color-on-surface)_5%,transparent)] transition-transform active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-lime" @click="router.push({ name: 'personal-assignments' })">
        <span class="material-symbols-outlined justify-self-center text-[28px] text-primary" aria-hidden="true">assignment</span>
        <span class="min-w-0">
          <span class="block font-body text-sm font-extrabold leading-snug">Assignments</span>
          <span class="block font-label text-[11px] leading-snug text-on-surface-variant">Work assigned to employees through their assistants</span>
        </span>
        <span class="material-symbols-outlined text-[22px] text-primary opacity-35" aria-hidden="true">chevron_right</span>
      </button>
    </section>

    <section class="mt-5 pb-4" aria-label="People">
      <div class="flex items-center justify-between gap-3 px-4 pb-2">
        <div class="min-w-0 border-l-4 border-lime pl-2">
          <h2 class="font-headline text-xl font-bold leading-tight text-primary">People</h2>
          <span class="mt-0.5 block font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant">Direct messages</span>
        </div>
        <button type="button" class="inline-flex h-9 flex-none items-center gap-1.5 rounded-full border-[1.5px] border-outline-variant bg-white px-3.5 font-body text-[13px] font-extrabold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime active:bg-surface-container" @click="openPicker">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">edit_square</span>
          New chat
        </button>
      </div>
      <ul v-if="people.length" class="grid gap-2.5 px-3">
        <li v-for="conversation in people" :key="conversation.conversationId">
          <DirectChatRow :conversation="conversation" @open="openConversation(conversation.conversationId)" />
        </li>
      </ul>
      <p v-else-if="inboxError" class="mx-4 font-body text-sm text-on-surface-variant" role="status">
        Could not load chats
        <button type="button" class="ml-1 min-h-11 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime" @click="directChat.refreshInbox()">Retry</button>
      </p>
      <p v-else-if="directChat.inboxLoading" class="mx-4 font-body text-sm text-on-surface-variant" role="status">Loading…</p>
      <p v-else class="mx-4 font-body text-sm text-on-surface-variant">No conversations yet.</p>
      <p class="mx-4 mt-3 font-label text-[11px] leading-snug text-on-surface-variant">Messages to people are translated by AI (OpenAI receives the message and recent context).</p>
    </section>

    <NewChatPicker
      :open="pickerOpen"
      :people="eligiblePeople"
      :loading="staffStore.loading"
      :error="peopleLoadError"
      :start-error="startError"
      :starting="starting"
      @close="pickerOpen = false"
      @retry="staffStore.load()"
      @pick="startChat"
    />
  </ListPageLayout>
</template>
