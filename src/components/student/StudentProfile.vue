<template>
  <div class="custom-scrollbar overflow-y-auto animate-fade-in">
    <!-- Stats Banner -->
    <div v-if="submissions.length > 0" class="mb-8 bg-slate-50 p-6 rounded-xl border border-slate-100">
       <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="text-center p-3 bg-white rounded-lg shadow-sm border border-slate-100">
             <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">平均得分</div>
             <div class="text-2xl font-black text-emerald-600">{{ avgScore.toFixed(1) }}</div>
          </div>
          <div class="text-center p-3 bg-white rounded-lg shadow-sm border border-slate-100">
             <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">完成篇數</div>
             <div class="text-2xl font-black text-blue-600">{{ submissions.length }}</div>
          </div>
          <div class="text-center p-3 bg-white rounded-lg shadow-sm border border-slate-100">
             <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">作業完成率</div>
             <div class="text-2xl font-black text-red-800">{{ completionRate }}%</div>
          </div>
       </div>

       <!-- Chart Container -->
       <div class="relative h-64 bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
          <canvas ref="chartCanvas"></canvas>
       </div>
    </div>

    <!-- Submission History List -->
    <div v-if="submissions.length > 0" class="grid grid-cols-1 gap-4 pr-1">
      <div class="flex items-center gap-3 mb-2 ml-2">
          <span class="w-1.5 h-4 bg-teal-500 rounded-full"></span>
          <span class="text-sm font-bold text-slate-600">詳細作答記錄</span>
      </div>
      <div v-for="sub in submissions" :key="sub.id" 
           @click="viewSubmissionDetail(sub)"
           class="p-5 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors group">
        <div class="flex justify-between items-start mb-3">
          <div class="space-y-1">
            <div class="font-black text-slate-800 group-hover:text-red-800 transition-colors flex items-center gap-2">
              {{ sub.assignmentTitle || '無題篇章' }}
            </div>
            <div class="text-[10px] text-slate-400 flex items-center gap-2">
              <span class="bg-white px-2 py-0.5 rounded border border-slate-100">挑戰：{{ sub.attempts?.length || 1 }} 次</span>
              <span v-if="sub.updatedAt" class="opacity-70">最近繳卷：{{ formatDate(sub.updatedAt) }}</span>
            </div>
            <div class="text-[10px] pt-0.5">
              <template v-if="assignmentDeadlines[sub.assignmentId]">
                 <span :class="isLate(sub.updatedAt, assignmentDeadlines[sub.assignmentId]) ? 'text-rose-500 font-bold' : 'text-slate-400'">
                   ⏳ 期限：{{ formatDate(assignmentDeadlines[sub.assignmentId]) }}
                   <span v-if="isLate(sub.updatedAt, assignmentDeadlines[sub.assignmentId])">(已遲交)</span>
                 </span>
              </template>
            </div>
          </div>
          <div :class="getScoreClass(sub)" class="font-black text-2xl flex flex-col items-end leading-tight">
            {{ getFirstScore(sub) }}
            <span class="text-[9px] font-bold uppercase tracking-tighter opacity-50">Score</span>
          </div>
        </div>
        <div v-if="sub.attempts && sub.attempts.length > 0" class="flex gap-1.5 flex-wrap">
          <span v-for="(attempt, idx) in sub.attempts" :key="idx" 
                class="px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-bold text-slate-500 shadow-sm">
            第{{ idx+1 }}次：{{ attempt.score }}%
          </span>
        </div>
      </div>
    </div>
      <div v-else class="text-center py-20 text-slate-300">
        <svg class="w-16 h-16 mx-auto mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
        <p class="font-medium">此生尚未在任何篇章留下墨寶。</p>
      </div>

      <!-- Submission Detail Overlay -->
      <transition name="fade-slide">
        <div v-if="selectedSubDetail" class="absolute inset-0 z-50 overflow-y-auto bg-white flex flex-col animate-fade-in">
            <div class="bg-slate-50 border-b px-8 py-4 flex justify-between items-center shrink-0">
                <h3 class="text-lg font-black text-gray-800 flex items-center gap-2">
                    <span class="w-1.5 h-6 bg-amber-600 rounded-full"></span>
                    答題詳情：{{ selectedSubDetail.assignmentTitle }}
                </h3>
                <button @click="selectedSubDetail = null" class="btn-secondary py-1.5 px-6 text-xs font-bold rounded-xl shadow-sm">返回歷程</button>
            </div>
            
            <div class="flex-grow p-8 custom-scrollbar space-y-6">
                <div v-if="loadingDetail" class="flex flex-col items-center justify-center py-20 gap-4">
                    <div class="loader-sm w-10 h-10 border-4 border-amber-800/20 border-t-amber-600 rounded-full animate-spin"></div>
                    <p class="text-amber-600 font-medium italic">正在查閱卷宗內容...</p>
                </div>
                
                <template v-else-if="detailAssignment">
                    <!-- Latest Attempt Quiz Detail -->
                    <div class="space-y-4">
                        <h4 class="font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] flex items-center gap-3">
                            <span class="h-px bg-slate-100 flex-grow"></span>
                            初次挑戰答題詳情
                            <span class="h-px bg-slate-100 flex-grow"></span>
                        </h4>
                        
                        <div v-for="(q, i) in detailAssignment.questions" :key="i" 
                            :class="[
                                'p-6 rounded-xl border relative',
                                (selectedSubDetail.attempts?.length ? selectedSubDetail.attempts[0].answers[i] : selectedSubDetail.answers[i]) === q.correctAnswerIndex 
                                ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'
                            ]">
                            <div class="flex justify-between items-start mb-4 relative z-10">
                                <div class="flex items-start gap-4">
                                    <span class="shrink-0 w-8 h-8 rounded-lg bg-white/80 shadow-sm border border-slate-100 flex items-center justify-center font-black text-slate-400 text-sm">{{ i + 1 }}</span>
                                    <p class="font-bold text-slate-800 text-base leading-relaxed pt-1">{{ q.questionText }}</p>
                                </div>
                                <span v-if="(selectedSubDetail.attempts?.length ? selectedSubDetail.attempts[0].answers[i] : selectedSubDetail.answers[i]) === q.correctAnswerIndex" 
                                        class="text-teal-600 font-black text-[10px] bg-white/90 px-3 py-1 rounded-full border border-teal-100 shadow-sm shrink-0 ml-4 uppercase tracking-widest">正解</span>
                                <span v-else class="text-rose-600 font-black text-[10px] bg-white/90 px-3 py-1 rounded-full border border-rose-100 shadow-sm shrink-0 ml-4 uppercase tracking-widest">誤選</span>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 relative z-10">
                                <div class="text-sm bg-white/80 p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-1">
                                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">你的選擇</span>
                                    <span :class="['font-black text-base', (selectedSubDetail.attempts?.length ? selectedSubDetail.attempts[0].answers[i] : selectedSubDetail.answers[i]) === q.correctAnswerIndex ? 'text-teal-700' : 'text-rose-700']">
                                        {{ (selectedSubDetail.attempts?.length ? selectedSubDetail.attempts[0].answers[i] : selectedSubDetail.answers[i]) !== null ? q.options[(selectedSubDetail.attempts?.length ? selectedSubDetail.attempts[0].answers[i] : selectedSubDetail.answers[i])] : '未作答' }}
                                    </span>
                                </div>
                                <div class="text-sm bg-white/80 p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-1">
                                    <span class="text-[10px] font-black text-emerald-600/40 uppercase tracking-widest">標準答案</span>
                                    <span class="text-slate-800 font-black text-base">{{ q.options[q.correctAnswerIndex] }}</span>
                                </div>
                            </div>

                            <div class="pt-5 border-t border-slate-200/50 flex gap-4 relative z-10">
                                <div class="shrink-0 flex flex-col items-center">
                                    <div class="w-8 h-8 rounded-full bg-red-800/10 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    </div>
                                    <span class="text-[9px] font-black text-red-800/40 uppercase tracking-[0.2em] mt-2">淺解</span>
                                </div>
                                <p class="text-sm text-slate-500 leading-relaxed italic pt-1">{{ q.explanation || '夫子暫無額外交代。' }}</p>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </div>
      </transition>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import { getAssignmentById, getAssignments } from '../../services/api'

