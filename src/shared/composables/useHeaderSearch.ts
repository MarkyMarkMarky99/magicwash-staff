import { ref } from 'vue'

/**
 * Global header-search UI state, shared between AppHeader (the toggle button)
 * and any page that renders a collapsible search bar (customers, invoices, …).
 * It owns only the open/close flag; what gets filtered is each page's own concern.
 */
const searchOpen = ref(false)

export function useHeaderSearch() {
  function toggleSearch() {
    searchOpen.value = !searchOpen.value
  }

  function openSearch() {
    searchOpen.value = true
  }

  function closeSearch() {
    searchOpen.value = false
  }

  return { searchOpen, toggleSearch, openSearch, closeSearch }
}
