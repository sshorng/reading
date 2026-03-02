<template>
  <div class="card p-6 shadow-md border border-gray-100 min-h-[70vh] flex flex-col">
    <!-- Sub-Tabs Navigation -->
    <div class="flex border-b border-gray-100 mb-6 font-bold text-sm bg-slate-50/50 rounded-t-xl overflow-hidden">
      <button 
        @click="libraryTab = 'create'" 
        class="py-4 px-8 transition-all flex items-center gap-2"
        :class="libraryTab === 'create' ? 'bg-white border-x border-t border-gray-100 text-red-800 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]' : 'text-gray-400 hover:bg-white/50'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        新撰篇章
      </button>
      <button 
        @click="libraryTab = 'list'" 
        class="py-4 px-8 transition-all flex items-center gap-2"
        :class="libraryTab === 'list' ? 'bg-white border-x border-t border-gray-100 text-red-800 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]' : 'text-gray-400 hover:bg-white/50'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        藏書總覽
      </button>
    </div>

    <!-- Tab Content -->
    <div class="flex-grow">
      <!-- Create Article Section -->
      <div v-if="libraryTab === 'create'" class="max-w-7xl mx-auto py-4 animate-fade-in px-4">
        <ArticleGenerator :classId="classId" @success="handleGeneratorSuccess" />
      </div>

      <!-- Article Library List Section -->
      <div v-else class="space-y-6 animate-fade-in px-2">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
          <div class="flex items-center gap-4">
            <h3 class="text-xl font-black text-gray-800 flex items-center gap-2 whitespace-nowrap">
              <span class="w-1.5 h-6 bg-red-800 rounded-full"></span>
              卷軸清單
              <span class="text-xs text-slate-400 font-medium ml-2">夫子館藏 (共 {{ articles.length }} 卷)</span>
            </h3>

            <div class="relative group">
              <input v-model="searchQuery" type="text" class="input-styled py-2 pl-10 pr-4 text-sm w-64 bg-slate-50 border-transparent transition-all focus:bg-white focus:w-80 active:ring-2 active:ring-red-100" placeholder="搜尋卷軸標題...">
              <svg class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-800 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
            <div class="flex items-center gap-2 px-2 border-r border-slate-100 mr-1">
              <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">篩選</span>
            </div>
            <select v-model="filters.format" class="form-element-ink !w-auto py-2 px-4 text-xs font-bold border-none bg-slate-50 rounded-xl">
              <option value="">所有形式</option>
              <option v-for="opt in ['純文', '圖表', '圖文']" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <select v-model="filters.contentType" class="form-element-ink !w-auto py-2 px-4 text-xs font-bold border-none bg-slate-50 rounded-xl">
              <option value="">所有架構</option>
              <option v-for="opt in ['記敘', '抒情', '說明', '議論', '應用']" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <select v-model="filters.difficulty" class="form-element-ink !w-auto py-2 px-4 text-xs font-bold border-none bg-slate-50 rounded-xl">
              <option value="">所有難度</option>
              <option v-for="opt in ['簡單', '基礎', '普通', '進階', '困難']" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <select v-model="filters.status" class="form-element-ink !w-auto py-2 px-4 text-xs font-bold border-none bg-slate-50 rounded-xl">
              <option value="">挑戰期限</option>
              <option value="active">進行中</option>
              <option value="overdue">已逾期</option>
              <option value="none">無期限</option>
            </select>
          </div>
        </div>

        <!-- Bulk Actions -->
        <div v-if="selectedArticles.length > 0" class="flex items-center gap-4 animate-slide-up bg-red-800 text-white p-4 rounded-2xl shadow-xl">
          <div class="flex items-center gap-2 px-4 border-r border-red-700/50">
            <span class="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-black">{{ selectedArticles.length }}</span>
            <span class="text-xs font-bold tracking-wider">項已選取</span>
          </div>
          <div class="flex gap-2">
            <button @click="bulkSetStatus(true)" class="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-all">批量公開</button>
            <button @click="bulkSetStatus(false)" class="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-all">批量私密</button>
            <button @click="bulkDelete" class="px-4 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-bold transition-all shadow-lg">批量焚毀</button>
          </div>
        </div>

        <!-- Table Overlaying -->
        <div class="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden">
          <table class="min-w-full divide-y divide-slate-100 text-left">
            <thead class="bg-slate-50/80">
              <tr>
                <th class="px-6 py-4 w-12 text-center">
                  <input type="checkbox" @change="toggleSelectAll" :checked="isAllSelected" class="w-4 h-4 rounded border-slate-300 text-red-800 focus:ring-red-800/20">
                </th>
                <th class="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">篇章標題 / 創立資訊</th>
                <th class="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">標籤屬性</th>
                <th class="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">閱覽狀態</th>
                <th class="px-8 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest">操作行事</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-slate-50">
              <tr v-if="loading">
                 <td colspan="5" class="py-20">
                    <div class="flex flex-col items-center justify-center gap-4 opacity-40">
                      <div class="w-10 h-10 border-4 border-red-800/10 border-t-red-800 rounded-full animate-spin"></div>
                      <p class="text-sm font-medium italic">夫子稍待，正在翻閱書庫殘卷...</p>
                    </div>
                 </td>
              </tr>
              <tr v-else-if="filteredArticles.length === 0">
                 <td colspan="5" class="text-center py-20">
                    <p class="text-slate-400 font-medium italic">夫子，書庫中尚未發現符合條件的篇章。</p>
                 </td>
              </tr>
              <tr v-for="article in filteredArticles" :key="article.id" class="hover:bg-red-50/30 transition-all group/row">
                <td class="px-6 py-5 text-center">
                  <input type="checkbox" v-model="selectedArticles" :value="article.id" class="w-4 h-4 rounded border-slate-300 text-red-800 focus:ring-red-800/20">
                </td>
                <td class="px-6 py-5">
                  <div @click="viewSubmissions(article)" class="text-lg font-black text-slate-800 cursor-pointer hover:text-red-800 transition-colors underline decoration-dotted decoration-red-800/20 underline-offset-4">{{ article.title }}</div>
                  <div class="flex items-center gap-4 text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tight">
                    <span class="flex items-center gap-1.5">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {{ article.createdAt ? formatDate(article.createdAt) : '未知' }}
                    </span>
                    <span v-if="article.deadline" class="text-red-700 font-black border-l pl-4 border-slate-200 flex items-center gap-1.5">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      限至 {{ formatDate(article.deadline) }}
                    </span>
                  </div>
                </td>
                <td class="px-6 py-5">
                   <div class="flex gap-1.5 flex-wrap">
                     <span class="px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 text-[10px] font-black border border-orange-100/50">#{{ article.tags?.format || '純文' }}</span>
                     <span class="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-black border border-rose-100/50">#{{ article.tags?.contentType || '說明' }}</span>
                     <span class="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-black border border-amber-100/50">#{{ article.tags?.difficulty || '普通' }}</span>
                   </div>
                </td>
                <td class="px-6 py-5">
                  <span :class="article.isPublic ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'" 
                        class="px-4 py-1.5 text-xs font-black rounded-xl border shadow-sm inline-flex items-center gap-2">
                    <span :class="article.isPublic ? 'bg-emerald-500' : 'bg-slate-300'" class="w-1.5 h-1.5 rounded-full"></span>
                    {{ article.isPublic ? '已公開發布' : '私密藏書' }}
                  </span>
                </td>
                <td class="px-8 py-5 text-right">
                  <div class="flex justify-end gap-3 opacity-0 group-hover/row:opacity-100 transition-all translate-x-4 group-hover/row:translate-x-0">
                    <button @click="editArticle(article)" class="flex items-center gap-1.5 py-1.5 px-4 bg-white text-slate-600 hover:text-red-800 rounded-xl border border-slate-200 shadow-sm transition-all" title="修訂">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      <span class="text-xs font-bold">修訂</span>
                    </button>
                    <button @click="deleteArticle(article.id)" class="p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="焚毀">
                       <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

