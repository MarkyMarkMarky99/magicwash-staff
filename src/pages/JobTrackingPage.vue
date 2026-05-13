<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import AddTaskPanel from '../components/job-tracking/AddTaskPanel.vue'
import JobTrackingFooter from '../components/job-tracking/JobTrackingFooter.vue'
import JobTrackingHeader from '../components/job-tracking/JobTrackingHeader.vue'
import JobTrackingHome from '../components/job-tracking/JobTrackingHome.vue'
import JobTrackingLoadingOverlay from '../components/job-tracking/JobTrackingLoadingOverlay.vue'
import TasksListView from '../components/job-tracking/TasksListView.vue'

const TASKS_COLLECTION = 'tasks'
const DEFAULT_DEPARTMENT = 'laundry'
const STATUS = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
}

const departments = [
  {
    key: 'laundry',
    title: 'Laundry',
    icon: 'local_laundry_service',
    themeColor: '#2563eb',
    iconWrapClass: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white',
    iconClass: 'text-blue-600 dark:text-blue-400 group-hover:text-white',
    doneBarClass: 'bg-blue-600',
    inProgressBarClass: 'bg-blue-400',
  },
  {
    key: 'ironing',
    title: 'Ironing',
    icon: 'iron',
    themeColor: '#ea580c',
    iconWrapClass: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 group-hover:bg-orange-500 group-hover:text-white',
    iconClass: 'text-orange-600 dark:text-orange-400 group-hover:text-white',
    doneBarClass: 'bg-orange-600',
    inProgressBarClass: 'bg-orange-400',
  },
  {
    key: 'qc',
    title: 'QC & Packing',
    icon: 'fact_check',
    themeColor: '#16a34a',
    iconWrapClass: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 group-hover:bg-green-600 group-hover:text-white',
    iconClass: 'text-green-600 dark:text-green-400 group-hover:text-white',
    doneBarClass: 'bg-green-600',
    inProgressBarClass: 'bg-green-400',
  },
  {
    key: 'delivery',
    title: 'Pickup & Delivery',
    icon: 'local_shipping',
    themeColor: '#9333ea',
    iconWrapClass: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white',
    iconClass: 'text-purple-600 dark:text-purple-400 group-hover:text-white',
    doneBarClass: 'bg-purple-600',
    inProgressBarClass: 'bg-purple-400',
  },
]

const departmentMap = new Map(departments.map((department) => [department.key, department]))
const storedDepartment = localStorage.getItem('selectedDepartment')

const activeView = ref('home')
const addPanelOpen = ref(false)
const selectedDepartment = ref(departmentMap.has(storedDepartment) ? storedDepartment : DEFAULT_DEPARTMENT)
const search = ref('')
const currentFilter = ref('All')
const tasksByDepartment = ref(createEmptyTaskMap())
const loading = ref(true)
const error = ref('')
const saving = ref(false)

let unsubscribe = null

const currentDepartment = computed(() => departmentMap.get(selectedDepartment.value) || departmentMap.get(DEFAULT_DEPARTMENT))
const headerTitle = computed(() => {
  if (activeView.value === 'tasks') return `Tasks - ${currentDepartment.value.title}`
  return 'Dashboard'
})
const showAddButton = computed(() => activeView.value === 'tasks' && !addPanelOpen.value)
const primaryStyle = computed(() => ({ '--color-primary': currentDepartment.value.themeColor }))

const departmentSummaries = computed(() => {
  const summaries = {}
  departments.forEach(({ key }) => {
    const tasks = tasksByDepartment.value[key] || []
    summaries[key] = {
      total: tasks.length,
      doneToday: tasks.filter((task) => task.status === STATUS.COMPLETED).length,
      inProgress: tasks.filter((task) => task.status === STATUS.IN_PROGRESS).length,
    }
  })
  return summaries
})

const visibleDepartmentTasks = computed(() => tasksByDepartment.value[selectedDepartment.value] || [])

const searchedTasks = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return visibleDepartmentTasks.value
  return visibleDepartmentTasks.value.filter((task) => String(task.orderId || '').toLowerCase().includes(term))
})

const filterCounts = computed(() => ({
  All: searchedTasks.value.length,
  [STATUS.PENDING]: searchedTasks.value.filter((task) => task.status === STATUS.PENDING).length,
  [STATUS.IN_PROGRESS]: searchedTasks.value.filter((task) => task.status === STATUS.IN_PROGRESS).length,
  [STATUS.COMPLETED]: searchedTasks.value.filter((task) => task.status === STATUS.COMPLETED).length,
}))

const filteredTasks = computed(() => {
  if (currentFilter.value === 'All') return searchedTasks.value
  return searchedTasks.value.filter((task) => task.status === currentFilter.value)
})

watch(selectedDepartment, (department) => {
  localStorage.setItem('selectedDepartment', department)
})

onMounted(() => {
  startRealtimeListener()
})

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe()
})

function createEmptyTaskMap() {
  return departments.reduce((acc, department) => {
    acc[department.key] = []
    return acc
  }, {})
}

