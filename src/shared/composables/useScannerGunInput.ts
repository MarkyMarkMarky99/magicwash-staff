import { isStaffCardCode } from '@/shared/utils/staff-card'
import { onMounted, onUnmounted, toValue, type MaybeRefOrGetter } from 'vue'

export function useScannerGunInput(onScan: (code: string) => void, enabled: MaybeRefOrGetter<boolean>, options: { staffCards?: 'skip' | 'only' } = {}): void {
  let buffer = ''
  let lastKeyTime = 0

  function handleKeydown(event: KeyboardEvent): void {
    const target = event.target
    if (!toValue(enabled) || event.ctrlKey || event.altKey || event.metaKey
      || (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select')))) {
      buffer = ''
      return
    }

    if (event.code === 'Enter' || event.code === 'NumpadEnter') {
      if (buffer.length >= 3 && (isStaffCardCode(buffer) === (options.staffCards === 'only'))) {
        onScan(buffer)
        event.preventDefault()
      }
      buffer = ''
      return
    }

    let character = ''
    if (/^Key[A-Z]$/.test(event.code)) {
      character = event.shiftKey ? event.code.slice(3) : event.code.slice(3).toLowerCase()
    } else if (/^(Digit|Numpad)[0-9]$/.test(event.code)) {
      character = event.code.slice(-1)
    } else if (event.code === 'Minus') {
      character = event.shiftKey ? '_' : '-'
    } else if (event.code === 'Period') {
      character = '.'
    } else if (event.code === 'Slash') {
      character = '/'
    } else if (/^[\x20-\x7e]$/.test(event.key)) {
      character = event.key
    }
    if (!character) return

    const now = performance.now()
    buffer = now - lastKeyTime > 50 ? character : buffer + character
    lastKeyTime = now
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
}
