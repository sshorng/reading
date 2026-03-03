<template>
  <div class="animate-fade-in pb-12">
    <!-- Achievement Stats Overview -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div class="card bg-stone-50/50 border-stone-200 shadow-sm flex flex-col items-center justify-center p-5">
        <h3 class="text-xs font-black text-stone-500 uppercase tracking-widest mb-1">功成名就 (解鎖)</h3>
        <p class="text-3xl lg:text-4xl font-black text-stone-800">{{ unlockedAchievements.length }} <span class="text-sm font-normal">座</span></p>
      </div>
      <div class="card bg-slate-50/50 border-slate-200 shadow-sm flex flex-col items-center justify-center p-5">
        <h3 class="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">未成之志 (待解鎖)</h3>
        <p class="text-3xl lg:text-4xl font-black text-slate-600">{{ lockedAchievements.length }} <span class="text-sm font-normal">座</span></p>
      </div>
      <div class="card bg-red-50/50 border-red-100 shadow-sm flex flex-col items-center justify-center p-5">
        <h3 class="text-xs font-black text-red-800/60 uppercase tracking-widest mb-1">目前位階</h3>
        <p class="text-2xl lg:text-3xl font-black text-red-800">{{ currentRank }}</p>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="flex flex-wrap gap-2 mb-8 animate-fade-in pl-1">
      <button @click="currentFilter = 'all'" 
              :class="currentFilter === 'all' ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'" 
              class="px-5 py-2 rounded-full text-sm font-bold transition-all">
        全覽
      </button>
      <button v-for="(cat, idx) in conditionOptions" :key="idx"
              @click="currentFilter = cat.label"
              :class="currentFilter === cat.label ? 'bg-red-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
              class="px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full" :class="getCategoryColorClass(cat.label, true)"></span>
        {{ cat.label }}
      </button>
    </div>

    <!-- Achievement Grid -->
    <div class="space-y-8">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="ach in filteredAchievements" :key="ach.id" 
               :class="[
                 'relative p-5 rounded-2xl border-y border-r border-l-4 transition-all duration-300 group overflow-hidden flex flex-col',
                 ach.isUnlocked ? 'bg-white border-slate-100 shadow-md hover:shadow-xl hover:-translate-y-1' : 'bg-slate-50/50 border-slate-100 grayscale opacity-70',
                 getCategoryColorClassByCondition(ach.conditions && ach.conditions[0]?.type)
               ]">

            <!-- Unlock Visual Effect / Stamp -->
            <div v-if="ach.isUnlocked" class="achievement-stamp">
                <span class="stamp-text">達成</span>
            </div>

            <div class="flex items-start gap-4 mb-4">
              <div :class="[
                  'text-4xl flex-shrink-0 w-14 h-14 bg-slate-50 flex items-center justify-center rounded-xl shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500',
                  ach.isUnlocked ? '' : 'filter grayscale opacity-50'
                ]">
                <template v-if="!ach.isUnlocked && ach.isHidden">❓</template>
                <template v-else>{{ ach.icon || '🏆' }}</template>
              </div>
              
              <div class="flex-grow min-w-0 z-10 pt-1">
                <h3 class="font-bold text-lg text-gray-800">
                    {{ (!ach.isUnlocked && ach.isHidden) ? '神祕成就' : ach.name }}
                    <span v-if="ach.isUnlocked && ach.unlockCount > 1" class="ml-2 px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-600 border border-amber-100 font-bold">×{{ ach.unlockCount }}</span>
                </h3>
                <p class="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">
                    {{ (!ach.isUnlocked && ach.isHidden) ? '此成就在解鎖前保持神祕，請繼續努力修業！' : ach.description }}
                </p>
                
              </div>
            </div>

            <div v-if="!ach.isUnlocked && ach.progress !== undefined && !ach.isHidden" class="mt-auto pt-4 border-t border-slate-50">
                <div class="flex justify-between items-center text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-1.5">
                    <span>{{ getConditionLabel(ach.conditions[0]?.type) }}</span>
                    <span>{{ ach.currentValue }} / {{ ach.targetValue }} ({{ ach.progress }}%)</span>
                </div>
                <div class="h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                    <div class="h-full bg-gradient-to-r from-stone-600 to-stone-800 rounded-full transition-all duration-1000" :style="{ width: `${ach.progress}%` }"></div>
                </div>
            </div>
            
            <div v-else class="mt-auto pt-4 border-t border-slate-50 flex flex-wrap gap-2">
                 <span v-for="(cond, cIdx) in (ach.isHidden && !ach.isUnlocked ? [] : ach.conditions)" :key="cIdx" class="px-2.5 py-1 rounded-md border border-slate-100 font-bold bg-slate-50/80 text-slate-500 text-xs shadow-inner">
                   {{ getConditionLabel(cond.type) }}{{ cond.value !== undefined ? ': ' + cond.value : '' }}
                 </span>
            </div>
          </div>
        </div>
    </div>
    
    <div v-if="loading" class="py-20 text-center flex flex-col items-center gap-4">
       <div class="loader w-10 h-10 border-4 border-red-800/10 border-t-red-800 rounded-full animate-spin"></div>
       <p class="text-slate-400 font-medium italic">正在翻閱功名簿...</p>
    </div>
    
    <div v-else-if="allAchievements.length === 0" class="py-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
        <p class="text-slate-300 font-medium">夫子尚未設下任何功名門檻。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../../firebase/init'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'

