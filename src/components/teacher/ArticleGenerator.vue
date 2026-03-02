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
        <div class="space-y-2">
          <label class="text-sm font-bold text-gray-600">篇章主題</label>
          <input v-model="topic" type="text" class="input-styled w-full" placeholder="例如：蘇軾與赤壁賦的曠達精神、氣候變遷對台灣的影響...">
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
               <label class="text-xs font-black text-slate-400 uppercase tracking-widest">文章正文</label>
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
        {{ loading ? 'AI 書僮正在研磨墨寶...' : (mode === 'ai' ? '啟動 AI 起草' : '分析文章內容') }}
      </button>
      
      <template v-else>
         <button @click="resetGenerator" class="btn-secondary px-6 font-bold">重新設定</button>
         <button @click="saveAssignment" :disabled="saving" class="flex-grow btn-teal py-4 font-bold text-lg flex items-center justify-center gap-3">
            <span v-if="saving" class="loader-sm w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin"></span>
            {{ saving ? '正在刻錄卷軸...' : '確認發佈此篇章' }}
         </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase/init'
import { useAuthStore } from '../../stores/auth'
import { 
  generateAssignmentFromTopic, 
  generateQuestionsFromText, 
  generateFullAnalysis,
  formatText
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
const generatedResult = ref(null)

const isActionDisabled = computed(() => {
  if (mode.value === 'ai') return !topic.value.trim()
  return !pastedTitle.value.trim() || !pastedContent.value.trim()
})

const handleMainAction = async () => {
  if (isActionDisabled.value) return
  loading.value = true
  try {
    let resultData = null
    
    if (mode.value === 'ai') {
      resultData = await generateAssignmentFromTopic(topic.value, tags)
    } else {
      loading.value = true // Ensure loading state
      const questionsAndTags = await generateQuestionsFromText(pastedTitle.value, pastedContent.value, tags)
      resultData = {
        title: pastedTitle.value,
        article: pastedContent.value,
        ...questionsAndTags
      }
    }
    
    // 生成解析與心智圖
    const analysis = await generateFullAnalysis(resultData.article)
    
    generatedResult.value = {
      ...resultData,
      analysis,
      tags: { ...resultData.tags }
    }
  } catch (err) {
    console.error('AI Processing Error:', err)
    alert('AI 書僮遺墨了，請稍後再試：' + err.message)
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
    const authStore = useAuthStore()
    const payload = {
      title: generatedResult.value.title,
      article: generatedResult.value.article,
      questions: generatedResult.value.questions,
      tags: generatedResult.value.tags,
      analysis: generatedResult.value.analysis,
      isPublic: isPublic.value,
      deadline: deadline.value ? Timestamp.fromDate(new Date(deadline.value + "T23:59:59")) : null,
      createdAt: Timestamp.now(),
      teacherId: authStore.currentUser?.uid || 'teacher_user',
      teacherName: authStore.currentUser?.displayName || '研墨夫子'
    }
    await addDoc(collection(db, 'assignments'), payload)
    alert('成功發佈新篇章！')
    emit('close')
    emit('success')
  } catch (err) {
    console.error('Save Error:', err)
    alert('存檔失敗：' + err.message)
  } finally {
    saving.value = false
  }
}

const resetGenerator = () => {
  generatedResult.value = null
}
</script>
