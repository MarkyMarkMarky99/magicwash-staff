import { ref, type Ref } from 'vue'

const STORAGE_KEY = 'issue-reports.actor'

export function readStoredActor(storage: Pick<Storage, 'getItem'>): string {
  return storage.getItem(STORAGE_KEY)?.trim() ?? ''
}

export function writeStoredActor(storage: Pick<Storage, 'setItem'>, value: string): void {
  storage.setItem(STORAGE_KEY, value.trim())
}

export function useIssueReportActor(): { actor: Ref<string>; persist(): void } {
  const storage = window.localStorage
  const actor = ref(readStoredActor(storage))

  function persist(): void {
    writeStoredActor(storage, actor.value)
  }

  return { actor, persist }
}
