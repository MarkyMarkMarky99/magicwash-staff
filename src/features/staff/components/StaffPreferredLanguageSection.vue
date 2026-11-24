<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import FormOptionGrid from '@/shared/components/FormOptionGrid.vue'
import InlineNotice from '@/shared/components/InlineNotice.vue'
import ReportCard from '@/shared/components/reports/ReportCard.vue'
import { usePreferencesStore } from '@/data/preferences/preferences.store'
import type { PreferredLanguage } from '@/data/preferences/preferences.service'

const LANGUAGE_OPTIONS: { value: PreferredLanguage; label: string }[] = [
  { value: 'th', label: 'Thai' },
  { value: 'my', label: 'Burmese' },
  { value: 'en', label: 'English' },
]

const props = defineProps<{ staffId: string }>()

const preferencesStore = usePreferencesStore()
const { preferences, loading, saving } = storeToRefs(preferencesStore)

const loadFailed = ref(false)
const saveError = ref<string | null>(null)
let activated = false

const language = computed(() => (preferences.value?.staffId === props.staffId ? preferences.value.language : null))
const options = computed(() => LANGUAGE_OPTIONS.map((option) => ({ ...option, disabled: saving.value })))

async function init(): Promise<void> {
  loadFailed.value = false
  saveError.value = null
  try {
    await preferencesStore.load(props.staffId)
  } catch {
    loadFailed.value = true
  }
}

async function choose(value: unknown): Promise<void> {
  const next = LANGUAGE_OPTIONS.find((option) => option.value === value)?.value
  if (!next || saving.value || next === language.value) return
  saveError.value = null
  try {
    await preferencesStore.update(props.staffId, next)
  } catch {
    saveError.value = 'Could not save the language'
  }
}

watch(() => props.staffId, () => void init(), { immediate: true })

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
  <ReportCard title="Preferred language" heading-id="profile-language">
    <p v-if="loadFailed" class="text-[13px] text-on-primary/60" role="status">
      Could not load the preferred language
      <button type="button" class="ml-1 min-h-11 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime" @click="init()">Retry</button>
    </p>

    <p v-else-if="!language" class="text-[13px] text-on-primary/60" role="status">{{ loading ? 'Loading…' : 'Unavailable' }}</p>

    <div v-else class="grid gap-1.5 rounded-2xl bg-surface-container-lowest p-4">
      <div class="preferred-language">
        <FormOptionGrid
          label="Language"
          variant="compact"
          :options="options"
          :model-value="language"
          @update:model-value="choose"
        />
      </div>
      <p class="text-[11px] leading-snug text-on-surface-variant">Chat messages and the secretary's replies use this language</p>
      <InlineNotice v-if="saveError" tone="error" size="sm">{{ saveError }}</InlineNotice>
    </div>
  </ReportCard>
</template>

<style scoped>
.preferred-language :deep(.option-grid) {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
</style>
