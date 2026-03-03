<template>
  <div v-if="isVisible" class="fixed inset-0 z-[200] overflow-y-auto">
    <div class="flex items-center justify-center min-h-screen p-4">
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>
      <div class="relative z-10 bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
        <!-- Header -->
        <div class="bg-slate-50/80 px-8 py-6 border-b flex justify-between items-center shrink-0">
          <div>
            <h3 class="text-xl font-black text-gray-800 flex items-center gap-2">
              <span class="w-2 h-6 bg-red-800 rounded-full"></span>
              挑戰紀錄：{{ assignment?.title }}
            </h3>
            <p class="text-xs text-gray-500 mt-1 font-medium">夫子可在此翻閱每位學子的參試歷程與作答細節。</p>
          </div>
          <div class="flex items-center gap-2">
            <button 
              @click="analyzeClassPerformance" 
              :disabled="loadingAnalysis || assignmentSubmissions.length === 0" 
              class="btn-primary py-2 px-4 shadow-sm font-bold flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <svg v-if="!loadingAnalysis" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <span v-else class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              {{ loadingAnalysis ? '夫子洞察中...' : 'AI 解析學堂表現' }}
            </button>
            <button @click="$emit('close')" class="text-gray-400 hover:text-red-800 transition-colors ml-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div class="flex-grow overflow-y-auto px-8 py-6 custom-scrollbar space-y-6">
          <!-- AI Analysis Result -->
          <div v-if="aiAnalysisResult" class="animate-slide-up p-6 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-2xl border border-indigo-100/50 shadow-inner">
            <div class="flex justify-between items-center mb-4">
              <h4 class="font-black text-indigo-800 flex items-center gap-2 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 10-2 0h-1a1 1 0 100 2h1a1 1 0 102 0v-1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 00-1-1H3a1 1 0 000 2h1a1 1 0 001-1zM8 16v-1a1 1 0 10-2 0v1a1 1 0 102 0zM13.657 15.657a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM16 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1z" /></svg>
                書院夫子策勵建議
              </h4>
              <button @click="aiAnalysisResult = ''" class="text-[10px] bg-white/80 px-2 py-1 rounded-full border shadow-sm text-gray-400 hover:text-red-800 transition-colors">隱藏報告</button>
            </div>
            <div class="prose prose-sm prose-indigo max-w-none prose-p:leading-relaxed" ref="analysisContentRef" v-html="markdownToHtml(aiAnalysisResult)"></div>
          </div>

          <!-- Students Status Table -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden min-h-[300px]">
            <table class="min-w-full divide-y divide-gray-100">
              <thead class="bg-gray-50/50">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">座號與姓名</th>
                  <th class="px-4 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">目前狀態</th>
                  <th class="px-4 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">初次得分</th>
                  <th class="px-4 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">作答耗時</th>
                  <th class="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest">卷軸管理</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                <tr v-if="loadingSubmissions">
                  <td colspan="5" class="py-20 text-center font-medium italic text-slate-300">正在查驗學子卷軸...</td>
                </tr>
                <tr v-else-if="classStudents.length === 0">
                  <td colspan="5" class="py-20 text-center font-medium text-slate-300">學堂內暫無學子資料。</td>
                </tr>
                <tr v-for="stu in classStudents" :key="stu.id" class="hover:bg-slate-50 transition-colors">
                  <td class="px-6 py-4">
                    <div class="flex flex-col">
                      <span class="text-base font-black text-slate-800">{{ stu.seatNumber }}號 {{ stu.name }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-4">
                    <span 
                      :class="[
                        'px-3 py-1 text-xs font-black rounded-full border shadow-sm',
                        stu.status.includes('已完成') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                        stu.status.includes('逾期') ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-slate-50 text-slate-400 border-slate-100'
                      ]"
                    >
                      {{ stu.status }}
                    </span>
                  </td>
                  <td class="px-4 py-4 text-center">
                    <span :class="stu.isPassed ? 'text-teal-600 font-black' : 'text-slate-400 font-medium'">{{ stu.score }}</span>
                  </td>
                  <td class="px-4 py-4 text-center text-xs text-slate-400 font-mono">{{ stu.duration }}</td>
                  <td class="px-6 py-4 text-right">
                    <button 
                      v-if="stu.hasSubmission" 
                      @click="reviewSingleSubmission(stu.sub)" 
                      class="text-red-800 hover:text-red-600 transition-colors text-sm font-black underline decoration-red-800/30"
                    >
                      詳加檢視
                    </button>
                    <span v-else class="text-xs text-slate-300">尚未繳卷</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Single Submission Detail Overlay -->
        <transition name="fade-slide">
          <div v-if="selectedSubmission" class="absolute inset-0 z-[210] overflow-y-auto bg-white flex flex-col animate-fade-in">
            <div class="bg-slate-50 border-b px-8 py-4 flex justify-between items-center shrink-0">
               <h3 class="text-lg font-black text-gray-800 flex items-center gap-2">
                 <span class="w-1.5 h-6 bg-amber-600 rounded-full"></span>
                 學子作答詳情：{{ selectedSubmission.name }}
               </h3>
               <button @click="selectedSubmission = null" class="btn-secondary py-1.5 px-6 text-xs font-bold rounded-xl shadow-sm">返回清單</button>
            </div>
            
            <div class="flex-grow p-8 custom-scrollbar space-y-6">
               <!-- Attempts History -->
               <div v-if="selectedSubmission.attempts?.length > 1" class="p-6 bg-slate-50 rounded-lg border border-slate-200">
                  <h4 class="font-black text-amber-900 mb-4 flex items-center gap-2 text-sm uppercase tracking-widest">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.414L11 9.586V6z" clip-rule="evenodd" /></svg>
                    作答歷程回溯
                  </h4>
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div v-for="(att, idx) in selectedSubmission.attempts" :key="idx" 
                         class="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                       <div class="flex flex-col">
                          <span class="text-[10px] font-black text-amber-800/40 uppercase">Attempt</span>
                          <span class="text-xs font-black text-amber-900">第 {{ idx + 1 }} 次挑戰</span>
                       </div>
                       <div class="text-right">
                         <div class="text-xl font-black text-amber-600 leading-none">{{ att.score }}%</div>
                         <div class="text-[10px] text-amber-800/40 mt-1 font-mono">⏱ {{ formatTime(att.durationSeconds || 0) }}</div>
                       </div>
                    </div>
                  </div>
               </div>

               <!-- Latest Attempt Quiz Detail -->
               <div class="space-y-4">
                  <h4 class="font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] flex items-center gap-3">
                    <span class="h-px bg-slate-100 flex-grow"></span>
                    初次挑戰答題詳情
                    <span class="h-px bg-slate-100 flex-grow"></span>
                  </h4>
                  
                  <div v-for="(q, i) in assignment?.questions" :key="i" 
                       :class="[
                         'p-6 rounded-2xl border relative overflow-hidden',
                         (selectedSubmission.attempts && selectedSubmission.attempts.length > 0 ? selectedSubmission.attempts[0].answers[i] : selectedSubmission.answers[i]) === q.correctAnswerIndex 
                         ? 'bg-teal-50 border-teal-200' : 'bg-rose-50 border-rose-200'
                       ]">
                    <!-- Subtle background indicator removed -->

                    <div class="flex justify-between items-start mb-4 relative z-10">
                      <div class="flex items-start gap-4">
                        <span class="shrink-0 w-8 h-8 rounded-lg bg-white/80 shadow-sm border border-slate-100 flex items-center justify-center font-black text-slate-400 text-sm">{{ i + 1 }}</span>
                        <p class="font-bold text-slate-800 text-base leading-relaxed pt-1">{{ q.questionText }}</p>
                      </div>
                      <span v-if="(selectedSubmission.attempts && selectedSubmission.attempts.length > 0 ? selectedSubmission.attempts[0].answers[i] : selectedSubmission.answers[i]) === q.correctAnswerIndex" 
                            class="text-teal-600 font-black text-[10px] bg-white/90 px-3 py-1 rounded-full border border-teal-100 shadow-sm shrink-0 ml-4 uppercase tracking-widest">正解</span>
                      <span v-else class="text-rose-600 font-black text-[10px] bg-white/90 px-3 py-1 rounded-full border border-rose-100 shadow-sm shrink-0 ml-4 uppercase tracking-widest">誤選</span>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 relative z-10">
                      <div class="text-sm bg-white/80 p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-1">
                        <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">學子選擇</span>
                        <span :class="[
                          'font-black text-base',
                          (selectedSubmission.attempts && selectedSubmission.attempts.length > 0 ? selectedSubmission.attempts[0].answers[i] : selectedSubmission.answers[i]) === q.correctAnswerIndex ? 'text-teal-700' : 'text-rose-700'
                        ]">
                          {{ (selectedSubmission.attempts && selectedSubmission.attempts.length > 0 ? selectedSubmission.attempts[0].answers[i] : selectedSubmission.answers[i]) !== null ? q.options[(selectedSubmission.attempts && selectedSubmission.attempts.length > 0 ? selectedSubmission.attempts[0].answers[i] : selectedSubmission.answers[i])] : '未作答' }}
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
                      <p class="text-sm text-slate-500 leading-relaxed italic pt-1">{{ q.explanation || '在此夫子暫無額外交代。' }}</p>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/init'
