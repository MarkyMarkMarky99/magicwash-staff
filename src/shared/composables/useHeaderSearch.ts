import { ref } from 'vue'

/**
 * Global header-search UI state, shared between AppHeader (the toggle button)
 * and any page that renders a collapsible search bar (customers, invoices, …).
 * It owns only the open/close flag and a generic text buffer — what gets filtered
 * is each page's own concern.
 */
const searchOpen = ref(false)
const searchQuery = ref('')

export function useHeaderSearch() {
  function toggleSearch() {
    searchOpen.value = !searchOpen.value
    if (!searchOpen.value) searchQuery.value = ''
  }

  function openSearch() {
    searchOpen.value = true
  }

  function closeSearch() {
    searchOpen.value = false
    searchQuery.value = ''
  }

  return { searchOpen, searchQuery, toggleSearch, openSearch, closeSearch }
}
