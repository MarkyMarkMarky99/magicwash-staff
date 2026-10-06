<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { bangkokToday } from '@shared/utils/bangkok-datetime'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import DateTabs from '@/shared/components/DateTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import { staffEditRoute, staffProfileRoute } from '@/shared/navigation/form-routes'
import { useAuthStore } from '@/data/auth/auth.store'
import { useStaffStore } from '@/data/staff/staff.store'
import { listWorkTransactions, type WorkTransactionDto } from '@/data/work-transactions/work-transaction.service'
import StaffCard from '../components/StaffCard.vue'
import { rankDay } from '../utils/staff-performance'
import { staffStanding } from '../utils/staff-presentation'

defineOptions({ name: 'StaffListPage' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const staffStore = useStaffStore()
const { status, isAdmin, staff: me } = storeToRefs(authStore)
const { items, loading, error, loaded } = storeToRefs(staffStore)

const selectedDate = ref(bangkokToday())
const navYear = ref(Number(selectedDate.value.slice(0, 4)))
const navMonth = ref(Number(selectedDate.value.slice(5, 7)) - 1)

const scores = ref<WorkTransactionDto[]>([])
const scoresFor = ref<string | null>(null)
const scoresError = ref<string | null>(null)
let latestScores = 0

// Members without points keep this order at the end of the ranking.
const members = computed(() =>
  [...items.value].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'th')),
)
const board = computed(() => rankDay(members.value, scores.value, selectedDate.value))
const topPoints = computed(() => Math.max(0, ...board.value.map((entry) => entry.points)))
const scoresReady = computed(() => scoresFor.value === selectedDate.value)
const listLoading = computed(() => (loading.value && !loaded.value) || (!scoresReady.value && !scoresError.value))
const listError = computed(() => (loaded.value ? scoresError.value : error.value))

async function loadScores(): Promise<void> {
  const day = selectedDate.value
  const request = ++latestScores
  scoresError.value = null
  try {
    const rows = await listWorkTransactions(day, day)
    if (request !== latestScores) return
    scores.value = rows
    scoresFor.value = day
  } catch {
    if (request !== latestScores) return
    scoresError.value = 'Could not load scores'
  }
}

function load(): void {
  void staffStore.load()
  void loadScores()
}

function selectDate(date: string): void {
  selectedDate.value = date
  void loadScores()
}

function stepMonth(step: number): void {
  const month = navMonth.value + step
  navYear.value += Math.floor(month / 12)
  navMonth.value = (month + 12) % 12
  selectDate(`${navYear.value}-${String(navMonth.value + 1).padStart(2, '0')}-01`)
}

// For an admin, a row still waiting for approval opens the form, where they approve it.
function openStaff(staffId: string): void {
  const row = items.value.find((item) => item.staffId === staffId)
  void router.push(isAdmin.value && row && staffStanding(row) === 'pending' ? staffEditRoute(staffId) : staffProfileRoute(staffId))
}

// This page stays cached, so it must not react to sign-out while another route is showing.
watch(
  status,
  (value) => {
    if (route.name !== 'staff-list' || value === 'loading' || value === 'signedIn') return
    void router.replace('/')
  },
  { immediate: true },
)

watch(status, (value) => {
  if (value === 'signedIn' && route.name === 'staff-list') load()
})

onActivated(() => {
  if (status.value === 'signedIn') load()
})
</script>

<template>
  <ListPageLayout>
    <template #filters>
      <div class="flex-none bg-primary text-on-primary">
        <DateTabs :year="navYear" :month="navMonth" :selected-date="selectedDate" @date-select="selectDate" @prev-month="stepMonth(-1)" @next-month="stepMonth(1)" />
      </div>
    </template>

    <ListContainer
      title="Staff ranking"
      icon="leaderboard"
      :count="board.length"
      count-label="staff"
      :loading="listLoading"
      :skeleton-rows="4"
      :error="listError"
      :empty="!listLoading && !listError && board.length === 0"
      empty-text="No staff found"
    >
      <StaffCard
        v-for="entry in board"
        :key="entry.member.email"
        :staff="entry.member"
        :points="entry.points"
        :jobs="entry.jobs"
        :rank="entry.rank"
        :top-points="topPoints"
        :self="entry.member.staffId !== '' && entry.member.staffId === me?.staffId"
        @select="openStaff"
      />
    </ListContainer>
  </ListPageLayout>
</template>
