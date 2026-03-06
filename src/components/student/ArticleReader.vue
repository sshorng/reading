<template>
  <div class="card p-6 relative animate-fade-in">

    <!-- Highlight Toolbar -->
    <div id="highlight-toolbar"
         v-show="showHighlightToolbar"
         ref="toolbarRef"
         :style="{ top: toolbarPosition.top + 'px', left: toolbarPosition.left + 'px' }"
         class="fixed z-[70] bg-slate-800 shadow-xl rounded-lg p-1.5 flex items-center space-x-2 border border-slate-600 transition-opacity duration-200">
        <button @mousedown.prevent="applyHighlight('rgba(254, 180, 180, 0.8)')" class="highlight-btn w-8 h-8 rounded-full bg-rose-300 border-2 border-white hover:scale-110 transition-transform shadow-sm"></button>
        <button @mousedown.prevent="applyHighlight('rgba(254, 235, 150, 0.8)')" class="highlight-btn w-8 h-8 rounded-full bg-amber-200 border-2 border-white hover:scale-110 transition-transform shadow-sm"></button>
        <button @mousedown.prevent="applyHighlight('rgba(210, 230, 255, 0.8)')" class="highlight-btn w-8 h-8 rounded-full bg-sky-200 border-2 border-white hover:scale-110 transition-transform shadow-sm"></button>
        <div class="w-[1px] h-6 bg-slate-600 mx-1"></div>
        <button @mousedown.prevent="removeHighlight" id="remove-highlight-btn" class="w-8 h-8 rounded-full flex items-center justify-center text-white bg-slate-600 hover:bg-slate-500 transition-colors shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    </div>

    <!-- Header Row -->
    <div class="flex justify-between items-center">
    <button @click="$emit('back')" class="btn-primary py-2 px-5 text-sm flex items-center gap-2 shadow-md">
       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
         <path fill-rule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z" />
       </svg>
       返回
    </button>

    <!-- Top Right -->
    <div class="flex gap-3 items-center">
        <template v-if="isTeacher">
            <button @click="$emit('edit', assignment)" class="edit-article-btn btn-secondary py-2 px-4 text-sm">潤飾</button>
            <button @click="$emit('delete', assignment)" class="delete-article-btn btn-danger py-2 px-4 text-sm">刪除</button>
        </template>
        <div id="quiz-timer-display" class="text-lg font-bold text-slate-700 bg-slate-100 border border-slate-200 px-5 py-2 rounded-lg tabular-nums shadow-sm">
            {{ formatTime(timerSeconds) }}
        </div>
    </div>
    </div>

    <!-- Main Content -->
    <div class="mt-8 grid grid-cols-1 lg:grid-cols-3 lg:gap-8 text-left">

      <!-- Article Content -->
      <div class="lg:col-span-2">
        <article>
            <div class="text-2xl font-bold mb-4 text-slate-800">{{ assignment.title }}</div>

            <!-- Tags -->
            <div class="flex flex-wrap gap-2 text-xs mb-6">
               <span v-if="assignment.tags?.format" class="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-medium">#{{ assignment.tags.format }}</span>
               <span v-if="assignment.tags?.contentType" class="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-medium">#{{ assignment.tags.contentType }}</span>
               <span v-if="assignment.tags?.difficulty" class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">#{{ assignment.tags.difficulty }}</span>
            </div>

            <!-- Tabs -->
            <div class="border-b-2 border-gray-200 mb-6 flex space-x-1">
                <button @click="switchTab('article')" :class="{'active': activeTab === 'article'}" class="content-tab tab-btn">文章</button>
                <button @click="switchTab('analysis')" :class="{'active': activeTab === 'analysis'}" :disabled="!canViewAnalysis" :title="analysisTabTitle" class="content-tab tab-btn">解析</button>
            </div>

            <!-- Article Body -->
            <div v-show="activeTab === 'article'" id="article-body" class="prose-custom content-panel" v-html="renderedArticleContent" @mouseup="handleSelection" @touchend="handleSelection"></div>

            <!-- Analysis Body -->
            <div v-show="activeTab === 'analysis'" id="analysis-body" class="prose-custom content-panel">
               <template v-if="hasAnalysis">
                   <div v-if="assignment.analysis?.mindmap">
                       <h2 class="text-2xl font-bold mb-4">心智圖</h2>
                       <div class="mermaid" :data-id="assignment.id + '-mindmap'" style="white-space: pre;">{{ assignment.analysis.mindmap }}</div>
                   </div>

                   <div v-if="assignment.analysis?.explanation">
                       <h2 class="text-2xl font-bold mt-8 mb-4">深度解析</h2>
                       <div v-html="renderedExplanation"></div>
                   </div>

                   <div v-if="assignment.analysis?.thinking_questions">
                       <h2 class="text-2xl font-bold mt-8 mb-4">延伸思考</h2>
                       <div v-html="markdownToHtml(assignment.analysis.thinking_questions)"></div>
                   </div>
               </template>
            </div>
        </article>
      </div>

      <!-- Quiz Panel -->
      <div class="lg:col-span-1 mt-8 lg:mt-0">
        <div class="lg:sticky lg:top-8">
          <div class="lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar p-1">
            <form @submit.prevent="submitTrial" id="quiz-form">
              <h2 class="text-2xl font-black py-4 mb-4 text-slate-800">閱讀試煉</h2>

              <!-- Passed Indicator -->
              <div v-if="isPassed" class="mb-4 p-4 bg-[#fdfaf2]/50 border border-amber-100/50 rounded-xl shadow-sm relative overflow-hidden">
                <div class="flex items-center gap-3 relative z-10">
                  <div class="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-lg">📝</div>
                  <div>
                    <h2 class="text-sm font-black text-slate-800">修業完成</h2>
                    <p class="text-slate-500 text-xs leading-none mt-1">
                      初次得分 <span class="font-black text-red-700">{{ firstScore }}</span>
                      <template v-if="subsequentScores.length > 0">
                        <span class="mx-2 text-slate-300">|</span>
                        後續: <span class="font-bold text-slate-600">{{ subsequentScores.join(', ') }}</span>
                      </template>
                      <span class="mx-2 text-slate-300">|</span>
                      <span class="text-teal-600 font-bold">墨寶已存，您可查閱深度解析。</span>
                    </p>
                  </div>
                </div>
              </div>

              <!-- History -->
              <div v-if="history.length > 0 && !isPassed" class="mb-6 p-5 bg-[#fdfbf7] border border-amber-100 rounded-2xl shadow-sm">
                  <h2 class="text-sm font-black text-amber-800 mb-3 flex items-center gap-2">
                    <span class="w-1 h-3 bg-amber-700 rounded-full"></span>
                    歷史挑戰記錄
                  </h2>
                  <ul class="space-y-2">
                      <li v-for="(rec, idx) in history" :key="idx" class="text-xs text-slate-500 flex justify-between items-center border-b border-dashed border-slate-100 pb-1">
                        <span>第 {{ idx + 1 }} 次挑戰</span>
                        <span class="font-bold text-slate-700">{{ rec.score }} 分 <span class="text-[10px] font-normal text-slate-400">({{ formatTime(rec.durationSeconds || 0) }})</span></span>
                      </li>
                  </ul>
              </div>

              <!-- Not Passed Warning & AI Help -->
              <div v-if="isCompleted && !isPassed" class="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg shadow-sm">
                  <h3 class="font-bold text-red-800 text-lg mb-1">【挑戰尚未成功！】</h3>
                  <p class="text-red-700 font-medium">您的最高得分為 {{ highestScore }} 分，尚未達到 60 分過關門檻，因此標記為「未完成」。</p>
                  <p class="text-red-600 text-sm mt-1 mb-3">請您重新閱讀文章資訊並再次挑戰，過關後才能查看深度解析喔！</p>
                  
                  <button @click="requestAiHelp" type="button" :disabled="aiHelpLoading" class="btn-primary py-2 px-4 text-sm font-bold flex items-center gap-2">
                     <span v-if="aiHelpLoading" class="loader-sm w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                     {{ aiHelpLoading ? 'AI 書僮思考中...' : '🆘 AI 求救' }}
                  </button>
                  
                  <div v-if="aiHelpFeedback" class="mt-3 p-4 bg-teal-50 border border-teal-200 rounded-lg text-left prose-custom">
                     <h3 class="font-bold text-teal-800 mb-2">📖 AI 書僮的引導</h3>
                     <div v-html="markdownToHtml(aiHelpFeedback)"></div>
                  </div>
              </div>

              <!-- Questions -->
              <div v-for="(q, index) in questions" :key="index" class="mb-10 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative group">
                    <p class="font-bold text-lg text-slate-800 flex gap-4 leading-snug">
                      <span class="text-amber-700/30 font-black italic text-2xl leading-none flex items-center gap-2">
                        {{ index + 1 }}
                        <svg v-if="isQuestionLocked(index)" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="text-teal-700 inline-block" viewBox="0 0 16 16">
                          <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                        </svg>
                      </span>
                      {{ q.questionText || q.question }}
                    </p>
                    <div class="mt-6 space-y-3">
                       <div v-for="(option, optIdx) in q.options" :key="optIdx">
                          <label 
                            class="flex items-center gap-4 p-4 rounded-xl border border-slate-100 transition-all group/label"
                            :class="[
                              isQuestionLocked(index) ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:bg-slate-50 hover:border-amber-200',
                              (isQuestionLocked(index) && optIdx === (q.correctAnswerIndex ?? q.correctAnswer)) ? 'bg-emerald-50 border-emerald-200 shadow-sm' : '',
                              (!isQuestionLocked(index) && selectedAnswers[index] === optIdx) ? 'border-amber-300 bg-amber-50/30' : ''
                            ]"
                          >
                            <input
                              type="radio"
                              :name="'question-' + index"
                              :value="optIdx"
                              v-model="selectedAnswers[index]"
                              class="w-5 h-5 accent-red-800"
                              :class="isQuestionLocked(index) ? 'cursor-not-allowed' : 'cursor-pointer'"
                              :disabled="isLockedByCooldown || isQuestionLocked(index)"
                            >
                            <span 
                              class="font-bold text-sm transition-colors"
                              :class="[
                                (isQuestionLocked(index) && optIdx === (q.correctAnswerIndex ?? q.correctAnswer)) ? 'text-emerald-700' : 'text-slate-600 group-hover/label:text-slate-900'
                              ]"
                            >{{ option }}</span>
                          </label>
                       </div>
                    </div>
              </div>

              <!-- Button Actions -->
              <div class="mt-8 space-y-3">
                <button v-if="highestScore < 100" type="submit" class="w-full btn-primary py-3 text-base font-bold btn-seal" :disabled="isLockedByCooldown" :class="{ 'opacity-50 cursor-not-allowed': isLockedByCooldown }">
                   {{ submitButtonText }}
                </button>
                <button v-if="isPassed" type="button" @click="isReviewing = true; showResults = true" class="w-full btn-secondary py-3 text-base font-bold">審閱課卷</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Results Modal -->
    <div v-if="showResults" class="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4" @click.self="showResults = false">
        <div class="card max-w-2xl w-full">
            <h2 class="text-2xl font-bold mb-2 text-center font-rounded" :class="isPassedReview ? 'text-amber-600' : 'text-red-600'">
                {{ isPassedReview ? '課業完成' : '挑戰未達標' }}
            </h2>
            <p class="text-5xl font-bold my-4 text-center" :class="displayScore >= 90 ? 'text-green-600' : displayScore >= 70 ? 'text-amber-600' : 'text-red-600'">{{ displayScore }}</p>
            <p class="font-bold mb-6 text-center" :class="isPassedReview ? 'text-amber-600' : 'text-red-600'">{{ scoreFeedback }}</p>

            <div class="text-left mb-6 max-h-[50vh] overflow-y-auto p-4 bg-gray-50 rounded-lg">
                <div v-for="(q, i) in questions" :key="'review-'+i" class="p-4 rounded-lg mb-3" :class="isAnswerCorrect(i) ? 'bg-green-50' : 'bg-red-50'">
                    <p class="font-semibold text-gray-800">第 {{ i + 1 }} 題: {{ q.questionText || q.question }}</p>
                    <p class="mt-2 text-sm">您的作答: <span class="font-medium">{{ selectedAnswers[i] !== null ? q.options[selectedAnswers[i]] : '未作答' }}</span></p>
                    <template v-if="displayScore >= 60">
                        <p class="mt-1 text-sm">正解: <span class="font-medium">{{ q.options[q.correctAnswerIndex ?? q.correctAnswer] }}</span></p>
                        <div class="mt-3 pt-3 border-t border-gray-200">
                            <p class="font-semibold text-red-800">【淺解】</p>
                            <p class="text-gray-600 text-sm mt-1">{{ q.explanation || '暫無淺解。' }}</p>
                        </div>
                    </template>
                    <template v-else>
                        <p class="mt-2 text-sm font-medium" :class="isAnswerCorrect(i) ? 'text-green-600' : 'text-red-600'">
                            {{ isAnswerCorrect(i) ? '✔️ 答對了！' : '❌ 答錯了，請再想想！' }}
                        </p>
                    </template>
                </div>
            </div>

            <button @click="showResults = false" class="w-full btn-secondary py-2 font-bold">關閉</button>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import { markdownToHtml, formatTime, escapeHtml } from '../../utils/helpers'