const authStore = useAuthStore()
const dataStore = useDataStore()

const loading = ref(false)
const allAchievements = ref([])
const unlockedRecords = ref([])

const currentRank = computed(() => {
    const count = unlockedRecords.value.length
    // 提供 50 個階級名稱，最高 50 件成就解鎖
    const ranks = [
        "初探書林", "入門學子", "勤學童生", "潛心求知", "展露頭角", 
        "粗通文墨", "字裡尋幽", "開卷有益", "孜孜不倦", "文思泉湧", // 1-10 (1~20 成就)
        "初具慧眼", "涉獵廣泛", "青雲志士", "小學初成", "漸入佳境",
        "博聞強記", "才思敏捷", "詞彙滿腹", "豁然開朗", "文章錦繡", // 11-20 (21~40 成就)
        "腹有詩書", "博學鴻儒", "才高八斗", "學富五車", "一代宗師"  // 21-25 (41~50 成就)
    ]
    if (count === 0) return '砥礪前行'
    const index = Math.min(Math.floor((count - 1) / 2), 24)
    return ranks[index]
})

const unlockedAchievements = computed(() => {
    return allAchievements.value.filter(ach => 
        unlockedRecords.value.some(r => r.achievementId === ach.id)
    ).map(ach => {
        const count = unlockedRecords.value.filter(r => r.achievementId === ach.id).length
        return { 
            ...ach, 
            isUnlocked: true,
            unlockCount: count || 1 
        }
    })
})

const lockedAchievements = computed(() => {
    return allAchievements.value.filter(ach => 
        !unlockedRecords.value.some(r => r.achievementId === ach.id)
    ).map(ach => {
        // Calculate progress if possible
        const progressData = calculateProgress(ach)
        return { ...ach, isUnlocked: false, ...progressData }
    })
})

const conditionOptions = [
    { label: '基礎與廣度', options: [{ value: 'submission_count', text: '總閱讀篇數 (篇)' }, { value: 'genre_explorer', text: '文體全通 (完成 N 種不同文體)' }, { value: 'unique_formats_read', text: '形式大師 (完成 N 種不同形式)' }, ...['記敘', '抒情', '說明', '議論', '應用'].map(tag => ({ value: `read_tag_contentType_${tag}`, text: `完成「${tag}」文章數 (篇)` })), ...['基礎', '普通', '進階', '困難'].map(tag => ({ value: `read_tag_difficulty_${tag}`, text: `完成「${tag}」難度數 (篇)` }))] },
    { label: '精準與品質', options: [{ value: 'high_score_streak', text: '連續高分次數 (次)' }, { value: 'average_score', text: '歷史初考總平均達標 (分)' }, { value: 'first_try_min_score', text: '單篇「初考」達標指定分數' }] },
    { label: '毅力與重修', options: [{ value: 'perfect_score_count', text: '最終獲得 100 分的總篇數 (篇)' }, { value: 'recovery_count', text: '初考不及格，但最終滿分的總篇數 (篇)' }, { value: 'min_retry_count', text: '單篇重考超過 N 次且及格' }] },
    { label: '恆心與進階', options: [{ value: 'login_streak', text: '連續登入天數 (天)' }, { value: 'completion_streak', text: '課業全清連續天數 (天)' }, { value: 'weekly_progress', text: '本週進步與否' }] },
    { label: '效率與作息', options: [{ value: 'speed_under_seconds', text: '單篇極速完賽短於 N 秒且及格' }, { value: 'duration_over_seconds', text: '長篇細讀作答長於 N 秒且及格' }, { value: 'days_before_deadline', text: '未雨綢繆：在期限前提早 N 天交卷' }, { value: 'off_hours_count', text: '深夜或極早晨交卷的總篇數 (篇)' }] }
]

