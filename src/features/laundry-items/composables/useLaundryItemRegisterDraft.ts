import { markRaw, onScopeDispose, reactive } from 'vue'

export interface LaundryItemRegisterGarment {
  id: string
  tag: string
  file: File
  previewUrl: string
}

export function useLaundryItemRegisterDraft() {
  const garments = reactive<LaundryItemRegisterGarment[]>([])
  let sequence = 0

  function addGarment(tag: string, file: File): string {
    const id = `garment-${++sequence}`
    garments.push({ id, tag, file: markRaw(file), previewUrl: URL.createObjectURL(file) })
    return id
  }

  function removeGarment(id: string): void {
    const index = garments.findIndex((entry) => entry.id === id)
    if (index < 0) return
    URL.revokeObjectURL(garments[index].previewUrl)
    garments.splice(index, 1)
  }

  onScopeDispose(() => {
    for (const garment of garments) URL.revokeObjectURL(garment.previewUrl)
  })

  return { garments, addGarment, removeGarment }
}