import { callAiHelp } from '../../services/api' // Assuming callAiHelp is exported from api.js or similar
import mermaid from 'mermaid'

const props = defineProps({
  assignment: { type: Object, required: true }
})

const emit = defineEmits(['back', 'submit', 'edit', 'delete'])
const authStore = useAuthStore()
const dataStore = useDataStore()

const isTeacher = computed(() => authStore.currentUser?.type === 'teacher')
const activeTab = ref('article')
const showResults = ref(false)
const isReviewing = ref(false)
const score = ref(0)
const questions = computed(() => props.assignment.questions || [])
const selectedAnswers = ref(Array(questions.value.length).fill(null))

const mermaidInitialized = ref(false)
const initializeMermaid = () => {
  if (mermaidInitialized.value) return;
  const elegantTheme = {
    fontFamily: "'GenWanNeoSCjk', 'Noto Sans TC', sans-serif",
    fontSize: '18px',
    background: 'transparent',
    mainBkg: '#a5b4c1', // Root - Soft Slate
    nodeBorder: '#4a5568', 
    lineColor: '#cbd5e1', // Lighter, thicker-looking lines
    nodeTextColor: '#1a202c',
    // Swapping and refining branch colors to match original screenshot 912
    cScale0: '#a5b4c1', // Root
    cScaleLabel0: '#1a202c',
    cScale1: '#a1b5a1', // ① Muted Green
    cScaleLabel1: '#1a202c',
    cScale2: '#c9c4b1', // ② Muted Beige
    cScaleLabel2: '#1a202c',
    cScale3: '#b1afc1', // ③ Muted Lavender-Blue (Bottom Right)
    cScaleLabel3: '#1a202c',
    cScale4: '#b1a5b1', // ④ Muted Plum-Purple (Bottom Left)
    cScaleLabel4: '#1a202c',
    cScale5: '#cbd5e1', 
    cScaleLabel5: '#1a202c',
  };
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: elegantTheme,
    securityLevel: 'loose',
    suppressErrors: true,
    logLevel: 'error',
    mindmap: {
      useMaxWidth: true,
      padding: 20
    }
  });
  mermaidInitialized.value = true;
}