<!-- Modals Extracted -->
    <ArticleEditorModal 
      :is-visible="editingArticle"
      :article-data="editingArticleData"
      @save="handleEditorSave"
      @cancel="editingArticle = false"
    />

    <SubmissionReviewModal
      :is-visible="viewSubmissionsModal"
      :assignment="viewingAssignment"
      :class-id="props.classId"
      @close="viewSubmissionsModal = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { collection, query, getDocs, orderBy, doc, updateDoc, deleteDoc, writeBatch, where } from 'firebase/firestore'
import { db } from '../../firebase/init'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import ArticleGenerator from './ArticleGenerator.vue'
import ArticleEditorModal from './ArticleEditorModal.vue'
import SubmissionReviewModal from './SubmissionReviewModal.vue'

const authStore = useAuthStore()
const dataStore = useDataStore()

const props = defineProps({
  classId: { type: String, default: '' }
})

const libraryTab = ref('list') 
const articles = ref([])
const loading = ref(false)
const searchQuery = ref('')
const selectedArticles = ref([])

const editingArticle = ref(false)
const editingArticleData = ref(null)

const viewSubmissionsModal = ref(false)
const viewingAssignment = ref(null)

const filters = ref({
  format: '',
  contentType: '',
  difficulty: '',
  status: ''
})

