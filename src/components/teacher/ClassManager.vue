<template>
  <div class="card p-6 shadow-md border border-gray-100">
    <div v-if="!classId" class="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
      <div class="mb-4 text-slate-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 class="text-xl font-bold text-slate-500">夫子，請先挑選一座學堂。</h3>
      <p class="text-slate-400 mt-2">唯有擇定學堂，方能點閱學子名冊與執行各項管領之事。</p>
    </div>

    <div v-else class="space-y-8 animate-fade-in">
      <!-- Roster Display -->
      <section>
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold text-gray-700 flex items-center gap-2">
            <span class="w-2 h-6 bg-red-800 rounded-full"></span>
            學子名錄 ({{ roster.length }} 位)
          </h3>
          <div class="text-xs text-gray-400 italic">依座號編序</div>
        </div>

        <div v-if="loadingRoster" class="flex justify-center p-8">
          <div class="loader-sm w-8 h-8 border-4 border-red-800/20 border-t-red-800 rounded-full animate-spin"></div>
        </div>
        
        <div v-else-if="roster.length === 0" class="p-8 text-center text-slate-400 bg-slate-50 rounded-lg">
          此學堂暫無學子登錄。
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto p-1 custom-scrollbar">
          <div v-for="s in sortedRoster" :key="s.id" 
               class="group flex items-center justify-between bg-white border border-gray-200 hover:bg-slate-50 rounded-lg px-4 py-3 transition-colors duration-200">
            <div class="flex items-center gap-3">
              <span class="text-[10px] font-black text-red-800 bg-red-800/10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-inner">{{ s.seatNumber }}</span>
              <span @click="viewStudentSubmissions(s)" class="text-base font-bold text-slate-700 cursor-pointer group-hover:text-red-800 transition-colors tracking-tight">{{ s.name }}</span>
            </div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button @click="editStudent(s)" class="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50" title="修訂學籍">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button @click="resetPassword(s)" class="p-1.5 text-gray-400 hover:text-orange-600 rounded-md hover:bg-orange-50" title="重置密碼">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </button>
              <button @click="deleteStudent(s)" class="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50" title="除籍">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Management Actions -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-100 pt-8 mt-8">
        <!-- Single Add -->
        <section>
          <h4 class="text-base font-black text-slate-500 mb-3 uppercase tracking-widest flex items-center gap-2">
            <span class="w-1 h-4 bg-slate-300 rounded-full"></span>
            單增學子
          </h4>
          <div class="flex gap-2">
            <input v-model.number="newStudent.seat" type="number" class="w-20 input-styled text-base" placeholder="座號">
            <input v-model.trim="newStudent.name" type="text" class="flex-grow input-styled text-base font-bold" placeholder="輸入學子姓名" @keyup.enter="handleAddStudent">
            <button @click="handleAddStudent" class="btn-primary py-2 px-8 font-black whitespace-nowrap shadow-sm">登錄</button>
          </div>
        </section>

        <!-- Bulk Import -->
        <section>
          <h4 class="text-md font-bold text-gray-600 mb-3">批量延攬</h4>
          <textarea v-model="bulkImportText" rows="3" class="w-full input-styled text-sm mb-2" placeholder="格式：座號,姓名 (一行一位)"></textarea>
          <button @click="handleBulkImport" class="w-full btn-secondary py-2 font-bold flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            執行延攬
          </button>
        </section>
      </div>
      
      <!-- Reports -->
      <section class="border-t border-gray-100 pt-8">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold text-gray-700 flex items-center gap-2">
            <span class="w-2 h-6 bg-red-800 rounded-full"></span>
            逾期課業報
          </h3>
          <button @click="generateOverdueReport" class="btn-secondary py-1 px-4 text-xs font-bold">查看最新回報</button>
        </div>
        <div class="px-6 py-5 bg-white border border-gray-100 rounded-2xl shadow-sm min-h-[120px]">
           <div v-if="overdueLoading" class="flex items-center justify-center py-8 gap-3 text-rose-600 font-bold">
             <div class="loader-sm w-5 h-5 border-2 border-rose-800/20 border-t-rose-800 rounded-full animate-spin"></div>
             正在查閱各地書院卷軸...
           </div>
           
           <div v-else-if="!hasCheckedOverdue" class="flex flex-col items-center justify-center py-10 text-slate-400">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-slate-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
             <p class="font-medium">尚未進行清查，請點擊右上方「查看最新回報」</p>
           </div>
           
           <div v-else-if="overdueData.length === 0" class="flex flex-col items-center justify-center py-10 text-emerald-600">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-emerald-100 mb-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
             <p class="font-black text-xl mb-1">太棒了！</p>
             <p class="font-medium text-emerald-700/70">目前全班沒有任何逾期未交的課業 🎉</p>
           </div>
           
           <div v-else class="space-y-4">
             <div class="flex justify-end mb-2">
               <button @click="copyOverdueList" class="btn-secondary py-1.5 px-3 text-xs font-bold flex items-center gap-1 text-slate-600 hover:text-slate-800 bg-slate-50 border-slate-200">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                 複製催收名單
               </button>
             </div>
             
             <div v-for="stu in overdueData" :key="stu.id" class="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-white border border-rose-100 rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
               <div class="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
               
               <!-- 學生資訊區 -->
               <div class="flex items-center gap-3 mb-3 md:mb-0 w-full md:w-48 shrink-0">
                 <div class="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 text-rose-700 flex items-center justify-center font-black text-lg">
                   {{ stu.seatNumber }}
                 </div>
                 <div>
                   <h4 class="font-bold text-gray-800 text-lg">{{ stu.name }}</h4>
                   <span class="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">缺交 {{ stu.tasks.length }} 篇</span>
                 </div>
               </div>

               <!-- 欠交文章區 -->
               <div class="flex-grow md:mx-6 flex flex-wrap gap-2">
                 <span v-for="(task, index) in stu.tasks" :key="index" class="text-xs border border-rose-100 bg-rose-50/50 text-slate-700 px-2.5 py-1.5 rounded-md flex items-center gap-1.5 shadow-sm">
                   {{ task.title }}
                   <span class="text-rose-600 font-bold bg-white px-1 rounded">{{ task.deadlineStr }}</span>
                 </span>
               </div>

               <!-- 操作區 -->
               <button @click="viewStudentSubmissions(stu)" class="shrink-0 mt-3 md:mt-0 text-xs font-bold text-teal-600 border border-teal-200 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-4 py-2 rounded-lg transition-colors flex items-center gap-1">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                 查看歷程
               </button>
             </div>
           </div>
        </div>
      </section>

      <!-- Modals -->
      <StudentEditModal 
        :is-visible="editingStudent"
        :student-data="editingStudentData"
        :class-id="props.classId"
        @close="editingStudent = false"
        @success="fetchRoster"
      />

      <StudentDetailModal 
        :is-visible="showingStudentDetail"
        :student="currentStudentDetail"
        :submissions="studentSubmissions"
        :loading="loadingStudentDetail"
        @close="showingStudentDetail = false"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/init'