// 3-Tier Mermaid Fallback Logic
const textToBase64 = (text) => {
  try {
    const utf8Bytes = new TextEncoder().encode(text);
    let binaryStr = '';
    for (let i = 0; i < utf8Bytes.length; i++) binaryStr += String.fromCharCode(utf8Bytes[i]);
    return btoa(binaryStr);
  } catch (e) { return btoa(unescape(encodeURIComponent(text))); }
}

const renderMermaidAsImage = (element, definition) => {
  const base64 = textToBase64(definition);
  const imageUrl = `https://mermaid.ink/svg/${base64}`;
  element.innerHTML = '<div class="text-center p-6 text-slate-400 text-sm">圖表載入中...</div>';
  const img = new Image();
  img.onload = () => {
    element.innerHTML = '';
    img.style.maxWidth = '100%'; img.style.height = 'auto'; img.alt = '圖表';
    element.appendChild(img);
    element.setAttribute('data-processed', 'true');
  };
  img.onerror = () => showMermaidFallback(element, '圖表渲染失敗', definition);
  img.src = imageUrl;
}

const showMermaidFallback = (element, reason, rawText) => {
  element.innerHTML = `<div class="my-4 rounded-lg border-2 border-slate-200 overflow-hidden"><div class="bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500 flex items-center gap-2">${reason}</div><pre class="p-4 text-sm text-slate-700 bg-white overflow-x-auto whitespace-pre-wrap" style="margin:0;">${escapeHtml(rawText)}</pre></div>`;
  element.setAttribute('data-processed', 'true');
}