const filteredArticles = computed(() => {
  const now = new Date()
  let list = articles.value.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesFormat = !filters.value.format || a.tags?.format === filters.value.format
    const matchesContent = !filters.value.contentType || a.tags?.contentType === filters.value.contentType
    const matchesDiff = !filters.value.difficulty || a.tags?.difficulty === filters.value.difficulty
    
    let matchesStatus = true
    if (filters.value.status) {
      if (filters.value.status === 'none') {
        matchesStatus = !a.deadline
      } else if (a.deadline) {
        const dDate = a.deadline.toDate ? a.deadline.toDate() : new Date(a.deadline)
        if (filters.value.status === 'active') matchesStatus = dDate >= now
        if (filters.value.status === 'overdue') matchesStatus = dDate < now
      } else {
        matchesStatus = false
      }
    }

    return matchesSearch && matchesFormat && matchesContent && matchesDiff && matchesStatus
  })
  
  list.sort((a, b) => {
     const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0)
     const db_ = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0)
     return db_ - da
  })
  return list
})

const fetchArticles = async () => {
  loading.value = true
  try {
    const q = query(collection(db, 'assignments'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    articles.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

const handleGeneratorSuccess = () => {
  libraryTab.value = 'list'
  fetchArticles()
}

const isAllSelected = computed(() => {
  return filteredArticles.value.length > 0 && selectedArticles.value.length === filteredArticles.value.length
})

const toggleSelectAll = (e) => {
  if (e.target.checked) {
    selectedArticles.value = filteredArticles.value.map(a => a.id)
  } else {
    selectedArticles.value = []
  }
}

const formatDate = (ts) => {
  if (!ts || !ts.toDate) return ''
  const d = ts.toDate()
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const bulkSetStatus = async (isPublic) => {
  if (selectedArticles.value.length === 0) return
  const batch = writeBatch(db)
  selectedArticles.value.forEach(id => {
    batch.update(doc(db, 'assignments', id), { isPublic })
  })
  try {
    await batch.commit()
    await fetchArticles()
    selectedArticles.value = []
    alert(`成功將選取篇章設為 ${isPublic ? '公開' : '私密'}。`)
  } catch (err) {
    console.error(err)
  }
}

const bulkDelete = async () => {
  if (selectedArticles.value.length === 0) return
  if (!confirm(`閣下確定要將選取之 ${selectedArticles.value.length} 篇殘卷悉數焚毀嗎？此舉不可逆。`)) return
  
  const batch = writeBatch(db)
  selectedArticles.value.forEach(id => {
    batch.delete(doc(db, 'assignments', id))
  })
  try {
    await batch.commit()
    await fetchArticles()
    selectedArticles.value = []
  } catch (err) {
    console.error(err)
  }
}

const deleteArticle = async (id) => {
  if (!confirm('確定焚毀此篇章嗎？')) return
  await deleteDoc(doc(db, 'assignments', id))
  fetchArticles()
}

const editArticle = (article) => {
  // Deep clone to avoid direct reactive mutation
  editingArticleData.value = JSON.parse(JSON.stringify(article))
  editingArticle.value = true
}

const handleEditorSave = () => {
  editingArticle.value = false
  fetchArticles()
  alert('篇章內容已修訂完成。')
}

const viewSubmissions = async (article) => {
  if (!props.classId) {
     alert('請先在左上角選擇一個學堂')
     return
  }
  viewingAssignment.value = article
  viewSubmissionsModal.value = true
}

const checkEditTarget = () => {
  if (dataStore.editTargetAssignmentId && articles.value.length > 0) {
    const target = articles.value.find(a => a.id === dataStore.editTargetAssignmentId)
    if (target) {
      libraryTab.value = 'list'
      editArticle(target)
      dataStore.editTargetAssignmentId = null
    }
  }
}

watch(() => dataStore.editTargetAssignmentId, checkEditTarget, { immediate: true })
watch(articles, checkEditTarget)

onMounted(async () => {
    await fetchArticles()
    checkEditTarget()
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f5f9;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
</style>