const props = defineProps({
  submissions: { type: Array, default: () => [] }
})

const chartCanvas = ref(null)
let chartInstance = null

const selectedSubDetail = ref(null)
const detailAssignment = ref(null)
const loadingDetail = ref(false)

const getFirstScore = (sub) => {
  if (sub.attempts && sub.attempts.length > 0) {
    return sub.attempts[0].score
  }
  return sub.score || 0
}

const avgScore = computed(() => {
  if (!props.submissions.length) return 0
  const total = props.submissions.reduce((sum, s) => sum + getFirstScore(s), 0)
  return total / props.submissions.length
})

const assignmentDeadlines = ref({})

const isLate = (submitTime, deadline) => {
  if (!submitTime || !deadline) return false;
  const submitDate = submitTime.toDate ? submitTime.toDate().getTime() : new Date(submitTime).getTime();
  const deadlineDate = deadline.toMillis ? deadline.toMillis() : new Date(deadline).getTime();
  return submitDate > deadlineDate;
}

const completionRate = ref(0)
const calculateCompletion = async () => {
  const all = await getAssignments()
  const now = Date.now()
  
  // 只計算公開且已經到期的文章
  const dueAssignments = all.filter(a => {
    if (a.isPublic !== true) return false
    if (!a.deadline) return false
    
    let deadlineTime = 0
    if (typeof a.deadline.toMillis === 'function') {
      deadlineTime = a.deadline.toMillis()
      assignmentDeadlines.value[a.id] = a.deadline
    } else if (a.deadline.seconds) {
      deadlineTime = a.deadline.seconds * 1000
      assignmentDeadlines.value[a.id] = a.deadline
    } else {
      deadlineTime = new Date(a.deadline).getTime()
      assignmentDeadlines.value[a.id] = a.deadline
    }
    
    return deadlineTime < now
  })
  
  // 把所有還沒到期的作業期限也存下來，以便顯示
  all.forEach(a => {
    if (a.isPublic && a.deadline && !assignmentDeadlines.value[a.id]) {
      assignmentDeadlines.value[a.id] = a.deadline
    }
  })

  // 如果這名學生目前沒有任何「已逾期」的文章，作業完成率預設算 100% 或是依已完成算
  if (dueAssignments.length === 0) {
    completionRate.value = 100
    return
  }

  const passedIds = new Set(props.submissions.filter(s => {
    const high = s.attempts && s.attempts.length > 0 ? Math.max(...s.attempts.map(a => a.score)) : (s.score || 0)
    return high >= 60
  }).map(s => s.assignmentId))

  let passedDueCount = 0
  dueAssignments.forEach(a => {
    if (passedIds.has(a.id)) passedDueCount++
  })

  completionRate.value = Math.min(100, Math.round((passedDueCount / dueAssignments.length) * 100))
}