const renderAllMermaid = async (container) => {
  if (!container) return;
  const elements = Array.from(container.querySelectorAll('.mermaid:not([data-processed="true"])'));
  if (elements.length === 0) return;

  // Cache raw text BEFORE any DOM mutation
  const rawTexts = elements.map(el => (el.textContent || el.innerText || '').trim());

  initializeMermaid();

  // Ensure DOM is settled, especially on mobile/tablets
  await new Promise(resolve => setTimeout(resolve, 50));
  
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    let definition = rawTexts[i]
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
      .replace(/```mermaid/g, '').replace(/```/g, '').trim();
    if (!definition) { showMermaidFallback(el, '圖表內容為空', ''); continue; }

    try {
      const uniqueId = `mermaid-svg-${Math.random().toString(36).substring(2, 9)}-${i}`;
      const { svg } = await mermaid.render(uniqueId, definition);
      el.innerHTML = svg;
      const svgEl = el.querySelector('svg');
      if (svgEl) {
        svgEl.style.maxWidth = '100%';
        svgEl.style.height = 'auto';
      }
      el.setAttribute('data-processed', 'true');
    } catch (err) {
      console.warn('[Mermaid] Client render failed, trying mermaid.ink...', err.message || err);
      renderMermaidAsImage(el, definition);
    }
  }
}

