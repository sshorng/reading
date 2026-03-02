<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-lg font-bold text-gray-800 font-rounded">學堂總覽</h2>
      <select v-model="selectedClassId" @change="onClassChange" class="form-element-ink w-64">
        <option value="">選擇要檢視的學堂...</option>
        <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.className }}</option>
      </select>
    </div>

    <!-- Quick Stats -->
    <div v-if="selectedClassId" class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 mt-6">
       <div class="card bg-orange-50/50 border-orange-100 shadow-sm">
           <h3 class="text-xs font-black text-orange-800/40 uppercase tracking-widest mb-2">學子總數</h3>
           <p class="text-4xl font-black text-orange-600">{{ students.length }} <span class="text-base font-normal">人</span></p>
       </div>
       <div class="card bg-emerald-50/50 border-emerald-100 shadow-sm">
           <h3 class="text-xs font-black text-emerald-800/40 uppercase tracking-widest mb-2">課業平均完成率</h3>
           <p class="text-4xl font-black text-emerald-600">{{ completionRate.toFixed(1) }} <span class="text-base font-normal">%</span></p>
       </div>
       <div class="card bg-rose-50/50 border-rose-100 shadow-sm">
           <h3 class="text-xs font-black text-rose-800/40 uppercase tracking-widest mb-2">需關懷學子</h3>
           <p class="text-4xl font-black text-rose-600">{{ atRiskCount }} <span class="text-base font-normal">人</span></p>
       </div>
    </div>

    <!-- Class Charts -->
    <div v-if="selectedClassId" class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div class="card shadow-sm border border-slate-100">
            <h3 class="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <span class="w-1.5 h-4 bg-red-800 rounded-full"></span>
                班級成績分佈
            </h3>
            <div class="relative h-64">
                <canvas ref="distributionCanvas"></canvas>
            </div>
        </div>
        <div class="card shadow-sm border border-slate-100">
             <h3 class="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <span class="w-1.5 h-4 bg-teal-600 rounded-full"></span>
                近期繳卷趨勢
            </h3>
            <div class="relative h-64">
                <canvas ref="trendCanvas"></canvas>
            </div>
        </div>
    </div>

    <!-- Student List -->
    <div v-if="selectedClassId" class="card">
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-base font-bold text-gray-800">學子名單</h3>
            <button class="btn-primary text-sm py-2">新增學子</button>
        </div>
        
        <div v-if="isLoading" class="py-8 text-center text-gray-500">
            <div class="loader inline-block"></div>
            <p class="mt-2">正在載入名冊...</p>
        </div>
        <div v-else-if="students.length === 0" class="py-8 text-center text-gray-500">
            尚無學子。
        </div>
        <div v-else class="overflow-x-auto">
            <table class="min-w-full bg-white border border-slate-200 rounded-lg">
                <thead>
                    <tr class="bg-slate-100">
                        <th class="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase border-b">座號</th>
                        <th class="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase border-b">姓名</th>
                        <th class="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase border-b">操作</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-200">
                    <tr v-for="student in students" :key="student.id" class="hover:bg-slate-50 transition-colors">
                        <td class="px-6 py-4">{{ student.seatNumber }}</td>
                        <td class="px-6 py-4 font-bold text-slate-800">{{ student.name }}</td>
                        <td class="px-6 py-4">
                            <button class="text-blue-600 hover:text-blue-800 font-semibold mr-3">學習歷程</button>
                            <button class="text-red-600 hover:text-red-800 font-semibold">重設密碼</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    
    <div v-if="!selectedClassId" class="card py-16 text-center text-gray-500">
        請由上方選擇要檢視的學堂，以查看學子名單與學習數據。
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { fetchStudentsByClass, fetchAllSubmissionsByClass, getAssignments } from '../../services/api'
import Chart from 'chart.js/auto'

const authStore = useAuthStore()

const teacherSelectedClass = computed(() => authStore.currentUser?.selectedClassId || '')
const selectedClassId = ref('')
const students = ref([])
const submissions = ref([])
const assignments = ref([])
const isLoading = ref(false)

const distributionCanvas = ref(null)
const trendCanvas = ref(null)
let distInstance = null
let trendInstance = null

const publicAssignmentsCount = computed(() => assignments.value.filter(a => a.isPublic).length)