import { useAuthStore } from '../../stores/auth'
import { markdownToHtml, escapeHtml } from '../../utils/helpers'
import mermaid from 'mermaid'

const props = defineProps({
  isVisible: Boolean,
  assignment: Object,
  classId: String
})

const emit = defineEmits(['close'])

const authStore = useAuthStore()
const loadingSubmissions = ref(false)
const classStudents = ref([])
const assignmentSubmissions = ref([])
const aiAnalysisResult = ref('')
const loadingAnalysis = ref(false)
const analysisContentRef = ref(null)
const selectedSubmission = ref(null)

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}分${s}秒`
}

const reviewSingleSubmission = (sub) => {
  selectedSubmission.value = sub
}

const mermaidInitialized = ref(false)
const initializeMermaid = () => {
  if (mermaidInitialized.value) return;
  const elegantTheme = {
    background: '#FFFFFF',
    fontFamily: "'GenWanNeoSCjk', 'Noto Sans TC', sans-serif",
    primaryColor: '#F3F4F6',
    primaryBorderColor: '#D1D5DB',
    primaryTextColor: '#111827',
    lineColor: '#6B7280',
    nodeTextColor: '#111827',
  };
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: elegantTheme,
    securityLevel: 'loose',
    flowchart: { htmlLabels: true, curve: 'basis' },
    mindmap: { htmlLabels: true },
    sequence: { useMaxWidth: true, showSequenceNumbers: true },
    gantt: { useMaxWidth: true }
  });
  mermaidInitialized.value = true;
}

const renderAllMermaid = async (container) => {
  if (!container) return;
  const elements = Array.from(container.querySelectorAll('.mermaid:not([data-processed="true"])'));
  if (elements.length === 0) return;

  initializeMermaid();

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    let definition = el.textContent
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
      .replace(/```mermaid/g, '').replace(/```/g, '').trim();
    if (!definition) continue;

    try {
      const uniqueId = `mermaid-svg-review-${Date.now()}-${i}`;
      const { svg } = await mermaid.render(uniqueId, definition);
      el.innerHTML = svg;
      el.setAttribute('data-processed', 'true');
    } catch (err) {
      console.warn('[Mermaid] Review render failed', err);
      // Fallback display
      el.innerHTML = `<pre class="p-4 text-xs bg-slate-50 border rounded">${escapeHtml(definition)}</pre>`;
      el.setAttribute('data-processed', 'true');
    }
  }
}

const loadSubmissions = async () => {
  if (!props.isVisible || !props.assignment || !props.classId) return
  
  loadingSubmissions.value = true
  aiAnalysisResult.value = ''
  try {
    const stuSnap = await getDocs(collection(db, `classes/${props.classId}/students`))
    const studentsList = stuSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    const q = query(
      collection(db, 'submissions'), 
      where('assignmentId', '==', props.assignment.id), 
      where('classId', '==', props.classId)
    )
    const snap = await getDocs(q)
    const subs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    assignmentSubmissions.value = subs

    classStudents.value = studentsList.map(stu => {
       const sub = subs.find(s => s.studentId === stu.id)
       let status = '未應試'
       let score = '-'
       let duration = '-'
       let hasSubmission = !!sub
       let isPassed = false

       if (sub) {
          const firstScore = sub.attempts && sub.attempts.length > 0 ? sub.attempts[0].score : (sub.score || 0)
          const highestScore = sub.attempts && sub.attempts.length > 0 ? Math.max(...sub.attempts.map(a => a.score)) : (sub.score || 0)
          isPassed = highestScore >= 60

          score = `${firstScore}%`
          
          let durSeconds = sub.attempts && sub.attempts.length > 0 ? sub.attempts[0].durationSeconds : sub.durationSeconds
          if(durSeconds) {
             duration = `${Math.floor(durSeconds/60)}分${durSeconds%60}秒`
          }
          
          if (isPassed) {
             status = sub.isOverdue ? '逾期完成' : '已完成'
          } else if (!isPassed && sub.attempts && sub.attempts.length > 0) {
             status = `未完（挑戰 ${sub.attempts.length} 次）`
          } else {
             status = '未完'
          }

          if (durSeconds < 60 && firstScore < 60) {
              status += ' ⚠️'
          }
       }

       return { ...stu, sub, status, score, duration, hasSubmission, isPassed }
    }).sort((a,b) => a.seatNumber - b.seatNumber)
  } catch (err) {
    console.error('Error loading submissions:', err)
  } finally {
    loadingSubmissions.value = false
  }
}

watch(() => props.isVisible, (val) => {
  if (val) loadSubmissions()
}, { immediate: true })

watch(aiAnalysisResult, () => {
    if (aiAnalysisResult.value) {
        nextTick(() => renderAllMermaid(analysisContentRef.value))
    }
})

const analyzeClassPerformance = async () => {
   if (assignmentSubmissions.value.length === 0) return
   
   loadingAnalysis.value = true
   try {
      const article = props.assignment
      const questionsData = article.questions || []
      const analysisData = questionsData.map((q, q_idx) => {
         const answerCounts = q.options.map(() => 0)
         let correctCount = 0
         assignmentSubmissions.value.forEach(s => {
            const answerIdx = s.answers ? s.answers[q_idx] : null
            if (answerIdx !== null && answerIdx < answerCounts.length) answerCounts[answerIdx]++
            if (answerIdx === q.correctAnswerIndex) correctCount++
         })
         return {
            question: q.questionText,
            options: q.options,
            correctAnswer: q.options[q.correctAnswerIndex],
            totalAnswers: assignmentSubmissions.value.length,
            correctCount,
            answerDistribution: answerCounts
         }
      })

      const teacherName = authStore.currentUser?.displayName || '研墨夫子'
      const today = new Date()
      const reportDate = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`
      
      const prompt = `身為一位洞察敏銳的書院夫子，請根據以下這份閱讀試煉的作答數據，為${teacherName}夫子提供一份專業、深入的教學策勵報告。
---
**課業基本資料**
- **報告日期**: ${reportDate}
- **試煉篇章**: 《${article.title}》
- **應試人數**: ${assignmentSubmissions.value.length} 人
---
**學子作答數據**
\`\`\`json
${JSON.stringify(analysisData, null, 2)}
\`\`\`
---
**策勵撰寫要求**
1.  **引言**: 簡要說明本次試煉的整體表現（如及格率、整體難度感）。
2.  **逐題分析**: 深入探討高誘答率的錯誤選項，分析學子可能的學習盲點（例如：斷章取義、忽略關聯等）。如果需要，可以運用 Mermaid 語法繪製一到兩個統計圖表輔助說明。
3.  **綜合評估與教學建議**：總結學子在 PISA 三層次（擷取、統整、省思）上的整體表現，並提出 2-3 點具體、可行的教學調整方向。
4.  **格式**: 請使用 Markdown 格式，讓報告清晰易讀，並帶有鼓勵與專業的語氣。`

      const { callGenerativeAI } = await import('../../services/ai')
      const result = await callGenerativeAI(prompt, null, null, 'teacher')
      aiAnalysisResult.value = result
   } catch (err) {
      console.error('AI Analysis Error:', err)
      alert('AI 分析失敗：' + err.message)
   } finally {
      loadingAnalysis.value = false
   }
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }

:deep(.mermaid svg) {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0 auto;
}

/* --- Mindmap Hierarchical Styling --- */
:deep(.mermaid .mindmap-node) {
    rx: 8;
    ry: 8;
    stroke-width: 2px !important;
}

:deep(.mermaid .mindmap-node--level-0) {
    fill: #8C384D !important; /* Root: Rouge Red */
    stroke: #6E2C3C !important;
}
:deep(.mermaid .mindmap-node--level-0 text),
:deep(.mermaid .mindmap-node--level-0 .node-label) {
    fill: #ffffff !important;
    color: #ffffff !important;
    font-weight: 900 !important;
}

:deep(.mermaid .mindmap-node--level-1) {
    fill: #576c73 !important; /* Level 1: Scholar Gray */
    stroke: #435459 !important;
}
:deep(.mermaid .mindmap-node--level-1 text),
:deep(.mermaid .mindmap-node--level-1 .node-label) {
    fill: #ffffff !important;
    color: #ffffff !important;
    font-weight: 700 !important;
}

:deep(.mermaid .mindmap-node--level-2),
:deep(.mermaid .mindmap-node--level-3),
:deep(.mermaid .mindmap-node--level-4) {
    fill: #fdfbf6 !important; /* Leaves: Rice Paper White */
    stroke: #d1d5db !important;
    stroke-dasharray: 2,2;
}
:deep(.mermaid .mindmap-node--level-2 text),
:deep(.mermaid .mindmap-node--level-2 .node-label) {
    fill: #374151 !important;
    color: #374151 !important;
}

:deep(.mermaid .mindmap-edge) {
    stroke: #cbd5e1 !important;
    stroke-width: 2px !important;
}

:deep(.prose p) {
    margin-bottom: 1.25rem;
    line-height: 1.8;
}

/* Mermaid Styling */
:deep(.mermaid svg) {
    max-width: 100%;
    height: auto;
    margin: 1rem auto;
    overflow: visible !important;
}

:deep(.mermaid) {
    overflow: visible !important;
}

:deep(.mermaid svg text) {
    font-family: 'GenWanNeoSCjk', 'Noto Sans TC', sans-serif !important;
    fill: #374151 !important;
}

:deep(.mermaid .node rect),
:deep(.mermaid .node circle),
:deep(.mermaid .node polygon),
:deep(.mermaid .node .basic) {
    fill: #fdfbf6 !important;
    stroke: #576c73 !important;
    stroke-width: 2px !important;
}
</style>