// Timer
const timerSeconds = ref(0)
let timerInterval = null
const startTimer = () => { if (!timerInterval) timerInterval = setInterval(() => timerSeconds.value++, 1000) }
const stopTimer = () => { if (timerInterval) { clearInterval(timerInterval); timerInterval = null } }

// Content Loading
const renderedArticleContent = ref('')
const LOCAL_STORAGE_KEY = computed(() => `highlights_${authStore.currentUser?.studentId || 'anon'}_${props.assignment.id}`)
const loadContent = () => {
  if (!props.assignment?.article) return
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY.value)
  renderedArticleContent.value = saved || markdownToHtml(props.assignment.article)
}

// Analysis Props
const hasAnalysis = computed(() => {
  const a = props.assignment.analysis;
  return a && (a.mindmap || a.explanation || a.thinking_questions);
})
const canViewAnalysis = computed(() => isPassed.value && hasAnalysis.value)
const renderedExplanation = computed(() => {
  const text = props.assignment.analysis?.explanation || '';
  return markdownToHtml(text);
})

// Submission State
const history = computed(() => {
  const sub = dataStore.allSubmissions.find(s => s.assignmentId === props.assignment.id && s.studentId === authStore.currentUser?.studentId);
  if (!sub) return [];
  return sub.attempts || [{ score: sub.score, answers: sub.answers, submittedAt: sub.submittedAt, durationSeconds: sub.durationSeconds }];
})
const firstScore = computed(() => history.value.length ? history.value[0].score : 0)
const subsequentScores = computed(() => history.value.length > 1 ? history.value.slice(1).map(h => h.score) : [])
const highestScore = computed(() => history.value.length ? Math.max(...history.value.map(h => h.score || 0)) : 0)
const isPassed = computed(() => highestScore.value >= 60)
const isCompleted = computed(() => history.value.length > 0)

// Cooldown
const cooldownRemaining = ref(0)
let cooldownTimer = null
const isLockedByCooldown = computed(() => cooldownRemaining.value > 0)
const setupCooldown = () => {
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownRemaining.value = 0
  if (isCompleted.value && !isPassed.value && history.value.length) {
    const last = history.value[history.value.length - 1];
    const ms = last.submittedAt?.toDate ? last.submittedAt.toDate().getTime() : new Date(last.submittedAt).getTime();
    const diff = Date.now() - ms;
    if (diff < 60000) {
      cooldownRemaining.value = Math.ceil((60000 - diff) / 1000);
      cooldownTimer = setInterval(() => {
        cooldownRemaining.value--;
        if (cooldownRemaining.value <= 0) clearInterval(cooldownTimer);
      }, 1000);
    }
  }
}

