<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <div v-if="!selectedAssignment" id="student-sidebar" class="lg:col-span-1 space-y-8 animate-fade-in">
      <div class="card">
        <div class="grid grid-cols-2 gap-4 mb-6">
          <button @click="showProfileModal = true" id="student-view-profile-btn" class="w-full btn-primary py-3 text-base font-bold shadow-sm hover:shadow transition-all">
              我的課業
          </button>
          <button @click="showAchievementsModal = true" id="student-view-achievements-btn" class="w-full btn-secondary py-3 text-base font-bold shadow-sm hover:shadow transition-all">
              我的成就
          </button>
        </div>
        <div class="text-sm font-bold mb-4 border-b pb-3 text-gray-700 flex items-center gap-2 font-rounded">
          學習日誌
        </div>
        <CalendarWidget />
      </div>
      <div class="card">
        <div class="flex justify-between items-center mb-4 border-b-2 pb-3">
          <div class="text-sm font-bold text-gray-700 flex items-center gap-2 font-rounded">指定篇章</div>
        </div>
        <div class="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          <div v-if="pendingAssignments.length === 0" class="text-center text-gray-400 py-4">太棒了！沒有設定期限的緊急任務。</div>
          <div 
            v-else
            v-for="assignment in pendingAssignments" 
            :key="assignment.id"
            @click="selectedAssignment = assignment"
            class="assignment-item p-4 bg-white border-y-2 border-r-2 border-l-0 border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
            :class="isOverdue(assignment.deadline) ? 'status-border-overdue' : 'status-border-incomplete'"
          >
            <div class="flex justify-between items-center gap-3">
              <div class="flex-grow">
                <div class="font-semibold text-slate-800 text-sm line-clamp-2" :title="assignment.title">{{ assignment.title }}</div>
                <div class="mt-2 text-sm">
                  <span v-if="isOverdue(assignment.deadline)" class="text-xs font-bold text-red-500">已過期</span>
                  <span v-else class="text-xs text-slate-500">期限: {{ formatDeadline(assignment.deadline) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div id="reading-view" :class="selectedAssignment ? 'lg:col-span-3' : 'lg:col-span-2 card'" class="min-h-[80vh]">
      
      <template v-if="!selectedAssignment">
        <!-- 篩選列 -->
        <div class="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-gray-100">
          <div class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label class="text-sm font-bold text-slate-600">形式</label>
              <select v-model="filters.format" @change="applyFilters" class="w-full form-element-ink mt-1 text-sm article-filter">
                <option value="">所有形式</option>
                <option value="純文">#純文</option>
                <option value="圖表">#圖表</option>
                <option value="圖文">#圖文</option>
              </select>
            </div>
            <div>
              <label class="text-sm font-bold text-slate-600">內容</label>
              <select v-model="filters.contentType" @change="applyFilters" class="w-full form-element-ink mt-1 text-sm article-filter">
                <option value="">所有內容</option>
                <option value="記敘">#記敘</option>
                <option value="抒情">#抒情</option>
                <option value="說明">#說明</option>
                <option value="議論">#議論</option>
                <option value="應用">#應用</option>
              </select>
            </div>
            <div>
              <label class="text-sm font-bold text-slate-600">難度</label>
              <select v-model="filters.difficulty" @change="applyFilters" class="w-full form-element-ink mt-1 text-sm article-filter">
                <option value="">所有難度</option>
                <option value="簡單">#簡單</option>
                <option value="基礎">#基礎</option>
                <option value="普通">#普通</option>
                <option value="進階">#進階</option>
                <option value="困難">#困難</option>
              </select>
            </div>
            <div>
              <label class="text-sm font-bold text-slate-600">狀態</label>
              <select v-model="filters.status" @change="applyFilters" class="w-full form-element-ink mt-1 text-sm article-filter">
                <option value="">所有狀態</option>
                <option value="incomplete">未完成</option>
                <option value="complete">已完成</option>
              </select>
            </div>
            <div>
              <button @click="clearFilters" class="w-full btn-secondary text-sm py-3">清除篩選</button>
            </div>
          </div>
        </div>

        <!-- Articles Grid -->
        <div v-if="isLoading" class="py-12 text-center text-gray-500">
          <div class="loader inline-block"></div>
          <p class="mt-2">正在擷取篇章...</p>
        </div>
        <div v-else-if="assignments.length === 0" class="col-span-full py-12 text-center">
          <h3 class="text-xl text-slate-500">找不到符合條件的篇章</h3>
          <p class="text-slate-400 mt-2">請試著調整篩選條件。</p>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
           <ArticleCard 
              v-for="(assignment, index) in assignments" 
              :key="assignment.id" 
              :assignment="assignment" 
              @click="selectedAssignment = assignment"
              :class="`stagger-item-${(index % 5) + 1}`"
           />
        </div>
        <!-- Load More Button -->
          <div v-if="!isLastPage && assignments.length > 0" class="mt-8 text-center mb-8">
            <button @click="loadMore" class="btn-primary mx-auto py-2 px-6">載入更多</button>
          </div>
      </template>

      <!-- Reading View -->
      <div v-else class="animate-fade-in h-full">
         <ArticleReader 
          :assignment="selectedAssignment" 
          @back="selectedAssignment = null" 
          @submit="handleArticleSubmit"
          @edit="handleEditFromReader"
          @delete="handleDeleteFromReader"
         />
      </div>
    </div>

    <!-- Profile Modal -->
    <transition name="fade-slide">
      <div v-if="showProfileModal" @click.self="showProfileModal = false" class="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative border border-white/20 animate-scale-in">
            <div class="px-6 py-5 border-b flex justify-between items-center bg-slate-50/50 shrink-0">
                <div class="flex items-center gap-4">
                  <div class="text-lg font-black text-slate-800 flex items-center gap-2">
                      <span class="w-1.5 h-6 bg-red-800 rounded-full"></span>
                      我的課業
                  </div>
                  <button @click="showChangePassword = true" class="btn-secondary py-1.5 px-4 text-xs font-bold rounded-lg shadow-sm border border-slate-200">修改密語</button>
                </div>
                <button @click="showProfileModal = false" class="text-slate-400 hover:text-red-600 transition-all p-1 hover:rotate-90">
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <div class="p-6 overflow-y-auto custom-scrollbar">
                <StudentProfile :submissions="mySubmissions" />
            </div>
        </div>
      </div>
    </transition>

    <!-- Achievements Modal -->
    <transition name="fade-slide">
      <div v-if="showAchievementsModal" @click.self="showAchievementsModal = false" class="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-white/20 animate-scale-in">
            <div class="px-6 py-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
                <h3 class="text-lg font-black text-slate-800 flex items-center gap-2">
                    <span class="w-1.5 h-5 bg-orange-600 rounded-full"></span>
                    我的成就
                </h3>
                <button @click="showAchievementsModal = false" class="text-slate-400 hover:text-red-600 transition-colors">
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <div class="p-6 overflow-y-auto custom-scrollbar">
                <StudentAchievements />
            </div>
        </div>
      </div>
    </transition>

    <!-- Change Password Modal -->
    <ChangePasswordModal :is-visible="showChangePassword" @close="showChangePassword = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDataStore } from '../../stores/data'
import { useAuthStore } from '../../stores/auth'
import { useAppStore } from '../../stores/app'
import { getAssignments, loadStudentSubmissions, saveSubmission } from '../../services/api'
import { checkAndAwardAchievements, calculateCompletionStreak, updateLoginStreak } from '../../services/achievements'
import ArticleCard from './ArticleCard.vue'
import CalendarWidget from './CalendarWidget.vue'
import ArticleReader from './ArticleReader.vue'
import StudentAchievements from './StudentAchievements.vue'
import StudentProfile from './StudentProfile.vue'
import ChangePasswordModal from '../ChangePasswordModal.vue'

const dataStore = useDataStore()
const authStore = useAuthStore()
const appStore = useAppStore()

const currentTab = ref('articles') // this ref isn't really needed anymore but harmless to keep
const showProfileModal = ref(false)
const showAchievementsModal = ref(false)
const showChangePassword = ref(false)
const selectedAssignment = ref(null)

const mySubmissions = computed(() => {
    const sid = authStore.currentUser?.studentId
    if (!sid) return []
    return dataStore.allSubmissions.filter(s => s.studentId === sid)
})

watch(currentTab, () => {
    selectedAssignment.value = null
})

const filters = dataStore.articleQueryState.filters
const assignments = computed(() => dataStore.assignments)
const isLoading = computed(() => dataStore.articleQueryState.isLoading)
const isLastPage = computed(() => dataStore.articleQueryState.isLastPage)

const pendingAssignments = ref([])

const handleArticleSubmit = async (data) => {
  await saveSubmission(data)
  
  // 關鍵：強制重新從 Firebase 載入最新數據
  const updatedSubmissions = await loadStudentSubmissions(authStore.currentUser.studentId)
  await fetchPendingAssignments()

  const user = authStore.currentUser
  if (user?.type === 'student' && user.studentId) {
    try {
      // 1. 同步處理跨午夜可能的紀錄更新
      const allUpdates = {}
      const streakUpdates = await calculateCompletionStreak(user.studentId, user)
      Object.assign(allUpdates, streakUpdates)
      
      const loginUpdates = await updateLoginStreak(user.studentId, user)
      Object.assign(allUpdates, loginUpdates)

      if (Object.keys(allUpdates).length > 0) {
        const { updateDoc, doc } = await import('firebase/firestore')
        const { db } = await import('../../firebase/init')
        await updateDoc(doc(db, `classes/${user.classId}/students`, user.studentId), allUpdates)
        Object.assign(authStore.currentUser, allUpdates)
      }

      // 2. 執行成就檢查
      const awards = await checkAndAwardAchievements(
        user.studentId,
        'quiz_submit',
        authStore.currentUser,
        { submissions: updatedSubmissions }
      )
      
      if (awards && awards.length > 0) {
        awards.forEach(ach => appStore.pushAchievement(ach))
      }
    } catch (err) {
      console.error('[Achievement] Post-submit sync failed:', err)
    }
  }
}

const applyFilters = () => {
    dataStore.fetchAssignmentsPage(true, authStore.currentUser)
}

const clearFilters = () => {
    dataStore.articleQueryState.filters = { format: '', contentType: '', difficulty: '', status: '' }
    applyFilters()
}

const loadMore = () => {
    dataStore.fetchAssignmentsPage(false, authStore.currentUser)
}

const fetchPendingAssignments = async () => {
  const allAssignments = await getAssignments()
  const studentId = authStore.currentUser?.studentId
  
  if (!studentId) {
    pendingAssignments.value = []
    return
  }

  const userSubmissions = dataStore.allSubmissions.filter(s => s.studentId === studentId)
  const passedAssignmentIds = new Set(userSubmissions.filter(s => {
      let highestScore = s.score || 0
      if (s.attempts && s.attempts.length > 0) {
          highestScore = Math.max(...s.attempts.map(a => a.score))
      }
      return highestScore >= 60
  }).map(s => s.assignmentId))

  const isStudentUser = authStore.currentUser?.type === 'student'
  
  let toRender = allAssignments.filter(a => {
      if (isStudentUser && a.isPublic !== true) {
          return false
      }
      return a.deadline && !passedAssignmentIds.has(a.id)
  })
  
  toRender.sort((a, b) => a.deadline.toMillis() - b.deadline.toMillis())
  pendingAssignments.value = toRender
}

const formatDeadline = (deadline) => {
  if(!deadline) return ''
  const d = deadline.toDate()
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const isOverdue = (deadline) => {
  if(!deadline) return false
  return new Date() > deadline.toDate()
}

const handleDeleteFromReader = async (assignment) => {
  if (!confirm(`確定要將篇章《${assignment.title}》從書庫中永久刪除嗎？`)) return
  try {
    const { deleteDoc, doc } = await import('firebase/firestore')
    const { db } = await import('../../firebase/init')
    await deleteDoc(doc(db, 'assignments', assignment.id))
    alert('已成功刪除該篇章。')
    selectedAssignment.value = null
    dataStore.fetchAssignmentsPage(true, authStore.currentUser)
    fetchPendingAssignments()
  } catch(err) {
    console.error(err)
    alert('刪除失敗：' + err.message)
  }
}

const handleEditFromReader = (assignment) => {
  dataStore.editTargetAssignmentId = assignment.id
  selectedAssignment.value = null
}

onMounted(async () => {
  if (authStore.currentUser?.studentId) {
      await loadStudentSubmissions(authStore.currentUser.studentId)

      // 每日首次進入 Dashboard 時計算連續完成天數 + 連續登入天數
      try {
        const user = authStore.currentUser
        const allUpdates = {}

        // 連續完成天數
        const streakUpdates = await calculateCompletionStreak(user.studentId, user)
        Object.assign(allUpdates, streakUpdates)

        // 連續登入天數
        const loginUpdates = await updateLoginStreak(user.studentId, user)
        Object.assign(allUpdates, loginUpdates)

        if (Object.keys(allUpdates).length > 0) {
          const { updateDoc, doc } = await import('firebase/firestore')
          const { db } = await import('../../firebase/init')
          await updateDoc(doc(db, `classes/${user.classId}/students`, user.studentId), allUpdates)
          Object.assign(authStore.currentUser, allUpdates)
          console.log('[Dashboard] Updates:', allUpdates)
        }

        // 主動檢查成就 (包含每日登入成就)
        const awards = await checkAndAwardAchievements(
          user.studentId,
          'dashboard_mount',
          authStore.currentUser,
          { submissions: dataStore.allSubmissions }
        )
        if (awards && awards.length > 0) {
          awards.forEach(ach => appStore.pushAchievement(ach))
        }
      } catch (err) {
        console.error('[Dashboard] Streak/login/achievement check failed:', err)
      }
  }
  // Fetch assignments on mount
  dataStore.fetchAssignmentsPage(true, authStore.currentUser)
  fetchPendingAssignments()
})
</script>
