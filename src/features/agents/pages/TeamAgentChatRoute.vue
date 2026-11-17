<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/data/auth/auth.store'
import TeamAgentChatPage from './TeamAgentChatPage.vue'
import type { TeamAgentId } from '../agent-chat.types'

const props = defineProps<{ agentId: TeamAgentId; staffId?: string }>()

const { staff } = storeToRefs(useAuthStore())
const pageKey = computed(() => `${props.agentId}:${props.staffId ?? ''}:${staff.value?.staffId ?? ''}`)
</script>

<template>
  <TeamAgentChatPage :key="pageKey" :agent-id="agentId" :staff-id="staffId" />
</template>