// AI Help
const aiHelpLoading = ref(false)
const aiHelpFeedback = ref('')
const requestAiHelp = async () => {
  aiHelpLoading.value = true;
  try {
    const lastAnswers = history.value[history.value.length-1]?.answers || [];
    // 同步改用 api.js 的 callAiHelp，但增加偵錯
    const feedback = await callAiHelp(props.assignment.article, props.assignment.questions, lastAnswers);
    aiHelpFeedback.value = feedback;
  } catch (e) { 
    console.error('[AI Help Error]', e);
    aiHelpFeedback.value = `AI 書僮暫時無法回應 (${e.message})，請檢查 API 金鑰設定或網路連線。`; 
  }
  finally { aiHelpLoading.value = false }
}

const submitButtonText = computed(() => {
  if (isPassed.value) {
    return highestScore.value < 100 ? `再次挑戰，追求滿分 (初次：${firstScore.value}${subsequentScores.value.length ? ' / 續: ' + subsequentScores.value.join(', ') : ''})` : '已臻滿分';
  }
  return isCompleted.value ? `再次挑戰 (初次：${firstScore.value}${subsequentScores.value.length ? ' / 續: ' + subsequentScores.value.join(', ') : ''})` : '繳交課卷';
})

// UI Handlers
const switchTab = (tab) => {
    if (tab === 'analysis' && !canViewAnalysis.value) {
        alert('夫子提點：誠心誦讀、細察文理，待閣下過關（閱歷滿 60）之後，此處詳解方能顯現。');
        return;
    }
    activeTab.value = tab;
}
const bestAttempt = computed(() => {
  if (!history.value.length) return null;
  return [...history.value].sort((a, b) => b.score - a.score)[0];
});

const isQuestionLocked = (qIdx) => {
  if (!bestAttempt.value) return false;
  const bestAnswers = bestAttempt.value.answers || [];
  const correctIdx = questions.value[qIdx].correctAnswerIndex ?? questions.value[qIdx].correctAnswer;
  return bestAnswers[qIdx] === correctIdx;
};

const isAnswerCorrect = (qIdx) => selectedAnswers.value[qIdx] === (questions.value[qIdx].correctAnswerIndex ?? questions.value[qIdx].correctAnswer)

const submitTrial = async () => {
  if (isLockedByCooldown.value) return;
  if (timerSeconds.value < 30) {
    alert('夫子見你閱讀速度異於常人！請多花點時間細細品味文章，思考後再作答。（至少 30 秒）');
    return;
  }
  if (selectedAnswers.value.includes(null)) {
    alert('請回答所有題目。');
    return;
  }
  stopTimer();
  let correct = 0;
  questions.value.forEach((q, i) => { if (selectedAnswers.value[i] === (q.correctAnswerIndex ?? q.correctAnswer)) correct++; });
  score.value = Math.round((correct / questions.value.length) * 100);
  isReviewing.value = false;
  showResults.value = true;
  emit('submit', { 
    assignmentId: props.assignment.id, 
    score: score.value, 
    answers: [...selectedAnswers.value], 
    durationSeconds: timerSeconds.value, 
    timestamp: new Date(),
    attempts: [...history.value, { score: score.value, answers: [...selectedAnswers.value], submittedAt: new Date(), durationSeconds: timerSeconds.value }]
  });
}

// Highlights Logic
const showHighlightToolbar = ref(false)
const toolbarPosition = ref({ top: 0, left: 0 })
const toolbarRef = ref(null)
let lastRange = null

