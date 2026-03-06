<template>
  <div class="p-4 md:p-8 max-w-[1600px] w-[95%] mx-auto animate-fade-in">
    <!-- Teacher Header Card -->
    <div class="card mb-8 px-8 py-6">
      <div class="flex flex-col md:flex-row justify-between items-center gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-red-800 text-white rounded-lg flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h2 class="text-2xl font-black text-slate-800 tracking-tight">掌理學堂</h2>
            <p class="text-xs text-slate-400 mt-0.5 font-medium italic">夫子領學有方，學子進益無窮。教不嚴，師之惰；勤學早，莫等閒。</p>
          </div>
        </div>
        
        <div class="flex flex-wrap gap-2 items-center">
          <select 
            v-model="selectedClassId" 
            class="input-styled py-1.5 px-3 text-sm min-w-[180px]"
            @change="handleClassChange"
          >
            <option value="" disabled>--- 選擇學堂 ---</option>
            <option v-for="c in allClasses" :key="c.id" :value="c.id">
              {{ c.className }}
            </option>
          </select>
          <button @click="openNewClassModal" class="btn-primary py-1.5 px-3 text-xs font-bold">新設</button>
          <button :disabled="!selectedClassId" @click="openEditClassModal" class="btn-secondary py-1.5 px-3 text-xs font-bold">修訂</button>
          <button :disabled="!selectedClassId" @click="confirmDeleteClass" class="btn-danger py-1.5 px-3 text-xs font-bold">解散</button>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="flex border-b border-slate-200 mb-8 space-x-1 overflow-x-auto no-scrollbar scroll-smooth">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="activeTab = tab.id"
        class="content-tab tab-btn whitespace-nowrap px-8 py-4 text-sm font-bold transition-all duration-300 relative"
        :class="{ 'active': activeTab === tab.id }"
      >
        {{ tab.label }}
        <div v-if="activeTab === tab.id" class="absolute bottom-0 left-0 right-0 h-1 bg-red-800 rounded-t-full"></div>
      </button>
    </div>

    <!-- Tab Content -->
    <div class="transition-all duration-300">
      <!-- 學堂概況 -->
      <div v-if="activeTab === 'overview'" class="space-y-6">
        <ClassManager :classId="selectedClassId" />
      </div>

      <!-- 篇章書庫 -->
      <div v-if="activeTab === 'library'">
        <ArticleLibrary :classId="selectedClassId" />
      </div>

      <!-- 成就管理 -->
      <div v-if="activeTab === 'achievement'">
        <AchievementManager />
      </div>
      
      <!-- 系統設定 -->
      <div v-if="activeTab === 'settings'">
        <TeacherSettings />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import { fetchClasses } from '../../services/api'
import ClassManager from './ClassManager.vue'
import ArticleLibrary from './ArticleLibrary.vue'
import AchievementManager from './AchievementManager.vue'
import TeacherSettings from './TeacherSettings.vue'

const authStore = useAuthStore()
const dataStore = useDataStore()

const activeTab = ref('overview')
const selectedClassId = ref('')

watch(() => dataStore.editTargetAssignmentId, (newId) => {
  if (newId) {
    activeTab.value = 'library'
  }
}, { immediate: true })

const allClasses = computed(() => authStore.allClasses || [])

const tabs = [
  { id: 'overview', label: '學堂概況' },
  { id: 'library', label: '篇章書庫' },
  { id: 'achievement', label: '成就管理' },
  { id: 'settings', label: '系統設定' }
]

const handleClassChange = () => {
  if (selectedClassId.value) {
    // 同步到 AuthStore 的 currentUser 及其選中的 classId 供子組件偵測
    authStore.currentUser = { 
      ...authStore.currentUser, 
      selectedClassId: selectedClassId.value 
    }
  }
}

const fetchClassesData = async () => {
  const classes = await fetchClasses()
  authStore.setClasses(classes)
}

const openNewClassModal = async () => {
  const className = window.prompt('請輸入新學堂名號：')
  if (!className || !className.trim()) return
  
  try {
    const newId = await authStore.addClass(className.trim())
    await fetchClassesData()
    selectedClassId.value = newId
    alert(`學堂「${className}」已成功設立。`)
  } catch (err) {
    alert('設立學堂失敗：' + err.message)
  }
}

const openEditClassModal = async () => {
  if (!selectedClassId.value) return
  const currentClass = authStore.allClasses.find(c => c.id === selectedClassId.value)
  if (!currentClass) return

  const newName = window.prompt('請輸入新的學堂名號：', currentClass.className)
  if (!newName || !newName.trim() || newName === currentClass.className) return

  try {
    await authStore.updateClassName(selectedClassId.value, newName.trim())
    await fetchClassesData()
    alert('學堂名號已修訂。')
  } catch (err) {
    alert('修訂失敗：' + err.message)
  }
}

const confirmDeleteClass = async () => {
  if (!selectedClassId.value) return
  const currentClass = authStore.allClasses.find(c => c.id === selectedClassId.value)
  if (!currentClass) return

  const confirmName = window.prompt(`您確定要解散「${currentClass.className}」嗎？此舉將一併移除所有學子記錄與挑戰歷程。\n\n請輸入學堂完整名號「${currentClass.className}」以確認：`)
  
  if (confirmName !== currentClass.className) {
    if (confirmName !== null) alert('學堂名號輸入不符，取消解散。')
    return
  }

  try {
    await authStore.deleteClass(selectedClassId.value)
    selectedClassId.value = ''
    await fetchClassesData()
    alert('學堂已解散。')
  } catch (err) {
    alert('解散失敗：' + err.message)
  }
}

onMounted(async () => {
  await authStore.fetchSystemConfig('teacher')
  await fetchClassesData()
  
  if (authStore.currentUser?.selectedClassId) {
    selectedClassId.value = authStore.currentUser.selectedClassId
  } else if (authStore.allClasses.length > 0) {
    selectedClassId.value = authStore.allClasses[0].id
    handleClassChange()
  }
})

watch(() => authStore.allClasses, (newList) => {
  if (newList.length > 0 && !selectedClassId.value) {
    selectedClassId.value = newList[0].id
    handleClassChange()
  }
}, { deep: true })
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
