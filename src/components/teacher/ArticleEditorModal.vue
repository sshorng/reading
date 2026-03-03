<template>
  <div v-if="isVisible" class="fixed inset-0 z-[150] flex items-center justify-center p-2 md:p-6 overflow-hidden">
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('cancel')"></div>
    <div class="relative z-10 bg-white rounded-3xl w-full max-w-[1600px] h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up border border-gray-100">
      <!-- Header -->
      <div class="bg-white px-8 py-5 border-b flex justify-between items-center shrink-0">
        <div class="flex items-center gap-4">
          <div class="bg-red-50 p-2 rounded-xl">
            <svg class="w-6 h-6 text-red-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </div>
          <div>
            <h3 class="text-xl font-black text-gray-800 flex items-center gap-2">
              修訂篇章：{{ form.title }}
            </h3>
            <div class="flex items-center gap-4 mt-1 text-xs text-gray-400 font-medium italic">
              <span>雙欄對照模式 — 左側定卷，右側校題</span>
              <span class="text-red-800/40">|</span>
              <span>發布學堂：{{ props.articleData?.className || '預設學堂' }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <button @click="$emit('cancel')" class="p-2 text-gray-400 hover:text-red-800 transition-colors bg-slate-50 rounded-full hover:bg-red-50">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <!-- Body: Split View -->
      <div class="flex-grow flex overflow-hidden bg-slate-50/50">
        <!-- Left Pane: Article & Analysis (Width: 40%) -->
        <div class="w-full xl:w-[40%] flex flex-col border-r border-slate-200 bg-white shadow-sm overflow-hidden pointer-events-auto">
          <div class="flex-grow overflow-y-auto px-8 py-6 custom-scrollbar space-y-8">
            <!-- Article Content Section -->
            <section class="space-y-4">
              <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                <h4 class="font-black text-slate-800 text-sm flex items-center gap-2">
                  <span class="w-1.5 h-4 bg-red-800 rounded-full"></span>
                  文章正文與屬性
                </h4>
                <div class="flex gap-2">
                  <button @click="openAIRefine('article')" class="btn-secondary py-1 px-3 text-[10px] font-black flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    AI 潤飾原文
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4">
                <div class="space-y-1">
                  <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">篇章標題</label>
                  <input v-model="form.title" type="text" class="input-styled w-full font-bold !bg-slate-50/50 focus:!bg-white">
                </div>
                
                <div class="space-y-1">
                  <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">正文</label>
                  <textarea v-model="form.article" rows="12" class="input-styled w-full text-sm leading-relaxed custom-scrollbar !bg-slate-50/50 focus:!bg-white"></textarea>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4 pt-2">
                <div class="space-y-1.5">
                  <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">屬性配置 (形式 / 架構 / 難度)</label>
                  <div class="flex gap-1.5">
                    <select v-model="form.tags.format" class="form-element-ink py-1.5 px-3 text-xs flex-1">
                      <option v-for="opt in ['純文', '圖表', '圖文']" :key="opt" :value="opt">{{ opt }}</option>
                    </select>
                    <select v-model="form.tags.contentType" class="form-element-ink py-1.5 px-3 text-xs flex-1">
                      <option v-for="opt in ['記敘', '抒情', '說明', '議論', '應用']" :key="opt" :value="opt">{{ opt }}</option>
                    </select>
                    <select v-model="form.tags.difficulty" class="form-element-ink py-1.5 px-3 text-xs flex-1">
                      <option v-for="opt in ['簡單', '基礎', '普通', '進階', '困難']" :key="opt" :value="opt">{{ opt }}</option>
                    </select>
                  </div>
                </div>
                <div class="space-y-1.5">
                  <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">挑戰截止日</label>
                  <input type="date" v-model="form.deadlineStr" class="input-styled w-full py-1.5 text-xs font-bold !bg-slate-50/50">
                </div>
              </div>

              <div class="flex items-center gap-3 p-3 bg-red-50/30 rounded-xl border border-red-100 border-dashed">
                <input type="checkbox" id="edit-public" v-model="form.isPublic" class="w-5 h-5 text-red-800 rounded">
                <label for="edit-public" class="text-xs font-bold text-red-800/70 cursor-pointer select-none">發布給對應學堂學子</label>
              </div>
            </section>

            <!-- Analysis Section (More Compact) -->
            <section class="space-y-6 pt-6 border-t border-slate-100">
              <h4 class="font-black text-slate-800 text-sm flex items-center gap-2">
                <span class="w-1.5 h-4 bg-red-800 rounded-full"></span>
                深度解析與導引
              </h4>

              <div class="grid grid-cols-1 gap-5">
                <div class="space-y-1">
                  <div class="flex justify-between items-center px-1">
                    <label class="text-[10px] font-black text-slate-400 uppercase">賞析文字</label>
                    <div class="flex gap-2">
                      <button @click="handleRegenerateSingle('explanation')" class="text-[10px] text-red-800/60 hover:text-red-800 font-bold">重新生成</button>
                    </div>
                  </div>
                  <textarea v-model="form.analysis.explanation" rows="3" class="input-styled w-full text-xs leading-relaxed !bg-slate-50/50"></textarea>
                </div>

                <div class="space-y-1">
                  <div class="flex justify-between items-center px-1">
                    <label class="text-[10px] font-black text-slate-400 uppercase">思考導航</label>
                    <div class="flex gap-2">
                      <button @click="handleRegenerateSingle('thinking_questions')" class="text-[10px] text-red-800/60 hover:text-red-800 font-bold">重新生成</button>
                    </div>
                  </div>
                  <textarea v-model="form.analysis.thinking_questions" rows="2" class="input-styled w-full text-xs !bg-slate-50/50"></textarea>
                </div>

                <div class="space-y-1">
                  <div class="flex justify-between items-center px-1">
                    <label class="text-[10px] font-black text-slate-400 uppercase font-mono">Mermaid 結構語法</label>
                    <button @click="handleRegenerateSingle('mindmap')" class="text-[10px] text-teal-800/60 hover:text-teal-800 font-bold">重新生成</button>
                  </div>
                  <textarea v-model="form.analysis.mindmap" rows="4" class="input-styled w-full text-[10px] font-mono bg-slate-900 text-teal-400 custom-scrollbar"></textarea>
                </div>
              </div>
            </section>
          </div>
        </div>

        <!-- Right Pane: Questions (Width: 60%) -->
        <div class="w-full xl:w-[60%] flex flex-col overflow-hidden pointer-events-auto">
          <!-- Toolbar -->
          <div class="px-8 py-4 bg-white/50 border-b border-slate-200 flex justify-between items-center shrink-0">
             <h4 class="font-black text-slate-800 text-sm flex items-center gap-2">
              <span class="w-1.5 h-4 bg-amber-700 rounded-full"></span>
              試卷題目細校 (共 {{ form.questions.length }} 題)
            </h4>
            <div class="flex gap-3">
              <button @click="handleRegenerateQuestions(false)" :disabled="loadingQuestions" class="btn-primary py-1.5 px-4 text-xs font-black flex items-center gap-2 shadow-md">
                <svg :class="{'animate-spin': loadingQuestions}" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                重新設計全卷
              </button>
            </div>
          </div>

          <!-- Question List -->
          <div class="flex-grow overflow-y-auto px-8 py-8 custom-scrollbar relative">
            <div v-if="loadingQuestions" class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white/80 backdrop-blur-sm animate-fade-in">
              <div class="w-12 h-12 border-4 border-red-800/20 border-t-red-800 rounded-full animate-spin"></div>
              <p class="text-red-950 font-black tracking-widest">{{ loadingQuestionsLabel }}</p>
            </div>

            <div class="space-y-6 max-w-4xl mx-auto">
              <div v-for="(q, idx) in form.questions" :key="idx" 
                   class="group p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-red-200 transition-all duration-300 relative overflow-hidden flex flex-col"
                   :class="{'opacity-75 grayscale-[0.3]': regeneratingIndices.has(idx)}">
                
                <!-- Individual Loading State -->
                <div v-if="regeneratingIndices.has(idx)" class="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex items-center justify-center animate-fade-in">
                   <div class="flex flex-col items-center gap-2">
                      <div class="w-6 h-6 border-3 border-red-800/10 border-t-red-800 rounded-full animate-spin"></div>
                      <span class="text-[10px] font-black text-red-800">夫子稍待，AI 正在起草此題...</span>
                   </div>
                </div>

                <div class="flex justify-between items-center mb-5 shrink-0">
                  <div class="flex items-center gap-4">
                    <span class="w-9 h-9 flex items-center justify-center bg-slate-900 text-white rounded-xl text-sm font-black shadow-lg">#{{ idx + 1 }}</span>
                    <div class="flex flex-col">
                      <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">PISA 層次</span>
                      <span class="text-xs font-bold text-slate-700">{{ ["擷取與檢索", "統整與解釋", "統整與解釋", "省思與評鑑", "省思與評鑑"][idx] }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-4">
                    <button @click="handleRegenerateQuestions(true, idx)" :disabled="regeneratingIndices.has(idx)" class="text-[10px] bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-600 hover:text-white font-black transition-all">重新出此題</button>
                    <div class="flex items-center gap-2 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-100">
                      <span class="text-[10px] font-black text-teal-800">正確答案：</span>
                      <select v-model="q.correctAnswerIndex" class="bg-transparent text-sm font-black text-teal-800 p-0 border-none focus:ring-0 cursor-pointer">
                        <option v-for="optI in [0,1,2,3]" :key="optI" :value="optI">{{ String.fromCharCode(65+optI) }}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div class="space-y-4">
                  <div class="space-y-1">
                    <label class="text-[10px] font-black text-slate-400 ml-1">題目文字</label>
                    <textarea v-model="q.questionText" class="input-styled w-full text-base font-bold bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white transition-all min-h-[60px]" rows="2"></textarea>
                  </div>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                     <div v-for="(opt, oIdx) in q.options" :key="oIdx" class="flex items-center gap-2 group/opt p-1">
                        <span class="w-8 h-8 shrink-0 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-400 group-hover/opt:border-red-800 group-hover/opt:text-red-800 transition-colors">{{ String.fromCharCode(65+oIdx) }}</span>
                        <input v-model="q.options[oIdx]" class="flex-grow text-sm py-2 px-3 border-transparent bg-slate-50 rounded-xl hover:border-slate-200 focus:bg-white transition-all shadow-inner">
                     </div>
                  </div>

                  <div class="pt-4 mt-2 border-t border-dashed border-slate-200">
                     <label class="text-[10px] font-black text-slate-400 ml-1 mb-2 block uppercase tracking-tighter">解題錦囊 (局部解析)</label>
                     <textarea v-model="q.explanation" rows="2" class="input-styled w-full text-xs leading-relaxed italic !bg-slate-50/50 border-transparent"></textarea>
                  </div>
                </div>
              </div>

              <div v-if="form.questions.length === 0" class="flex flex-col items-center justify-center py-20 text-slate-300 animate-fade-in">
                 <svg class="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                 <p class="text-lg font-medium italic">此卷尚無題目。請點擊上方按鈕，邀 AI 書僮研墨出題。</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="bg-white px-8 py-5 border-t flex justify-between items-center shrink-0">
        <div class="flex items-center gap-2 text-xs text-slate-400">
           <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           <span>所有變更將在按下「核可」後寫入雲端書庫。</span>
        </div>
        <div class="flex gap-4">
          <button @click="$emit('cancel')" class="btn-secondary px-8 py-3 font-bold text-sm">暫不存檔</button>
          <button @click="handleSave" :disabled="saving" class="btn-primary py-3 px-16 font-black shadow-xl min-w-[240px] flex items-center justify-center gap-3 active:scale-95 transition-all">
            <span v-if="saving" class="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ saving ? '正在刻錄雲端...' : '核可並發布此卷' }}
          </button>
        </div>
      </div>
    </div>

    <!-- AI Refine Input Modal (Unchanged Base Logic, but polished styles) -->
    <div v-if="showAiRefineModal" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-slate-900/80 backdrop-blur-md" @click="showAiRefineModal = false"></div>
      <div class="relative z-10 bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-red-100 flex flex-col">
         <div class="bg-red-800 px-6 py-5 flex justify-between items-center shrink-0 shadow-lg">
            <h4 class="text-white font-black flex items-center gap-2" style="color: white !important;">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              AI 智能編修：{{ refineLabel }}
            </h4>
            <button @click="showAiRefineModal = false" class="text-red-200 hover:text-white transition-colors">
               <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
         </div>
         <div class="p-6 space-y-5">
            <div class="p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50">
               <p class="text-xs text-amber-800 leading-relaxed font-bold italic">
                 「夫子，請告知書僮您對內容的修訂原委，書僮定當竭力達成。」
               </p>
            </div>
            <div class="space-y-1">
               <label class="text-[10px] font-black text-gray-400 ml-1 uppercase tracking-widest">編修聖旨</label>
               <textarea v-model="aiRefinePrompt" rows="5" class="input-styled w-full text-sm leading-relaxed" placeholder="例如：將語句修飾得更為古雅優美..."></textarea>
            </div>
         </div>
         <div class="px-6 py-5 bg-slate-50 border-t flex gap-4 shrink-0">
            <button @click="showAiRefineModal = false" class="btn-secondary flex-1 py-3 text-sm font-bold">先等等</button>
            <button @click="handleAIRefine" :disabled="refiningAI" class="btn-primary flex-[2] py-3 text-sm font-black shadow-red-200 shadow-lg flex justify-center items-center gap-2">
              <span v-if="refiningAI" class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
              {{ refiningAI ? '書僮運筆研墨中...' : '確認編修' }}
            </button>
         </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, reactive, onMounted } from 'vue'
import { doc, updateDoc, Timestamp, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/init'
import { useAuthStore } from '../../stores/auth'

const props = defineProps({
  isVisible: Boolean,
  articleData: Object
})

const emit = defineEmits(['save', 'cancel'])

const authStore = useAuthStore()
const saving = ref(false)
const form = ref({
  title: '',
  article: '',
  questions: [],
  tags: { format: '純文', contentType: '記敘', difficulty: '普通' },
  analysis: { explanation: '', mindmap: '', thinking_questions: '' },
  isPublic: false,
  deadlineStr: ''
})

// Initialize local form whenever data changes
watch(() => props.articleData, (newData) => {
  if (newData) {
    const clone = JSON.parse(JSON.stringify(newData))
    if (!clone.analysis) clone.analysis = { explanation: '', mindmap: '', thinking_questions: '' }
    if (!clone.tags) clone.tags = { format: '純文', contentType: '記敘', difficulty: '普通' }
    
    let dStr = ''
    if (clone.deadline) {
      const d = clone.deadline.toDate ? clone.deadline.toDate() : new Date(clone.deadline)
      if (!isNaN(d.getTime())) {
        dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
    }
    clone.deadlineStr = dStr
    form.value = clone
  }
}, { immediate: true })

const handleSave = async () => {
  saving.value = true
  try {
    const { deadlineStr, id, ...payload } = form.value
    if (deadlineStr) {
      payload.deadline = Timestamp.fromDate(new Date(deadlineStr + "T23:59:59"))
    } else {
      payload.deadline = null
    }
    
    await updateDoc(doc(db, 'assignments', id), payload)
    emit('save')
  } catch (err) {
    console.error('Save Error:', err)
    alert('存檔失敗：' + err.message)
  } finally {
    saving.value = false
  }
}

// AI Logic
const loadingQuestions = ref(false)
const loadingQuestionsLabel = ref('')
const regeneratingIndices = ref(new Set())

const handleRegenerateQuestions = async (isSingle, index = null) => {
  if (!form.value.article) return alert('無原文，無法出題')
  
  if (isSingle) {
    regeneratingIndices.value.add(index)
  } else {
    loadingQuestions.value = true
    loadingQuestionsLabel.value = '正在重新設計整卷試煉...'
  }
  
  try {
    const pisaLevels = ["擷取與檢索", "統整與解釋", "統整與解釋", "省思與評鑑", "省思與評鑑"]
    const prompt = `你是一位資深夫子，根據以下文稿：\n"""${form.value.article}"""\n${isSingle ? `請重新設計 1 道符合 PISA「${pisaLevels[index]}」層次的單選題。` : '請設計 5 道 PISA 三層次單選題。'}\n選項位置隨機。回傳 JSON。`
    
    const singleSchema = { type: "OBJECT", properties: { questionText: { type: "STRING" }, options: { type: "ARRAY", items: { type: "STRING" } }, correctAnswerIndex: { type: "NUMBER" }, explanation: { type: "STRING" } }, required: ["questionText", "options", "correctAnswerIndex", "explanation"] }
    const schema = isSingle 
      ? { type: "OBJECT", properties: { question: singleSchema }, required: ["question"] }
      : { type: "OBJECT", properties: { questions: { type: "ARRAY", items: singleSchema } }, required: ["questions"] }

    const { callGenerativeAI } = await import('../../services/ai')
    const resStr = await callGenerativeAI(prompt, null, schema, 'teacher')
    const res = JSON.parse(resStr)

    if (isSingle) {
      form.value.questions[index] = res.question
    } else {
      form.value.questions = res.questions
    }
  } catch (err) {
    alert('AI 出題失敗：' + err.message)
  } finally {
    if (isSingle) {
      regeneratingIndices.value.delete(index)
    } else {
      loadingQuestions.value = false
    }
  }
}

const aiRefineTarget = ref(null)
const showAiRefineModal = ref(false)
const aiRefinePrompt = ref('')
const refiningAI = ref(false)

const refineLabels = { article: '原文正文', explanation: '深度賞析', mindmap: '心智圖樣式', thinking_questions: '思考引導' }
const refineLabel = computed(() => refineLabels[aiRefineTarget.value] || '')

const openAIRefine = (target) => {
  aiRefineTarget.value = target
  aiRefinePrompt.value = ''
  showAiRefineModal.value = true
}

const handleAIRefine = async () => {
  if (!aiRefinePrompt.value.trim()) return
  refiningAI.value = true
  try {
    const { callGenerativeAI, generateSingleInfo } = await import('../../services/ai')
    
    if (aiRefineTarget.value === 'article') {
      const prompt = `你是一位專業且細心的中文文本編輯。請根據以下指令潤飾提供的文章，並嚴格遵守段落排版規則：在每一個「自然段落」的開頭，加上兩個全形空格 \"　　\" 作為縮排。段落之間空一行。僅輸出潤飾後的文稿，不要有任何解析或廢話。\n\n指令：${aiRefinePrompt.value}\n原文：\n${form.value.article}`
      const res = await callGenerativeAI(prompt)
      form.value.article = res
    } else {
      const original = form.value.analysis[aiRefineTarget.value]
      const res = await generateSingleInfo(form.value.article, aiRefineTarget.value, 'refine', original, aiRefinePrompt.value)
      form.value.analysis[aiRefineTarget.value] = res
    }
    showAiRefineModal.value = false
  } catch (err) {
    alert('AI 潤飾失敗：' + err.message)
  } finally {
    refiningAI.value = false
  }
}

const handleRegenerateSingle = async (target) => {
  if (!form.value.article) return
  try {
    const { generateSingleInfo } = await import('../../services/ai')
    const res = await generateSingleInfo(form.value.article, target, 'regenerate')
    form.value.analysis[target] = res
  } catch (err) {
    alert('重新生成失敗：' + err.message)
  }
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
</style>