const handleSelection = () => {
  setTimeout(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      if (!showHighlightToolbar.value) return;
      const node = sel.anchorNode;
      const hNode = node?.nodeType === 1 ? node.closest('.highlight') : node?.parentNode?.closest('.highlight');
      if (hNode) {
        const r = hNode.getBoundingClientRect();
        toolbarPosition.value = { 
          left: r.left + (r.width / 2) - 80, // Approximate half width of toolbar (160/2)
          top: r.top - 55 // Above the node
        };
        showHighlightToolbar.value = true;
      } else { showHighlightToolbar.value = false; }
      return;
    }
    lastRange = sel.getRangeAt(0);
    const r = lastRange.getBoundingClientRect();
    toolbarPosition.value = { 
        left: r.left + (r.width / 2) - 80, 
        top: r.top - 55 
    };
    showHighlightToolbar.value = true;
  }, 50);
}

const applyHighlight = (color) => {
  if (!lastRange || lastRange.collapsed) return;
  const span = document.createElement('span');
  span.className = 'highlight'; span.style.backgroundColor = color;
  span.appendChild(lastRange.extractContents());
  lastRange.insertNode(span);
  window.getSelection().removeAllRanges();
  showHighlightToolbar.value = false;
  saveHighlights();
}

const removeHighlight = () => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const container = document.getElementById('article-body');
  const unwrap = (el) => { const p = el.parentNode; while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el); };
  if (!range.collapsed) { container.querySelectorAll('.highlight').forEach(h => { if (range.intersectsNode(h)) unwrap(h) }) }
  else { const h = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer.closest('.highlight') : range.commonAncestorContainer.parentNode.closest('.highlight'); if (h) unwrap(h) }
  container.normalize(); sel.removeAllRanges(); showHighlightToolbar.value = false; saveHighlights();
}

const saveHighlights = () => {
  const html = document.getElementById('article-body')?.innerHTML;
  if (html) { localStorage.setItem(LOCAL_STORAGE_KEY.value, html); renderedArticleContent.value = html; }
  // On mobile/tablets, force a re-render after saving highlights
  nextTick(() => renderAllMermaid(document.getElementById('article-body')));
}

onMounted(() => {
  watch(() => props.assignment, () => {
    loadContent(); setupCooldown(); activeTab.value = 'article';
    const best = [...history.value].sort((a,b) => b.score - a.score)[0];
    selectedAnswers.value = best ? [...best.answers] : Array(questions.value.length).fill(null);
    
    if (isPassed.value) {
        stopTimer();
        const firstAttempt = history.value[0];
        timerSeconds.value = firstAttempt?.durationSeconds || 0;
    } else {
        timerSeconds.value = 0;
        startTimer();
    }
  }, { immediate: true });
});

watch(activeTab, (t) => { 
  const containerId = t === 'analysis' ? 'analysis-body' : 'article-body';
  nextTick(() => {
    setTimeout(() => renderAllMermaid(document.getElementById(containerId)), 100);
  });
});

watch(renderedArticleContent, () => {
  nextTick(() => {
    setTimeout(() => renderAllMermaid(document.getElementById('article-body')), 100);
  });
});

const displayScore = computed(() => {
  if (isReviewing.value) {
      return highestScore.value;
  }
  return score.value;
})

const isPassedReview = computed(() => displayScore.value >= 60)

const scoreFeedback = computed(() => {
  const s = displayScore.value;
  return s >= 60 ? (s >= 90 ? '評價：甲上！' : s >= 70 ? '評價：甲！' : '評價：乙。') : '尚未達到過關基準 (60分)，請再次挑戰！'
})

onUnmounted(() => { stopTimer(); if (cooldownTimer) clearInterval(cooldownTimer) })
</script>

