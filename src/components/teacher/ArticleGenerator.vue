<template>
  <div class="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100 flex flex-col max-h-[95vh] max-w-7xl mx-auto w-full animate-fade-in relative z-10">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <h3 class="text-2xl font-bold text-gray-800 font-rounded flex items-center gap-2">
        <span class="w-2 h-8 bg-red-800 rounded-full"></span>
        新撰篇章與試煉
      </h3>
      <button @click="$emit('close')" class="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Mode Selector -->
    <div class="flex border-b-2 border-gray-100 mb-6 font-bold text-sm">
      <button 
        @click="mode = 'ai'" 
        class="pb-3 px-6 transition-all"
        :class="mode === 'ai' ? 'border-b-4 border-red-800 text-red-800' : 'text-gray-400 hover:text-gray-600'"
      >AI 依題起草</button>
      <button 
        @click="mode = 'paste'" 
        class="pb-3 px-6 transition-all"
        :class="mode === 'paste' ? 'border-b-4 border-red-800 text-red-800' : 'text-gray-400 hover:text-gray-600'"
      >貼入現成文章</button>
    </div>

    <div class="flex-grow overflow-y-auto custom-scrollbar space-y-6 pr-2">
      <!-- AI Generation Options -->
      <section v-if="mode === 'ai'" class="space-y-4 animate-fade-in">
        <div class="space-y-1">
          <div class="flex justify-between items-end mb-1">
            <label class="text-sm font-bold text-gray-600">命題與寫作架構 (Prompt)</label>
            <div class="flex items-center gap-2">
              <button @click="topic = ''" type="button" v-if="topic && topic.trim().length > 0" class="btn-secondary py-1.5 px-3 text-[10px] font-black flex items-center gap-1 hover:bg-slate-100 transition-colors shadow-sm">
                <svg class="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                清空
              </button>
              <button @click="handleGenerateTopicIdea" type="button" :disabled="generatingTopicIdea" class="btn-secondary py-1.5 px-3 text-[10px] font-black flex items-center gap-1 shadow-sm hover:shadow">
                <span v-if="generatingTopicIdea" class="loader-sm w-3 h-3 border-2 border-red-800/30 border-t-red-800 rounded-full animate-spin"></span>
                <svg v-else class="w-3 h-3 text-red-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                {{ generatingTopicIdea ? '書僮激腦中...' : '✨ AI 靈感發想' }}
              </button>
            </div>
          </div>
          <textarea v-model="topic" rows="5" class="input-styled w-full text-sm leading-relaxed custom-scrollbar" placeholder="在此輸入寫作指引（例如主題、語氣、段落結構...），或點擊上方「✨ AI 靈感」讓書僮代擬..."></textarea>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="space-y-2">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest block">文章形式</label>
            <select v-model="tags.format" class="input-styled w-full text-base font-bold">
              <option value="">AI 自動判斷</option>
              <option v-for="opt in ['純文', '圖表', '圖文']" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest block">內容架構</label>
            <select v-model="tags.contentType" class="input-styled w-full text-base font-bold">
              <option value="">AI 自動判斷</option>
              <option v-for="opt in ['記敘', '抒情', '說明', '議論', '應用']" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest block">難度門檻</label>
            <select v-model="tags.difficulty" class="input-styled w-full text-base font-bold">
              <option value="">AI 自動判斷</option>
              <option v-for="opt in ['簡單', '基礎', '普通', '進階', '困難']" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Paste Options -->
      <section v-else class="space-y-4 animate-fade-in">
        <div class="flex gap-4 items-end">
          <div class="flex-grow space-y-2">
            <label class="text-sm font-bold text-gray-600">篇章標題</label>
            <input v-model="pastedTitle" type="text" class="input-styled w-full" placeholder="請輸入文章標題">
          </div>
          <button @click="handleCleanupText" :disabled="loading" class="btn-secondary py-2 px-4 text-xs font-bold whitespace-nowrap mb-1">
            整理文本
          </button>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-bold text-gray-600">正文內容</label>
          <textarea v-model="pastedContent" rows="12" class="input-styled w-full text-sm leading-relaxed" placeholder="請在此貼上文章內容..."></textarea>
        </div>
      </section>

      <!-- Global Settings -->
      <div class="pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-2">
          <label class="text-sm font-bold text-gray-600">挑戰截止限期 (選填)</label>
          <input v-model="deadline" type="date" class="input-styled w-full">
        </div>
        <div class="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
           <input type="checkbox" v-model="isPublic" id="public-check" class="w-5 h-5 text-red-800 rounded">
           <label for="public-check" class="text-sm font-bold text-slate-700 cursor-pointer select-none">立即發佈為公開篇章</label>
        </div>
      </div>

      <!-- Generated Preview / Edit Area -->
       <section v-if="generatedResult" class="mt-8 pt-8 border-t-2 border-red-800/20 space-y-6 animate-slide-up">
         <h4 class="font-black text-red-800 flex items-center gap-2">
           <span class="bg-red-800 text-white text-[10px] px-2 py-0.5 rounded">Preview</span>
           初稿預覽與校訂
         </h4>
         
         <div class="space-y-5 bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <div class="space-y-2">
               <label class="text-xs font-black text-slate-400 uppercase tracking-widest">校訂標題</label>
               <input v-model="generatedResult.title" type="text" class="input-styled w-full bg-white font-black text-lg">
            </div>
            <div class="space-y-2">
               <div class="flex justify-between items-center mb-1">
                 <label class="text-xs font-black text-slate-400 uppercase tracking-widest">文章正文</label>
                 <button @click="openAIRefine" class="btn-secondary py-1 px-3 text-[10px] font-black flex items-center gap-1 shadow-sm hover:shadow">
                   <svg class="w-3 h-3 text-red-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                   ✨ AI 局部編修
                 </button>
               </div>
               <textarea v-model="generatedResult.article" rows="10" class="input-styled w-full text-base bg-white leading-relaxed" placeholder="生成的內容將顯示在此..."></textarea>
            </div>
         </div>
       </section>
    </div>

    <!-- Footer Actions -->
    <div class="mt-6 pt-6 border-t border-gray-100 flex gap-4">
      <button 
        v-if="!generatedResult"
        @click="handleMainAction" 
        :disabled="loading || isActionDisabled"
        class="flex-grow btn-primary py-4 font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-50"
      >
        <span v-if="loading" class="loader-sm w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin"></span>
        {{ loading ? 'AI 書僮正在研磨草稿...' : '產生初稿' }}
      </button>
      
      <template v-else>
         <button @click="resetGenerator" class="btn-secondary px-6 font-bold">重新設定</button>
         <button @click="saveAssignment" :disabled="saving" class="flex-grow btn-teal py-4 font-bold text-lg flex items-center justify-center gap-3">
            <span v-if="saving" class="loader-sm w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin"></span>
            {{ saving ? '書僮正在出題並刻錄卷軸...' : '確認無誤，出題並發佈！' }}
         </button>
      </template>
    </div>

    <!-- AI Refine Input Modal -->
    <div v-if="showAiRefineModal" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-slate-900/80 backdrop-blur-md" @click="showAiRefineModal = false"></div>
      <div class="relative z-10 bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-red-100 flex flex-col">
         <div class="bg-red-800 px-6 py-5 flex justify-between items-center shrink-0 shadow-lg">
            <h4 class="text-white font-black flex items-center gap-2" style="color: white !important;">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              AI 智能編修：原文正文
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
               <textarea v-model="aiRefinePrompt" rows="5" class="input-styled w-full text-sm leading-relaxed" placeholder="例如：將語句修飾得更為古雅優美、第一段太冗長請精簡..."></textarea>
            </div>
         </div>
         <div class="px-6 py-5 bg-slate-50 border-t flex gap-4 shrink-0">
            <button @click="showAiRefineModal = false" class="btn-secondary flex-1 py-3 text-sm font-bold">先等等</button>
            <button @click="handleAIRefine" :disabled="refiningAI" class="btn-primary flex-[2] py-3 text-sm font-black shadow-red-200 shadow-lg flex justify-center items-center gap-2">
              <span v-if="refiningAI" class="loader-sm w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
              {{ refiningAI ? '書僮運筆研墨中...' : '確認編修' }}
            </button>
         </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted } from 'vue'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase/init'