const completionRate = computed(() => {
    if (students.value.length === 0 || publicAssignmentsCount.value === 0) return 0
    const totalPotential = students.value.length * publicAssignmentsCount.value
    // Count unique (studentId, assignmentId) where best score >= 60
    const passedCount = submissions.value.filter(s => {
        const best = s.attempts?.length ? Math.max(...s.attempts.map(a => a.score)) : (s.score || 0)
        return best >= 60
    }).length
    return (passedCount / totalPotential) * 100
})

const atRiskCount = computed(() => {
    if (students.value.length === 0) return 0
    // Students with average score < 60 across their submissions
    const studentStats = new Map()
    submissions.value.forEach(s => {
        if (!studentStats.has(s.studentId)) studentStats.set(s.studentId, [])
        const best = s.attempts?.length ? Math.max(...s.attempts.map(a => a.score)) : (s.score || 0)
        studentStats.get(s.studentId).push(best)
    })
    
    let count = 0
    students.value.forEach(stu => {
        const scores = studentStats.get(stu.id) || []
        if (scores.length > 0) {
            const avg = scores.reduce((a,b) => a+b, 0) / scores.length
            if (avg < 60) count++
        } else if (publicAssignmentsCount.value > 0) {
            // No submissions at all?
            count++
        }
    })
    return count
})

const renderCharts = () => {
    if (distInstance) distInstance.destroy()
    if (trendInstance) trendInstance.destroy()
    if (!selectedClassId.value || students.value.length === 0) return

    // 1. Score Distribution
    const scoreBins = [0, 0, 0, 0, 0] // 0-59, 60-69, 70-79, 80-89, 90-100
    submissions.value.forEach(s => {
        const best = s.attempts?.length ? Math.max(...s.attempts.map(a => a.score)) : (s.score || 0)
        if (best < 60) scoreBins[0]++
        else if (best < 70) scoreBins[1]++
        else if (best < 80) scoreBins[2]++
        else if (best < 90) scoreBins[3]++
        else scoreBins[4]++
    })

    if (distributionCanvas.value) {
        distInstance = new Chart(distributionCanvas.value, {
            type: 'bar',
            data: {
                labels: ['不合格', '及格', '良好', '優良', '頂尖'],
                datasets: [{
                    label: '人次',
                    data: scoreBins,
                    backgroundColor: ['#f43f5e', '#fb923c', '#2dd4bf', '#3b82f6', '#8C384D'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { beginAtZero: true, ticks: { stepSize: 1 } },
                    x: { ticks: { font: { family: "'GenWanNeoSCjk', 'Noto Sans TC'" } } }
                }
            }
        })
    }

    // 2. Trend (Submissions by Date - last 7 days with data)
    if (trendCanvas.value) {
        const dailyCounts = new Map()
        submissions.value.forEach(s => {
            const ts = s.lastSubmittedAt || s.submittedAt || s.updatedAt
            if (!ts) return
            const d = ts.toDate ? ts.toDate() : new Date(ts)
            const dStr = `${d.getMonth()+1}/${d.getDate()}`
            dailyCounts.set(dStr, (dailyCounts.get(dStr) || 0) + 1)
        })
        const labels = Array.from(dailyCounts.keys()).sort()
        const data = labels.map(l => dailyCounts.get(l))

        trendInstance = new Chart(trendCanvas.value, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: '繳卷數',
                    data,
                    borderColor: '#0d9488',
                    backgroundColor: 'rgba(13, 148, 136, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        })
    }
}

const loadAllData = async () => {
    if(!selectedClassId.value) {
        students.value = []
        submissions.value = []
        return
    }
    isLoading.value = true
    try {
        const [stuData, subData, assignData] = await Promise.all([
            fetchStudentsByClass(selectedClassId.value),
            fetchAllSubmissionsByClass(selectedClassId.value),
            getAssignments()
        ])
        students.value = stuData.sort((a,b) => (a.seatNumber || 999) - (b.seatNumber || 999))
        submissions.value = subData
        assignments.value = assignData
        nextTick(() => renderCharts())
    } catch(e) {
        console.error("Failed to load dashboard data", e)
    } finally {
        isLoading.value = false
    }
}

watch(teacherSelectedClass, (newVal) => {
    if (newVal) {
        selectedClassId.value = newVal
        loadAllData()
    }
}, { immediate: true })

onMounted(() => {
    if (teacherSelectedClass.value) {
        selectedClassId.value = teacherSelectedClass.value
        loadAllData()
    }
})
</script>
