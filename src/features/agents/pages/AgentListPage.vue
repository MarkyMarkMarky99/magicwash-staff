<script setup lang="ts">
import { computed, inject, onActivated, onDeactivated, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useStaffStore } from '@/data/staff/staff.store'
import { useAuthStore } from '@/data/auth/auth.store'
import { enablePush, hasActivePushSubscription, needsHomeScreen, pushSupported } from '@/data/team-agent/push-notifications'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import AgentRow from '../components/AgentRow.vue'
import { AGENTS, agentVisibleToViewer } from '../agents'
import { agentsUnreadByAgentKey } from '@/shared/agents-unread'
import { isTeamAgentId, type AgentId } from '../agent-chat.types'

const router = useRouter()
const staffStore = useStaffStore()
const { role, isAdmin, staff } = storeToRefs(useAuthStore())
const unreadByAgent = inject(agentsUnreadByAgentKey, ref<Record<string, number>>({}))
const visibleAgents = computed(() => AGENTS.filter(agent => agentVisibleToViewer(agent, role.value, staffStore.hasActiveSecretary(staff.value?.staffId))))
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

function openAgent(agentId: AgentId): void {
  void router.push({ name: isTeamAgentId(agentId) ? 'team-agent-chat' : 'agent-chat', params: { agentId } })
}
</script>

<template>
  <ListPageLayout>
    <section>
      <div class="px-4 pb-2 pt-4">
        <div class="min-w-0 border-l-4 border-lime pl-2">
          <h2 class="font-headline text-xl font-bold leading-tight text-primary">Agents</h2>
          <span class="mt-0.5 block font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant">Chat with AI helpers</span>
        </div>
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
  </ListPageLayout>
</template>
