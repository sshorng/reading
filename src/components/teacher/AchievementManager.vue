<template>
  <div class="card p-6 shadow-md border border-gray-100 min-h-[70vh]">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
      <div>
        <h3 class="text-2xl font-bold text-gray-800 flex items-center gap-2 font-rounded">
          <span class="w-2 h-8 bg-red-800 rounded-full shadow-sm"></span>
          勛章榮譽管領
        </h3>
        <p class="text-sm text-gray-400 mt-1 italic">設爵頒賞，以勵後學。</p>
      </div>
      <button @click="openNewModal" class="btn-primary py-2.5 px-6 font-bold flex items-center gap-2 shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        創設新典
      </button>
    </div>

    <!-- Achievement Grid -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
      <div class="loader-sm w-12 h-12 border-4 border-red-800/20 border-t-red-800 rounded-full animate-spin"></div>
      <p class="text-slate-400 font-medium">夫子稍候，正在翻閱榮譽名冊...</p>
    </div>

    <!-- Filter Bar -->
    <div class="flex flex-wrap gap-2 mb-6 animate-fade-in">
      <button @click="currentFilter = 'all'" 
              :class="currentFilter === 'all' ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'" 
              class="px-4 py-2 rounded-full text-sm font-bold transition-all">
        顯示全部
      </button>
      <button v-for="(cat, idx) in conditionOptions" :key="idx"
              @click="currentFilter = cat.label"
              :class="currentFilter === cat.label ? 'bg-red-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
              class="px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full" :class="getCategoryColorClass(cat.label, true)"></span>
        {{ cat.label }}
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-fade-in">
      <div v-for="ach in filteredAchievements" :key="ach.id" 
           :class="['group relative bg-white border-y border-r border-gray-100 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 flex flex-col border-l-4', getCategoryColorClassByCondition(ach.conditions[0]?.type)]">
        <div class="flex items-start gap-4 mb-4">
          <div class="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
            {{ ach.icon || '🏆' }}
          </div>
          <div class="flex-grow min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="font-black text-slate-800 text-lg truncate">{{ ach.name }}</h4>
              <span :class="ach.isEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'" 
                    class="px-2.5 py-1 text-xs font-black rounded-full border shadow-sm">
                {{ ach.isEnabled ? '宣示中' : '遺忘中' }}
              </span>
              <span v-if="ach.isHidden" class="bg-purple-50 text-purple-700 border-purple-100 px-2.5 py-1 text-xs font-black rounded-full border shadow-sm">祕傳</span>
            </div>
            <p class="text-xs text-slate-500 mt-2 leading-relaxed line-clamp-2 italic">「{{ ach.description }}」</p>
          </div>
        </div>
        
        <div class="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
           <div class="flex flex-wrap gap-2">
             <span v-for="(cond, cIdx) in ach.conditions" :key="cIdx" class="px-2.5 py-1 rounded-md border border-slate-100 font-bold bg-slate-50/80 text-slate-500 text-xs shadow-inner">
               {{ getConditionLabel(cond.type) }}{{ cond.value !== undefined ? ': ' + cond.value : '' }}
             </span>
           </div>
           <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
             <button @click="editAchievement(ach)" class="p-2 text-slate-400 hover:text-red-800 hover:bg-slate-50 rounded-lg transition-colors" title="修訂">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
             </button>
             <button @click="deleteConfirm(ach)" class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="焚毀">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
             </button>
           </div>
        </div>
      </div>
      
      <div v-if="achievements.length === 0" class="col-span-full py-20 text-center bg-slate-50/50 rounded-3xl border-4 border-dashed border-slate-100 flex flex-col items-center">
        <div class="text-slate-200 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
        </div>
        <p class="text-slate-400 font-bold text-xl">目前書院尚未設立任何榮譽勳章。</p>
        <button @click="openNewModal" class="btn-secondary mt-6 py-2 px-8 text-sm">現在創設</button>
      </div>
    </div>

    <!-- Custom Modal -->
    <AchievementModal 
      :is-visible="showModal"
      :editing-data="form"
      :is-editing="isEditing"
      @close="closeModal"
      @success="fetchAchievements"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase/init'
import AchievementModal from './AchievementModal.vue'

const achievements = ref([])
const loading = ref(false)
const currentFilter = ref('all')

const showModal = ref(false)
const isEditing = ref(false)
const form = ref(null)