import { useAuthStore } from '../../stores/auth'
import { 
  generateTopicIdea,
  generateAssignmentFromTopic, 
  generateQuestionsFromText, 
  generateFullAnalysis,
  formatText,
  callGenerativeAI
} from '../../services/ai'

const props = defineProps({
  classId: { type: String, default: '' }
})

const emit = defineEmits(['close', 'success'])

const mode = ref('ai') // 'ai' or 'paste'
const topic = ref('')
const pastedTitle = ref('')
const pastedContent = ref('')
const isPublic = ref(false)
const deadline = ref('')
const tags = reactive({ format: '', contentType: '', difficulty: '' })

const loading = ref(false)
const saving = ref(false)
const generatingTopicIdea = ref(false)
const generatedResult = ref(null)

const DRAFT_KEY = 'reading_academy_article_draft'

// 初始化：載入草稿
onMounted(() => {
  try {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      if (data.mode) mode.value = data.mode
      if (data.topic) topic.value = data.topic
      if (data.pastedTitle) pastedTitle.value = data.pastedTitle
      if (data.pastedContent) pastedContent.value = data.pastedContent
      if (data.isPublic !== undefined) isPublic.value = data.isPublic
      if (data.deadline) deadline.value = data.deadline
      if (data.tags) Object.assign(tags, data.tags)
      if (data.generatedResult) generatedResult.value = data.generatedResult
    }
  } catch (e) {
    console.error('載入草稿失敗:', e)
  }
})

