import { ref } from 'vue'

const searchOpen = ref(false)
const searchQuery = ref('')

export function useCustomerSearch() {
  function toggleSearch() {
    searchOpen.value = !searchOpen.value
    if (!searchOpen.value) searchQuery.value = ''
  }
  function closeSearch() {
    searchOpen.value = false
    searchQuery.value = ''
  }
  return { searchOpen, searchQuery, toggleSearch, closeSearch }
}