import { useAuthStore } from '../../stores/auth'
import { hashString, generateDefaultPassword } from '../../utils/helpers'
import StudentEditModal from './StudentEditModal.vue'
import StudentDetailModal from './StudentDetailModal.vue'

const props = defineProps({
  classId: { type: String, default: '' }
})

const authStore = useAuthStore()

const roster = ref([])
const loadingRoster = ref(false)
const newStudent = ref({ seat: '', name: '' })
const bulkImportText = ref('')
const overdueData = ref([])
const overdueLoading = ref(false)
const hasCheckedOverdue = ref(false)

const editingStudent = ref(false)
const editingStudentData = ref(null)

const showingStudentDetail = ref(false)
const currentStudentDetail = ref(null)
const studentSubmissions = ref([])
const loadingStudentDetail = ref(false)

const sortedRoster = computed(() => {
  return [...roster.value].sort((a, b) => a.seatNumber - b.seatNumber)
})

const fetchRoster = async () => {
  if (!props.classId) return
  loadingRoster.value = true
  try {
    const q = query(collection(db, `classes/${props.classId}/students`))
    const snap = await getDocs(q)
    roster.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error("Fetch roster error:", error)
  } finally {
    loadingRoster.value = false
  }
}

const handleAddStudent = async () => {
  if (!newStudent.value.seat || !newStudent.value.name) return
  const selectedClass = authStore.allClasses.find(c => c.id === props.classId)
  const seatNum = parseInt(newStudent.value.seat)
  const studentId = `${props.classId}_${seatNum}`
  const defaultPass = generateDefaultPassword(selectedClass?.className || '', seatNum)
  const passHash = await hashString(defaultPass)

  try {
    await setDoc(doc(db, `classes/${props.classId}/students`, studentId), {
      name: newStudent.value.name,
      seatNumber: seatNum,
      studentId: studentId,
      passwordHash: passHash
    })
    newStudent.value = { seat: '', name: '' }
    fetchRoster()
  } catch (error) {
    alert('登錄失敗，座號可能重複。')
  }
}