// 自動儲存草稿
watch(
  [mode, topic, pastedTitle, pastedContent, isPublic, deadline, () => tags, generatedResult],
  () => {
    const data = {
      mode: mode.value,
      topic: topic.value,
      pastedTitle: pastedTitle.value,
      pastedContent: pastedContent.value,
      isPublic: isPublic.value,
      deadline: deadline.value,
      tags: { ...tags },
      generatedResult: generatedResult.value
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
  },
  { deep: true }
)

// 切換模式時清除已生成的結果，避免畫面與資料錯亂
watch(mode, () => {
  generatedResult.value = null
})

const clearDraft = () => {
  localStorage.removeItem(DRAFT_KEY)
  topic.value = ''
  pastedTitle.value = ''
  pastedContent.value = ''
  deadline.value = ''
  isPublic.value = false
  generatedResult.value = null
}

const handleGenerateTopicIdea = async () => {
  generatingTopicIdea.value = true
  try {
    const idea = await generateTopicIdea(topic.value, tags)
    topic.value = idea
  } catch (err) {
    alert('靈感發想失敗：' + err.message)
  } finally {
    generatingTopicIdea.value = false
  }
}

const showAiRefineModal = ref(false)
const aiRefinePrompt = ref('')
const refiningAI = ref(false)

const openAIRefine = () => {
  aiRefinePrompt.value = ''
  showAiRefineModal.value = true
}

const handleAIRefine = async () => {
  if (!aiRefinePrompt.value.trim() || !generatedResult.value?.article) return
  refiningAI.value = true
  try {
    const prompt = `你是一位專業且細心的中文文本編輯。請根據以下指令潤飾提供的文章，並嚴格遵守段落排版規則：在每一個「自然段落」的開頭，加上兩個全形空格 "　　" 作為縮排。段落之間空一行。僅輸出潤飾後的文稿，不要有任何解析或廢話。\n\n指令：${aiRefinePrompt.value}\n原文：\n${generatedResult.value.article}`
    const res = await callGenerativeAI(prompt)
    generatedResult.value.article = res
    showAiRefineModal.value = false
  } catch (err) {
    alert('AI 潤飾失敗：' + err.message)
  } finally {
    refiningAI.value = false
  }
}

const isActionDisabled = computed(() => {
  if (mode.value === 'ai') return !topic.value.trim()
  return !pastedTitle.value.trim() || !pastedContent.value.trim()
})

const handleMainAction = async () => {
  if (isActionDisabled.value) return
  loading.value = true
  try {
    if (mode.value === 'ai') {
      const draftResult = await generateAssignmentFromTopic(topic.value, tags)
      generatedResult.value = draftResult // Only contains title, article, tags
    } else {
      generatedResult.value = {
        title: pastedTitle.value,
        article: pastedContent.value,
        tags: { ...tags }
      }
    }
  } catch (err) {
    console.error('AI Processing Error:', err)
    alert('AI 書僮草擬文章失敗：' + err.message)
  } finally {
    loading.value = false
  }
}

const handleCleanupText = async () => {
  if (!pastedContent.value.trim()) return
  loading.value = true
  try {
    const formatted = await formatText(pastedContent.value)
    pastedContent.value = formatted
  } catch (err) {
    alert('整理文本失敗：' + err.message)
  } finally {
    loading.value = false
  }
}

const saveAssignment = async () => {
  if (!generatedResult.value) return
  saving.value = true
  try {
    // 1. 根據使用者最終校訂的文章內容來出題
    const questionsResponse = await generateQuestionsFromText(
      generatedResult.value.title, 
      generatedResult.value.article, 
      generatedResult.value.tags
    )
    
    // 2. 根據最終內容生成解析
    const analysis = await generateFullAnalysis(generatedResult.value.article)

    const authStore = useAuthStore()
    const payload = {
      title: generatedResult.value.title,
      article: generatedResult.value.article,
      questions: questionsResponse.questions, // Store the newly generated questions here
      tags: questionsResponse.tags || generatedResult.value.tags,
      analysis: analysis,
      isPublic: isPublic.value,
      deadline: deadline.value ? Timestamp.fromDate(new Date(deadline.value + "T23:59:59")) : null,
      createdAt: Timestamp.now(),
      teacherId: authStore.currentUser?.uid || 'teacher_user',
      teacherName: authStore.currentUser?.displayName || '研墨夫子'
    }
    await addDoc(collection(db, 'assignments'), payload)
    
    // 成功發佈後清除草稿
    clearDraft()
    
    alert('成功發佈新篇章！出題與相關解析皆已備妥。')
    emit('close')
    emit('success')
  } catch (err) {
    console.error('Save Error:', err)
    alert('存檔失敗\n若為出題或解析發生錯誤，可以修改後再次嘗試發布：' + err.message)
  } finally {
    saving.value = false
  }
}

const resetGenerator = () => {
  generatedResult.value = null
}
</script>
