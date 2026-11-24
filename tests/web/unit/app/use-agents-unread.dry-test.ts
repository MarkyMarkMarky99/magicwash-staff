import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { effectScope, reactive, nextTick } from 'vue'

const dm = reactive({ unreadTotal: 7, calls: 0, refreshInbox: async () => { dm.calls++ } })
const agents = new Map<string, ReturnType<typeof makeAgent>>()
function makeAgent() { return reactive({ unreadCount: 2, latestUnreadAi: null, bindViewer: (_viewer: string | null) => {}, refresh: async () => {} }) }
const eligibility = reactive({ visible: false })
mock.module('../../../../src/data/direct-chat/direct-chat.store.ts', { namedExports: { useDirectChatStore: () => dm } })
mock.module('../../../../src/data/staff/staff.store.ts', { namedExports: { useStaffStore: () => ({ hasActiveSecretary: () => false }) } })
mock.module('../../../../src/data/team-agent/team-agent.store.ts', { namedExports: { useTeamAgentStore: (id: string) => { if (!agents.has(id)) agents.set(id, makeAgent()); return agents.get(id)! } } })
mock.module('../../../../src/features/agents/agents.ts', { namedExports: { agentById: (id: string) => ({ id }), agentVisibleToViewer: () => eligibility.visible } })
const { useAgentsUnread } = await import('@/app/composables/useAgentsUnread')
const viewer = reactive({ role: 'staff' as 'staff' | 'device' | null, id: 'S1' as string | null })
const scope = effectScope()
const unread = scope.run(() => useAgentsUnread(() => viewer.role, () => viewer.id))!
assert.equal(dm.calls, 1)
assert.equal(unread.total.value, 7)
assert.equal(unread.aiTotal.value, 0)
assert.equal(unread.latest.value, null)
eligibility.visible = true
await nextTick()
const aiSum = agents.size * 2
assert.equal(unread.total.value, aiSum + 7)
assert.equal(unread.aiTotal.value, aiSum)
dm.unreadTotal = 99
assert.equal(unread.aiTotal.value, aiSum)
assert.equal(unread.total.value, aiSum + 99)
const calls = dm.calls
viewer.role = 'device'
await nextTick()
assert.equal(dm.calls, calls)
scope.stop()
console.log('agents unread navigation and AI bubble totals dry test passed')
