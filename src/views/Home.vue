<template>
  <div class="min-h-screen app-background p-4 md:p-8">
    <div class="max-w-screen-2xl mx-auto">
      <header class="flex justify-between items-center mb-10">
        <div class="flex items-center gap-3">
          <!-- Logo SVGs can be moved to separate icons or kept inline -->
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h1 class="text-lg font-bold text-gray-800 font-rounded">智慧閱讀書院</h1>
        </div>
        
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full flex items-center justify-center avatar-seal">
              <span class="avatar-seal-text text-2xl">{{ lastCharName }}</span>
            </div>
            <div>
              <h2 class="text-sm font-semibold text-gray-700 font-rounded">{{ userGreeting }}</h2>
              <p class="text-sm text-gray-500">{{ authStore.currentUser?.className }}</p>
            </div>
          </div>
          <button @click="handleLogout" class="btn-danger py-2 px-4 text-sm">離席</button>
        </div>
      </header>

      <main>
        <!-- Teacher Tabs -->
        <div v-if="authStore.currentUser?.type === 'teacher'" class="border-b-2 border-gray-200 mb-6">
            <div class="flex space-x-1">
                <button @click="currentTab = 'student'" :class="{'active': currentTab === 'student'}" class="tab-btn py-2 px-4 font-semibold text-sm">我的書房</button>
                <button @click="currentTab = 'teacher'" :class="{'active': currentTab === 'teacher'}" class="tab-btn py-2 px-4 font-semibold text-sm">夫子講堂</button>
            </div>
        </div>

        <StudentDashboard v-if="currentTab === 'student'" />
        <TeacherDashboard v-if="currentTab === 'teacher'" />
      </main>


    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useDataStore } from '../stores/data'
import StudentDashboard from '../components/student/StudentDashboard.vue'
import TeacherDashboard from '../components/teacher/TeacherDashboard.vue'

const router = useRouter()
const authStore = useAuthStore()
const dataStore = useDataStore()

const currentTab = ref('student')

watch(() => dataStore.editTargetAssignmentId, (newVal) => {
  if (newVal) {
    currentTab.value = 'teacher'
  }
})

const lastCharName = computed(() => {
  const name = authStore.currentUser?.name || '?'
  return name.slice(-1)
})

const userGreeting = computed(() => {
  if (!authStore.currentUser) return '歡迎'
  return authStore.currentUser.type === 'student'
    ? `學子 ${authStore.currentUser.name}`
    : `夫子 ${authStore.currentUser.name}`
})

const handleLogout = () => {
  authStore.logout()
  sessionStorage.removeItem('tempUser')
  router.push('/login')
}
</script>

<style scoped>
</style>