function selectDepartment(departmentKey) {
  selectedDepartment.value = departmentMap.has(departmentKey) ? departmentKey : DEFAULT_DEPARTMENT
  activeView.value = 'tasks'
}

function navigate(view) {
  if (view === 'home' || view === 'tasks') {
    activeView.value = view
  }
}

function toDateMaybe(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  return null
}

function isCompletedToday(task, startOfToday) {
  if (!task || task.status !== STATUS.COMPLETED) return false
  const completedAt = toDateMaybe(task.completedAt)
  if (completedAt) return completedAt >= startOfToday
  const createdAt = toDateMaybe(task.createdAt)
  return Boolean(createdAt && createdAt >= startOfToday)
}

function isVisibleByBusinessRule(task, startOfToday) {
  if (!task) return false
  if (task.status !== STATUS.COMPLETED) return true
  return isCompletedToday(task, startOfToday)
}

function startRealtimeListener() {
  if (unsubscribe) unsubscribe()

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const tasksRef = collection(db, TASKS_COLLECTION)
  const allTasksQuery = query(tasksRef, orderBy('createdAt', 'desc'))

  unsubscribe = onSnapshot(allTasksQuery, (snapshot) => {
    const nextTasksByDepartment = createEmptyTaskMap()

    snapshot.forEach((docSnap) => {
      const data = docSnap.data()
      const department = data.department || DEFAULT_DEPARTMENT
      const task = {
        id: docSnap.id,
        ...data,
        department,
      }

      if (!isVisibleByBusinessRule(task, startOfToday)) return
      if (!nextTasksByDepartment[department]) nextTasksByDepartment[department] = []
      nextTasksByDepartment[department].push(task)
    })

    tasksByDepartment.value = nextTasksByDepartment
    error.value = ''
    loading.value = false
  }, (err) => {
    console.error('Error listening to tasks:', err)
    error.value = err
    loading.value = false
  })
}

async function createTask(form) {
  saving.value = true
  try {
    await addDoc(collection(db, TASKS_COLLECTION), {
      orderId: form.orderId,
      handoverDate: form.handoverDate || '',
      dueDate: form.dueDate || '',
      department: selectedDepartment.value,
      status: STATUS.PENDING,
      createdAt: serverTimestamp(),
      completedAt: null,
    })
    addPanelOpen.value = false
    activeView.value = 'home'
  } catch (err) {
    console.error('Error creating task:', err)
    window.alert(`Error: ${err.message}`)
  } finally {
    saving.value = false
  }
}

async function updateTaskStatus(taskId, newStatus) {
  if (!taskId || !newStatus) return

  try {
    const payload = { status: newStatus }
    payload.completedAt = newStatus === STATUS.COMPLETED ? serverTimestamp() : null
    await updateDoc(doc(db, TASKS_COLLECTION, taskId), payload)
  } catch (err) {
    console.error('Error updating task status:', err)
    window.alert(`Error: ${err.message}`)
  }
}

async function deleteTask(taskId) {
  if (!taskId || !window.confirm('Delete this task?')) return

  try {
    await deleteDoc(doc(db, TASKS_COLLECTION, taskId))
  } catch (err) {
    console.error('Error deleting task:', err)
    window.alert(`Error: ${err.message}`)
  }
}
</script>

<template>
  <div
    class="dark relative flex h-full w-full flex-col overflow-hidden bg-background-light font-body text-slate-900 antialiased shadow-2xl transition-colors duration-200 dark:bg-background-dark dark:text-white"
    :style="primaryStyle"
  >
    <JobTrackingLoadingOverlay :show="loading" />

    <JobTrackingHeader
      :title="headerTitle"
      :show-add="showAddButton"
      @add="addPanelOpen = true"
    />

    <div class="relative flex-1 w-full overflow-hidden">
      <div
        :class="[
          'absolute inset-0 z-10 flex h-full w-full flex-col overflow-hidden transition-transform duration-300',
          activeView === 'home' ? 'translate-x-0' : '-translate-x-full',
        ]"
      >
        <JobTrackingHome
          :departments="departments"
          :summaries="departmentSummaries"
          @select-department="selectDepartment"
        />
      </div>

      <div
        :class="[
          'absolute inset-0 z-10 flex h-full w-full flex-col overflow-hidden transition-transform duration-300',
          activeView === 'tasks' ? 'translate-x-0' : 'translate-x-full',
        ]"
      >
        <TasksListView
          v-model:search="search"
          :filter="currentFilter"
          :tasks="filteredTasks"
          :loading="loading"
          :error="error"
          :filter-counts="filterCounts"
          @update:filter="currentFilter = $event"
          @status-change="updateTaskStatus"
          @delete="deleteTask"
        />
      </div>
    </div>

    <JobTrackingFooter
      :active-view="activeView"
      @navigate="navigate"
    />

    <AddTaskPanel
      :open="addPanelOpen"
      :saving="saving"
      @close="addPanelOpen = false"
      @save="createTask"
    />
  </div>
</template>
