<script setup lang="ts">
import TeamAgentChatPage from './TeamAgentChatPage.vue'
import type { TeamAgentId } from '../agent-chat.types'

defineProps<{ agentId: TeamAgentId }>()
</script>

<template>
  <TeamAgentChatPage :key="agentId" :agent-id="agentId" />
</template>