<style scoped>
.highlight { cursor: pointer; border-radius: 3px; padding: 2px 1px; }
.modal-backdrop { background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(2px); }
.content-tab:disabled { cursor: not-allowed; color: #9ca3af; }

:deep(.prose-custom p) {
    margin-bottom: 1.75rem;
    line-height: 2;
    letter-spacing: 0.01em;
    color: #1a202c;
}

/* --- Mermaid Chart Theming (Restored from Backup) --- */
:deep(.mermaid svg) {
    max-width: 100% !important;
    height: auto !important;
    display: block;
    margin: 0 auto;
    overflow: visible !important;
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

:deep(.mermaid svg text) {
    font-family: 'GenWanNeoSCjk', 'Noto Sans TC', sans-serif !important;
    fill: #374151 !important; /* Ink Gray-700 */
}

/* --- Flowchart Theming --- */
:deep(.mermaid .node rect),
:deep(.mermaid .node circle),
:deep(.mermaid .node polygon),
:deep(.mermaid .node .basic) {
    fill: #fdfbf6 !important; /* Rice Paper White */
    stroke: #576c73 !important; /* Scholar Gray */
    stroke-width: 2px !important;
}

:deep(.mermaid .node.default .label) {
    color: #374151 !important;
}

:deep(.mermaid .edge-path),
:deep(.mermaid .arrowhead-path) {
    stroke: #576c73 !important; /* Scholar Gray */
}

/* --- Sequence Diagram Theming --- */
:deep(.mermaid .actor),
:deep(.mermaid .participant) {
    fill: #fdfbf6 !important;
    stroke: #576c73 !important;
}

:deep(.mermaid .sequence-arrow),
:deep(.mermaid .messageLine0),
:deep(.mermaid .messageLine1) {
    stroke: #374151 !important;
}

/* --- Gantt Chart Theming --- */
:deep(.mermaid .gantt .section) {
    fill: rgba(74, 74, 74, 0.1) !important;
    stroke: none !important;
}

:deep(.mermaid .gantt .section .text) {
    fill: #333 !important;
    font-weight: 600;
}

:deep(.mermaid .gantt .task),
:deep(.mermaid .gantt .task-alt) {
    stroke-width: 2 !important;
}

:deep(.mermaid .gantt .task.active) {
    fill: #576c73 !important;
    stroke: #435459 !important;
}

:deep(.mermaid .gantt .task.done) {
    fill: #8C384D !important;
    stroke: #6E2C3C !important;
}

:deep(.mermaid .gantt .task.default) {
    fill: #B58423 !important;
    stroke: #9A6E1C !important;
}

:deep(.mermaid .gantt .task-text) {
    fill: white !important;
    font-weight: 500;
}

:deep(.mermaid .grid .tick) {
    stroke: #d1d5db !important;
    stroke-width: 1 !important;
}

:deep(.mermaid .grid-line) {
    stroke: #e5e7eb !important;
}

:deep(.mermaid .today-marker) {
    stroke: #c0392b !important;
    stroke-width: 3px !important;
}

/* --- XYChart Theming --- */
:deep(.mermaid svg .chart-title text) {
    font-weight: 700;
}

:deep(.mermaid svg .axis-line path),
:deep(.mermaid svg .ticks path) {
    stroke: #9ca3af !important;
}

:deep(.mermaid .node rect),
:deep(.mermaid .node circle),
:deep(.mermaid .node ellipse),
:deep(.mermaid .node polygon),
:deep(.mermaid .mindmap-node rect),
:deep(.mermaid .mindmap-node circle) {
    rx: 12 !important;
    ry: 12 !important;
    stroke-width: 1.5px !important;
}

:deep(.mermaid svg .bar-plot-0 rect) {
    fill: #576c73 !important;
}

:deep(.mermaid svg .bar-plot-1 rect) {
    fill: #c0392b !important;
}

:deep(.mermaid) {
    margin: 2rem auto;
    text-align: center;
    overflow-x: auto !important;
    overflow-y: visible !important;
    -webkit-overflow-scrolling: touch;
}

/* --- Table Styling for v-html --- */
:deep(table) {
    width: 100%;
    margin: 2rem 0;
    border-collapse: separate;
    border-spacing: 0;
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}

:deep(th) {
    background-color: #f8fafc;
    color: #475569;
    font-size: 0.75rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 1rem 1.25rem;
    border-bottom: 2px solid #e2e8f0;
    text-align: left;
}

:deep(td) {
    background-color: white;
    color: #1e293b;
    font-size: 0.95rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #f1f5f9;
    line-height: 1.6;
}

:deep(tr:last-child td) {
    border-bottom: none;
}

:deep(tr:nth-child(even) td) {
    background-color: #f9fafb;
}

:deep(tr:hover td) {
    background-color: #f1f5f9;
}

:deep(.mermaid svg) {
    max-width: 100% !important;
    height: auto !important;
    overflow: hidden;
}

#analysis-body {
    overflow-x: hidden !important;
}

.scrollbar-thin::-webkit-scrollbar { height: 4px; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
</style>
