import { onBeforeUnmount, onMounted, type Ref } from 'vue'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true',
  )
}

export function useFocusTrap(container: Ref<HTMLElement | null>, enabled: Ref<boolean>) {
  function handleKeydown(event: KeyboardEvent) {
    if (!enabled.value || event.key !== 'Tab' || !container.value) return

    const focusableElements = getFocusableElements(container.value)
    if (focusableElements.length === 0) {
      event.preventDefault()
      container.value.focus({ preventScroll: true })
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    const activeElement = document.activeElement

    if (event.shiftKey && (activeElement === firstElement || !container.value.contains(activeElement))) {
      event.preventDefault()
      lastElement.focus({ preventScroll: true })
      return
    }

    if (!event.shiftKey && (activeElement === lastElement || !container.value.contains(activeElement))) {
      event.preventDefault()
      firstElement.focus({ preventScroll: true })
    }
  }

  onMounted(() => document.addEventListener('keydown', handleKeydown))
  onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown))
}