const createChart = () => {
  if (chartInstance) chartInstance.destroy()
  if (!chartCanvas.value || props.submissions.length === 0) return

  const weekData = new Map()
  props.submissions.forEach(sub => {
    const ts = sub.lastSubmittedAt || sub.submittedAt || sub.updatedAt
    if (!ts) return
    const date = ts.toDate ? ts.toDate() : new Date(ts)
    
    // 找出該週的星期一
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    
    const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
    const label = `${monday.getMonth() + 1}/${monday.getDate()}-${sunday.getMonth() + 1}/${sunday.getDate()}`
    
    if (!weekData.has(weekKey)) {
      weekData.set(weekKey, { label, scores: [], count: 0, ts: monday.getTime() })
    }
    weekData.get(weekKey).scores.push(getFirstScore(sub))
    weekData.get(weekKey).count++
  })

  const sortedWeeks = Array.from(weekData.values()).sort((a,b) => a.ts - b.ts)
  const labels = sortedWeeks.map(w => w.label)
  const avgScores = sortedWeeks.map(w => w.scores.reduce((a,b) => a + b, 0) / w.scores.length)
  const counts = sortedWeeks.map(w => w.count)

  const ctx = chartCanvas.value.getContext('2d')
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '完成篇數',
          data: counts,
          backgroundColor: 'rgba(56, 178, 172, 0.2)',
          borderColor: 'rgba(56, 178, 172, 1)',
          borderWidth: 2,
          yAxisID: 'yCount',
          borderRadius: 8,
          order: 2
        },
        {
          label: '平均分數',
          data: avgScores,
          type: 'line',
          backgroundColor: 'rgba(140, 56, 77, 0.1)',
          borderColor: 'rgba(140, 56, 77, 1)',
          borderWidth: 3,
          tension: 0.4,
          pointBackgroundColor: '#8C384D',
          fill: true,
          yAxisID: 'yScore',
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false } },
      scales: {
        yScore: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          max: 100,
          grid: { display: false },
          ticks: { font: { size: 10, weight: 'bold' } }
        },
        yCount: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          ticks: { stepSize: 1, font: { size: 10, weight: 'bold' } },
          grid: { color: 'rgba(0,0,0,0.03)' }
        },
        x: {
          ticks: { font: { size: 11, family: "'GenWanNeoSCjk', 'Noto Sans TC'" } },
          grid: { display: false }
        }
      }
    }
  })
}

watch(() => props.submissions, (subs) => {
  if (subs.length > 0) {
    nextTick(() => createChart())
  }
  calculateCompletion()
}, { immediate: true, deep: true })

const formatDate = (val) => {
  if (!val) return ''
  const d = val.toDate ? val.toDate() : new Date(val)
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`
}

const getScoreClass = (sub) => {
  const score = getFirstScore(sub)
  return score >= 60 ? 'text-teal-600' : 'text-rose-600'
}

const viewSubmissionDetail = async (sub) => {
    selectedSubDetail.value = sub
    loadingDetail.value = true
    detailAssignment.value = null
    try {
        const assignment = await getAssignmentById(sub.assignmentId)
        detailAssignment.value = assignment
    } catch (e) {
        console.error("Failed to load assignment detail", e)
    } finally {
        loadingDetail.value = false
    }
}

onMounted(() => {
    if (props.submissions.length > 0) {
        nextTick(() => createChart())
    }
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
</style>