const getConditionLabel = (type) => {
  if (!type) return ''
  for (const grp of conditionOptions) {
    const found = grp.options.find(o => o.value === type)
    if (found) return found.text
  }
  return type
}

const getCategoryColorClass = (label, bgOnly = false) => {
  if (!label) return bgOnly ? 'bg-stone-300' : 'border-l-stone-300'
  // 青玉 (Jade/Teal)
  if (label.includes('基礎與廣度')) return bgOnly ? 'bg-teal-700' : 'border-l-teal-700 hover:border-teal-800'
  // 丹金 (Bronze/Amber)
  if (label.includes('精準與品質')) return bgOnly ? 'bg-amber-700' : 'border-l-amber-700 hover:border-amber-800'
  // 絳紅 (Crimson/Theme Red)
  if (label.includes('毅力與重修')) return bgOnly ? 'bg-red-800' : 'border-l-red-800 hover:border-red-900'
  // 點墨 (Ink/Slate)
  if (label.includes('恆心與進階')) return bgOnly ? 'bg-slate-700' : 'border-l-slate-700 hover:border-slate-800'
  // 琉璃 (Indigo/Navy)
  if (label.includes('效率與作息')) return bgOnly ? 'bg-indigo-800' : 'border-l-indigo-800 hover:border-indigo-900'
  return bgOnly ? 'bg-stone-300' : 'border-l-stone-300'
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

const currentFilter = ref('all')

const filteredAchievements = computed(() => {
    const all = [...unlockedAchievements.value, ...lockedAchievements.value]
    if (currentFilter.value === 'all') return all
    
    return all.filter(ach => {
        return ach.conditions && ach.conditions.some(cond => {
            const category = conditionOptions.find(cat => cat.label === currentFilter.value)
            return category && category.options.some(opt => opt.value === cond.type)
        })
    })
})

const calculateProgress = (ach) => {
    if (!ach.conditions || ach.conditions.length === 0) return {}
    const cond = ach.conditions[0]
    const studentSubmissions = dataStore.allSubmissions.filter(s => s.studentId === authStore.currentUser?.studentId)
    const allAssig = allAssignmentsCache.value

    // == 1. 統一前處理增強數據 (與 backend 一致) ==
    const enhancedSubs = studentSubmissions.map(s => {
        const assignment = allAssig.find(a => a.id === s.assignmentId) || {}
        const attempts = s.attempts || []
        const firstAttempt = attempts.length > 0 ? attempts[0] : s
        const firstScore = firstAttempt.score || 0
        const bestScore = attempts.length > 0 ? Math.max(...attempts.map(a => a.score)) : (s.score || 0)
        const retryCount = Math.max(0, attempts.length - 1)
        const firstPassedAttempt = attempts.find(a => a.score >= 60)
        const passedDuration = firstPassedAttempt ? (firstPassedAttempt.durationSeconds || s.durationSeconds || 0) : (s.durationSeconds || 0)

        let daysEarly = 0
        let subDateObj = new Date()
        if (s.submittedAt) {
            subDateObj = s.submittedAt.toDate ? s.submittedAt.toDate() : new Date(s.submittedAt)
            if (assignment.dueDate) {
                const due = typeof assignment.dueDate === 'string' ? new Date(assignment.dueDate) : (assignment.dueDate.toDate ? assignment.dueDate.toDate() : new Date())
                daysEarly = (due - subDateObj) / (1000 * 60 * 60 * 24)
            }
        }
        const hour = subDateObj.getHours()
        const isOffHours = hour >= 23 || hour <= 4

        return { ...s, assignment, firstScore, bestScore, retryCount, passedDuration, daysEarly, isOffHours, subDateObj }
    })

    const val = parseInt(cond.value, 10) || 1
    let current = 0
    let target = val

    // == 2. 策略計算 ==
    const type = cond.type
    if (type === 'submission_count') current = enhancedSubs.length
    else if (type === 'genre_explorer') current = new Set(enhancedSubs.map(s => s.assignment?.tags?.contentType).filter(Boolean)).size
    else if (type === 'unique_formats_read') current = new Set(enhancedSubs.map(s => s.assignment?.tags?.format || '預設').filter(Boolean)).size
    else if (type === 'high_score_streak') current = authStore.currentUser?.highScoreStreak || 0
    else if (type === 'average_score') current = enhancedSubs.length > 0 ? Math.round(enhancedSubs.reduce((acc, s) => acc + s.firstScore, 0) / enhancedSubs.length) : 0
    else if (type === 'first_try_min_score') { target = 1; current = enhancedSubs.filter(s => s.firstScore >= val).length }
    else if (type === 'perfect_score_count') current = enhancedSubs.filter(s => s.bestScore >= 100).length
    else if (type === 'recovery_count') current = enhancedSubs.filter(s => s.firstScore < 60 && s.bestScore >= 100).length
    else if (type === 'min_retry_count') { target = 1; current = enhancedSubs.filter(s => s.retryCount >= val && s.bestScore >= 60).length }
    else if (type === 'login_streak') current = authStore.currentUser?.loginStreak || 0
    else if (type === 'completion_streak') current = authStore.currentUser?.completionStreak || 0
    else if (type === 'weekly_progress') {
        const now = new Date()
        const startOfThisWeek = new Date(now); startOfThisWeek.setDate(now.getDate() - now.getDay()); startOfThisWeek.setHours(0,0,0,0)
        const startOfLastWeek = new Date(startOfThisWeek.getTime() - 7 * 86400000)
        const startOfPrevWeek = new Date(startOfLastWeek.getTime() - 7 * 86400000)
        const lwTotal = enhancedSubs.filter(s => s.subDateObj >= startOfLastWeek && s.subDateObj < startOfThisWeek).reduce((sum, s) => sum + s.firstScore, 0)
        const pwTotal = enhancedSubs.filter(s => s.subDateObj >= startOfPrevWeek && s.subDateObj < startOfLastWeek).reduce((sum, s) => sum + s.firstScore, 0)
        target = 1; current = (lwTotal > 0 && lwTotal > pwTotal) ? 1 : 0
    }
    else if (type === 'speed_under_seconds') { target = 1; current = enhancedSubs.filter(s => s.passedDuration > 0 && s.passedDuration <= val && s.bestScore >= 60).length }
    else if (type === 'duration_over_seconds') { target = 1; current = enhancedSubs.filter(s => s.passedDuration >= val && s.bestScore >= 60).length }
    else if (type === 'days_before_deadline') { target = 1; current = enhancedSubs.filter(s => s.daysEarly >= val).length }
    else if (type === 'off_hours_count') current = enhancedSubs.filter(s => s.isOffHours).length
    else if (type && type.startsWith('read_tag_')) {
        const isContentType = type.startsWith('read_tag_contentType_')
        const tag = type.replace(isContentType ? 'read_tag_contentType_' : 'read_tag_difficulty_', '')
        current = enhancedSubs.filter(s => isContentType ? (s.assignment?.tags?.contentType === tag) : (s.assignment?.tags?.difficulty === tag)).length
    }

    const progress = Math.min(100, Math.round((current / target) * 100))
    return { currentValue: current, targetValue: target, progress }
}

const allAssignmentsCache = ref([])

const loadData = async () => {
    const studentId = authStore.currentUser?.studentId
    if (!studentId) return

    loading.value = true
    try {
        console.log("[Achievements] Loading data for student:", studentId)
        // Ensure we load assignments synchronously to cross-reference their metadata before computing progress
        const { getAssignments } = await import('../../services/api')
        allAssignmentsCache.value = await getAssignments()
        
        const [achSnap, unlSnap] = await Promise.all([
            getDocs(query(collection(db, 'achievements'), where('isEnabled', '==', true))),
            getDocs(query(collection(db, 'student_achievements'), where('studentId', '==', studentId)))
        ])
        
        allAchievements.value = achSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        unlockedRecords.value = unlSnap.docs.map(doc => doc.data())
        console.log("[Achievements] Loaded:", allAchievements.value.length, "achievements,", unlockedRecords.value.length, "unlocked")
    } catch (e) {
        console.error("[Achievements] Failed to load achievements", e)
    } finally {
        loading.value = false
    }
}

onMounted(loadData)
</script>
