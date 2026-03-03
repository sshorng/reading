<template>
  <div class="animate-fade-in pb-12">
    <!-- Achievement Stats Overview -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div class="card bg-orange-50/50 border-orange-100 shadow-sm flex flex-col items-center justify-center p-5">
        <h3 class="text-xs font-black text-orange-800/40 uppercase tracking-widest mb-1">功成名就 (解鎖)</h3>
        <p class="text-3xl lg:text-4xl font-black text-orange-600">{{ unlockedAchievements.length }} <span class="text-sm font-normal">座</span></p>
      </div>
      <div class="card bg-emerald-50/50 border-emerald-100 shadow-sm flex flex-col items-center justify-center p-5">
        <h3 class="text-xs font-black text-emerald-800/40 uppercase tracking-widest mb-1">未成之志 (待解鎖)</h3>
        <p class="text-3xl lg:text-4xl font-black text-emerald-600">{{ lockedAchievements.length }} <span class="text-sm font-normal">座</span></p>
      </div>
      <div class="card bg-rose-50/50 border-rose-100 shadow-sm flex flex-col items-center justify-center p-5">
        <h3 class="text-xs font-black text-rose-800/40 uppercase tracking-widest mb-1">目前位階</h3>
        <p class="text-2xl lg:text-3xl font-black text-rose-800">{{ currentRank }}</p>
      </div>
    </div>

    <!-- Achievement Tabs or Groups -->
    <div class="space-y-8">
      <div v-for="cat in achievementCategories" :key="cat.name" class="space-y-4">
        <div class="flex items-center gap-4">
          <div class="h-px bg-slate-200 flex-grow"></div>
          <h2 class="text-xs font-black text-slate-500 uppercase tracking-[0.2em] bg-white px-3">{{ cat.name }}</h2>
          <div class="h-px bg-slate-200 flex-grow"></div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="ach in cat.items" :key="ach.id" 
               :class="[
                 'relative p-4 rounded-xl border transition-colors duration-200 group overflow-hidden',
                 ach.isUnlocked ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 shadow-sm' : 'bg-slate-50/50 border-slate-100 grayscale opacity-70'
               ]">

            <!-- Unlock Visual Effect / Stamp -->
            <div v-if="ach.isUnlocked" class="achievement-stamp">
                <span class="stamp-text">達成</span>
            </div>

            <div class="flex items-start gap-4">
              <div :class="[
                  'text-4xl flex-shrink-0',
                  ach.isUnlocked ? '' : 'filter grayscale opacity-50'
                ]">
                {{ ach.icon || '🏆' }}
              </div>
              
              <div class="flex-grow min-w-0 z-10 pt-1">
                <h3 class="font-bold text-base text-gray-800">
                    {{ ach.name }}
                    <span v-if="ach.isUnlocked && ach.unlockCount > 1" class="ml-2 text-xs text-amber-600 font-bold">×{{ ach.unlockCount }}</span>
                </h3>
                <p class="text-xs text-gray-500 mt-0.5 leading-snug">{{ ach.description }}</p>
                
                <div v-if="!ach.isUnlocked && ach.progress !== undefined" class="mt-3">
                    <div class="flex justify-between items-center text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-1">
                        <span>{{ ach.currentValue }} / {{ ach.targetValue }}</span>
                        <span>{{ ach.progress }}%</span>
                    </div>
                    <div class="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-teal-400 to-teal-500 rounded-full transition-all duration-500" :style="{ width: `${ach.progress}%` }"></div>
                    </div>
                </div>
              </div>
            </div>
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
    if (count >= 50) return '萬卷歸宗'
    if (count >= 45) return '超凡入聖'
    if (count >= 40) return '天人合一'
    if (count >= 35) return '登峰造極'
    if (count >= 30) return '絕世大師'
    if (count >= 25) return '一代宗師'
    if (count >= 20) return '淵博大儒'
    if (count >= 15) return '博學鴻儒'
    if (count >= 10) return '文采斐然'
    if (count >= 7) return '青雲志士'
    if (count >= 4) return '展露頭角'
    if (count >= 1) return '初出茅廬'
    return '砥礪前行'
})

const unlockedAchievements = computed(() => {
    return allAchievements.value.filter(ach => 
        unlockedRecords.value.some(r => r.achievementId === ach.id)
    ).map(ach => {
        const record = unlockedRecords.value.find(r => r.achievementId === ach.id)
        return { 
            ...ach, 
            isUnlocked: true,
            unlockCount: record?.count || 1 
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

const achievementCategories = computed(() => {
    const all = [...unlockedAchievements.value, ...lockedAchievements.value]
    return [
        { name: '修業功名', items: all.filter(a => a.conditions?.some(c => c.type === 'submission_count' || c.type === 'average_score')) },
        { name: '專研獎章', items: all.filter(a => a.conditions?.some(c => c.type.startsWith('read_tag'))) },
        { name: '其他成就', items: all.filter(a => !a.conditions?.some(c => c.type === 'submission_count' || c.type === 'average_score' || c.type.startsWith('read_tag'))) }
    ].filter(cat => cat.items.length > 0)
})

const calculateProgress = (ach) => {
    if (!ach.conditions || ach.conditions.length === 0) return {}
    // Simplified: check the first condition
    const cond = ach.conditions[0]
    const studentSubmissions = dataStore.allSubmissions.filter(s => s.studentId === authStore.currentUser?.studentId)
    
    let current = 0
    if (cond.type === 'submission_count') {
        current = studentSubmissions.length
    } else if (cond.type === 'average_score') {
        if (studentSubmissions.length === 0) current = 0
        else {
            const scores = studentSubmissions.map(s => s.attempts?.length ? Math.max(...s.attempts.map(a => a.score)) : (s.score || 0))
            current = Math.round(scores.reduce((a,b) => a+b, 0) / scores.length)
        }
    } else if (cond.type.startsWith('read_tag_contentType_')) {
        const tag = cond.type.replace('read_tag_contentType_', '')
        current = studentSubmissions.filter(s => s.contentType === tag).length
    } else if (cond.type.startsWith('read_tag_difficulty_')) {
        const tag = cond.type.replace('read_tag_difficulty_', '')
        current = studentSubmissions.filter(s => s.difficulty === tag).length
    }
    
    const target = cond.value || 1
    const progress = Math.min(100, Math.round((current / target) * 100))
    return { currentValue: current, targetValue: target, progress }
}

const loadData = async () => {
    const studentId = authStore.currentUser?.studentId
    if (!studentId) return

    loading.value = true
    try {
        console.log("[Achievements] Loading data for student:", studentId)
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
