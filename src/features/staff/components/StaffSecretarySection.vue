<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import FormSwitch from '@/shared/components/FormSwitch.vue'
import InlineNotice from '@/shared/components/InlineNotice.vue'
import ReportCard from '@/shared/components/reports/ReportCard.vue'
import { useStaffStore } from '@/data/staff/staff.store'
import type { StaffSecretary } from '@/data/staff/staff.service'
import { useSecretarySettingsStore } from '@/data/team-agent/secretary-settings.store'

const props = defineProps<{ staffId: string }>()

const staffStore = useStaffStore()
const settingsStore = useSecretarySettingsStore()
const { settings, loading: settingsLoading } = storeToRefs(settingsStore)

const secretary = ref<StaffSecretary | null>(null)
const reading = ref(false)
const toggling = ref(false)
const secretaryError = ref<string | null>(null)
let latestInit = 0
let activated = false

const active = computed(() => secretary.value?.active === true)
const serviceUnavailable = computed(() => active.value && !settingsLoading.value && !settings.value)

async function loadSettings(): Promise<void> {
  try {
    await settingsStore.load(props.staffId)
  } catch {
    // The store records the failure; the section shows "Secretary service unavailable".
  }
}

async function init(): Promise<void> {
  const id = ++latestInit
  const target = props.staffId
  secretary.value = null
  secretaryError.value = null
  reading.value = true
  const settingsRead = loadSettings()
  try {
    const row = await staffStore.readSecretary(target)
    if (id === latestInit) secretary.value = row
  } catch {
    if (id === latestInit) secretaryError.value = 'Could not load the secretary'
  } finally {
    if (id === latestInit) reading.value = false
  }
  await settingsRead
}

async function toggle(next: boolean): Promise<void> {
  if (toggling.value) return
  const target = props.staffId
  toggling.value = true
  secretaryError.value = null
  try {
    const row = next ? await staffStore.enableSecretary(target) : await staffStore.disableSecretary(target)
    if (target !== props.staffId) return
    secretary.value = row
    if (row.active) await loadSettings()
  } catch {
    if (target === props.staffId) secretaryError.value = next ? 'Could not turn the secretary on' : 'Could not turn the secretary off'
  } finally {
    toggling.value = false
  }
}

watch(() => props.staffId, () => {
  toggling.value = false
  void init()
}, { immediate: true })

// The profile page stays cached; read again on every visit.
onActivated(() => {
  if (!activated) {
    activated = true
    return
  }
  void init()
})
</script>

<template>
  <ReportCard title="Secretary" heading-id="profile-secretary">
    <p v-if="reading && !secretary" class="text-[13px] text-on-primary/60" role="status">Loading…</p>

    <p v-else-if="!secretary" class="text-[13px] text-on-primary/60" role="status">
      {{ secretaryError }}
      <button type="button" class="ml-1 min-h-11 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime" @click="init()">Retry</button>
    </p>

    <div v-else class="grid gap-4 rounded-2xl bg-surface-container-lowest p-4">
      <div :inert="toggling" :class="{ 'opacity-50': toggling }">
        <FormSwitch
          :model-value="active"
          label="Personal secretary"
          description="Lets this employee chat with their own secretary"
          @update:model-value="toggle"
        />
      </div>
      <InlineNotice v-if="secretaryError" tone="error" size="sm">{{ secretaryError }}</InlineNotice>

      <template v-if="active">
        <p v-if="serviceUnavailable" class="text-[13px] text-on-surface-variant" role="status">Secretary service unavailable</p>

        <div v-else-if="settings" class="flex items-center justify-between gap-3 text-[14px]">
          <span class="font-bold text-on-surface">Codex</span>
          <span class="font-semibold" :class="settings.codexReady ? 'text-success' : 'text-on-surface-variant'">
            {{ settings.codexReady ? 'Connected' : 'Not connected' }}
          </span>
        </div>
      </template>
    </div>
  </ReportCard>
</template>