const conditionOptions = [
    { 
        label: '基礎與廣度', 
        options: [
            { value: 'submission_count', text: '總閱讀篇數 (篇)' },
            { value: 'genre_explorer', text: '文體全通 (完成 N 種不同文體)' },
            { value: 'unique_formats_read', text: '形式大師 (完成 N 種不同形式)' },
            ...['記敘', '抒情', '說明', '議論', '應用'].map(tag => ({ value: `read_tag_contentType_${tag}`, text: `完成「${tag}」文章數 (篇)` })),
            ...['基礎', '普通', '進階', '困難'].map(tag => ({ value: `read_tag_difficulty_${tag}`, text: `完成「${tag}」難度數 (篇)` }))
        ] 
    },
    { 
        label: '精準與品質', 
        options: [
            { value: 'high_score_streak', text: '連續高分次數 (次)' }, 
            { value: 'average_score', text: '歷史初考總平均達標 (分)' }, 
            { value: 'first_try_min_score', text: '單篇「初考」達標指定分數 (一次即解鎖)' }
        ] 
    },
    { 
        label: '毅力與重修', 
        options: [
            { value: 'perfect_score_count', text: '最終獲得 100 分的總篇數 (篇)' }, 
            { value: 'recovery_count', text: '初考不及格，但最終滿分的總篇數 (篇)' }, 
            { value: 'min_retry_count', text: '單篇重考超過 N 次且及格 (一次即解鎖)' }
        ] 
    },
    { 
        label: '恆心與進階', 
        options: [
            { value: 'login_streak', text: '連續登入天數 (天)' }, 
            { value: 'completion_streak', text: '課業全清連續天數 (天)' }, 
            { value: 'weekly_progress', text: '本週進步與否 (無需填數值)' }
        ] 
    },
    { 
        label: '效率與作息', 
        options: [
            { value: 'speed_under_seconds', text: '單篇極速完賽短於 N 秒且及格 (一次即解鎖)' }, 
            { value: 'duration_over_seconds', text: '長篇細讀作答長於 N 秒且及格 (一次即解鎖)' }, 
            { value: 'days_before_deadline', text: '未雨綢繆：在期限前提早 N 天交卷 (一次即解鎖)' }, 
            { value: 'off_hours_count', text: '深夜或極早晨交卷的總篇數 (篇)' }
        ] 
    }
]

const getConditionLabel = (type) => {
  for (const grp of conditionOptions) {
    const found = grp.options.find(o => o.value === type)
    if (found) return found.text
  }
  return type
}

const getCategoryColorClass = (label, bgOnly = false) => {
  if (label.includes('基礎與廣度')) return bgOnly ? 'bg-emerald-400' : 'border-l-emerald-400 hover:border-emerald-500'
  if (label.includes('精準與品質')) return bgOnly ? 'bg-amber-400' : 'border-l-amber-400 hover:border-amber-500'
  if (label.includes('毅力與重修')) return bgOnly ? 'bg-rose-400' : 'border-l-rose-400 hover:border-rose-500'
  if (label.includes('恆心與進階')) return bgOnly ? 'bg-blue-400' : 'border-l-blue-400 hover:border-blue-500'
  if (label.includes('效率與作息')) return bgOnly ? 'bg-purple-400' : 'border-l-purple-400 hover:border-purple-500'
  return bgOnly ? 'bg-slate-300' : 'border-l-slate-300'
}

const getCategoryColorClassByCondition = (type) => {
  if (!type) return 'border-l-slate-300'
  for (const grp of conditionOptions) {
    if (grp.options.find(o => o.value === type)) {
      return getCategoryColorClass(grp.label)
    }
  }
  return 'border-l-slate-300'
}

import { computed } from 'vue'

const filteredAchievements = computed(() => {
  if (currentFilter.value === 'all') return achievements.value
  return achievements.value.filter(ach => {
    // Check if ANY of the achievement's conditions belong to the selected category
    return ach.conditions && ach.conditions.some(cond => {
      const category = conditionOptions.find(cat => cat.label === currentFilter.value)
      return category && category.options.some(opt => opt.value === cond.type)
    })
  })
})

const fetchAchievements = async () => {
  loading.value = true
  try {
    const q = query(collection(db, 'achievements'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    achievements.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

const openNewModal = () => {
  isEditing.value = false
  form.value = null
  showModal.value = true
}

const editAchievement = (ach) => {
  isEditing.value = true
  form.value = { ...ach }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const deleteConfirm = async (ach) => {
  if (!confirm(`確定要焚毀獎章「${ach.name}」嗎？這將導致所有學子的對應榮譽消失。`)) return
  try {
    await deleteDoc(doc(db, 'achievements', ach.id))
    await fetchAchievements()
  } catch (err) {
    console.error(err)
  }
}

onMounted(fetchAchievements)
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
</style>