const handleBulkImport = async () => {
  if (!bulkImportText.value.trim()) return
  const lines = bulkImportText.value.split('\n').filter(l => l.trim())
  const selectedClass = authStore.allClasses.find(c => c.id === props.classId)
  const batch = writeBatch(db)
  
  for (const line of lines) {
    const [seatStr, name] = line.split(/[,，]/).map(s => s.trim())
    const seatNum = parseInt(seatStr)
    if (isNaN(seatNum) || !name) continue
    const studentId = `${props.classId}_${seatNum}`
    const defaultPass = generateDefaultPassword(selectedClass?.className || '', seatNum)
    const passHash = await hashString(defaultPass)
    batch.set(doc(db, `classes/${props.classId}/students`, studentId), {
      name, seatNumber: seatNum, studentId, passwordHash: passHash
    })
  }

  try {
    await batch.commit()
    bulkImportText.value = ''
    fetchRoster()
    alert('批量延攬成功。')
  } catch (err) {
    console.error(err)
    alert('執行失敗，請檢查格式。')
  }
}

const editStudent = (student) => {
  editingStudentData.value = { ...student }
  editingStudent.value = true
}

const resetPassword = async (student) => {
  if (!confirm(`確定要為學子 ${student.name} 重置密碼為預設值嗎？`)) return
  try {
    const selectedClass = authStore.allClasses.find(c => c.id === props.classId)
    const defaultPass = generateDefaultPassword(selectedClass?.className || '', student.seatNumber)
    const passHash = await hashString(defaultPass)
    await updateDoc(doc(db, `classes/${props.classId}/students`, student.id), { passwordHash: passHash })
    alert(`學子 ${student.name} 的密碼已重置。`)
  } catch (err) {
    alert('重置失敗：' + err.message)
  }
}

const deleteStudent = async (student) => {
  if (!confirm(`確定要將 ${student.name} 學子除籍嗎？其所有挑戰記錄將一併消失。`)) return
  try {
    const batch = writeBatch(db)
    batch.delete(doc(db, `classes/${props.classId}/students`, student.id))
    const subQuery = query(collection(db, "submissions"), where("studentId", "==", student.id))
    const subSnap = await getDocs(subQuery)
    subSnap.forEach(d => batch.delete(d.ref))
    await batch.commit()
    fetchRoster()
    alert('學子已除籍並清理記錄。')
  } catch (err) {
    alert('操作失敗：' + err.message)
  }
}

const generateOverdueReport = async () => {
  if (!props.classId) return
  hasCheckedOverdue.value = true
  overdueLoading.value = true
  try {
    const now = new Date()
    const assignmentsSnap = await getDocs(collection(db, 'assignments'))
    const allAssignments = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const overdueAssignments = allAssignments.filter(a => a.isPublic && a.deadline && a.deadline.toDate() < now)
    
    if (overdueAssignments.length === 0) {
      overdueData.value = []
      return
    }

    const subQuery = query(collection(db, "submissions"), where('classId', '==', props.classId))
    const subSnap = await getDocs(subQuery)
    const classSubmissions = subSnap.docs.map(d => d.data())
    const results = []
    roster.value.forEach(student => {
      const tasks = []
      overdueAssignments.forEach(assignment => {
        const sub = classSubmissions.find(s => s.studentId === student.id && s.assignmentId === assignment.id)
        let passed = false
        if (sub) {
          const high = sub.attempts ? Math.max(...sub.attempts.map(a => a.score)) : (sub.score || 0)
          passed = high >= 60
        }
        if (!passed) {
          const d = assignment.deadline.toDate()
          const deadlineStr = `(${d.getMonth() + 1}/${d.getDate()})`;
          tasks.push({ title: assignment.title, deadlineStr: deadlineStr })
        }
      })
      if (tasks.length > 0) results.push({ ...student, tasks })
    })
    overdueData.value = results.sort((a, b) => a.seatNumber - b.seatNumber)
  } catch (err) {
    console.error(err); alert('報表生成失敗')
  } finally {
    overdueLoading.value = false
  }
}

const copyOverdueList = async () => {
  if (overdueData.value.length === 0) return
  
  const lines = overdueData.value.map(stu => {
    const taskTitles = stu.tasks.map(t => t.title).join('、')
    return `${stu.seatNumber}號 ${stu.name} 尚未繳交：${taskTitles}`
  })
  
  const textToCopy = `【書院課業逾期名單】\n${lines.join('\n')}`
  
  try {
    await navigator.clipboard.writeText(textToCopy)
    alert('逾期名單已複製到剪貼簿！')
  } catch (err) {
    console.error('Failed to copy text: ', err)
    alert('複製失敗，請手動選取複製')
  }
}



const viewStudentSubmissions = async (student) => {
  currentStudentDetail.value = student
  showingStudentDetail.value = true
  loadingStudentDetail.value = true
  try {
    const q = query(collection(db, "submissions"), where("studentId", "==", student.id))
    const snap = await getDocs(q)
    studentSubmissions.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (err) {
    console.error(err)
  } finally {
    loadingStudentDetail.value = false
  }
}

watch(() => props.classId, fetchRoster, { immediate: true })
</script>
