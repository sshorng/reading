<template>
  <div>
    <!-- Custom Calendar Structure transplanted from Old Code -->
    <div class="calendar-container w-full h-full">
      
      <div class="flex justify-between items-center mb-2">
        <button @click="prevMonth" class="p-1 rounded-full hover:bg-gray-200 w-8 h-8 flex items-center justify-center font-bold text-gray-600 transition-colors">&lt;</button>
        <h4 class="font-bold text-gray-800">{{ displayYear }}年 {{ displayMonth + 1 }}月</h4>
        <button @click="nextMonth" class="p-1 rounded-full hover:bg-gray-200 w-8 h-8 flex items-center justify-center font-bold text-gray-600 transition-colors">&gt;</button>
      </div>

      <!-- Week Days -->
      <div class="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-2">
        <div v-for="day in ['日', '一', '二', '三', '四', '五', '六']" :key="day">{{ day }}</div>
      </div>

      <!-- Days Grid -->
      <div class="grid grid-cols-7 gap-1">
        <!-- Empty spaces for first day index -->
        <div v-for="i in firstDayIndex" :key="'empty'+i"></div>
        
        <!-- Actual Days -->
        <div 
          v-for="day in daysInMonth" 
          :key="day"
          @click="selectDate(day)"
          class="h-9 flex items-center justify-center rounded-full text-sm relative cursor-pointer transition-colors"
          :class="getDayClasses(day)"
        >
          {{ day }}
          
          <!-- Deadline Marker Points -->
          <div v-if="getDeadlinesForDate(day).length > 0" class="absolute bottom-1 w-1.5 h-1.5 bg-red-500 rounded-full"></div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getAssignments } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'

const authStore = useAuthStore()
const dataStore = useDataStore()

const displayDate = ref(new Date())
const allAssignments = ref([])
const selectedDateStr = ref(dataStore.articleQueryState.filters.date || '')

const displayYear = computed(() => displayDate.value.getFullYear())
const displayMonth = computed(() => displayDate.value.getMonth())

const firstDayIndex = computed(() => {
  return new Date(displayYear.value, displayMonth.value, 1).getDay()
})

const daysInMonth = computed(() => {
  return new Date(displayYear.value, displayMonth.value + 1, 0).getDate()
})

const getDayString = (day) => {
  return `${displayYear.value}-${String(displayMonth.value + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const getDeadlinesForDate = (day) => {
  const dayStr = getDayString(day)
  return allAssignments.value.filter(a => {
    const isStudentUser = authStore.currentUser?.type === 'student'
    if (isStudentUser && a.isPublic !== true) {
      return false
    }
    if(!a.deadline) return false
    const d = a.deadline.toDate()
    const dString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return dString === dayStr
  })
}

const getDayClasses = (day) => {
  const dayStr = getDayString(day)
  let classes = "hover:bg-gray-100 "

  const now = new Date()
  const isToday = now.getFullYear() === displayYear.value && now.getMonth() === displayMonth.value && now.getDate() === day
  
  if (selectedDateStr.value === dayStr) {
     classes += "bg-red-700 text-white shadow-md hover:bg-red-800 "
  } else if (isToday) {
     classes += "bg-gray-800 text-white font-bold hover:bg-gray-700 "
  } else {
     classes += "text-gray-700 "
  }

  return classes
}

const selectDate = (day) => {
  const dayStr = getDayString(day)
  
  // Toggle off if already selected
  if (selectedDateStr.value === dayStr) {
     selectedDateStr.value = ''
     dataStore.articleQueryState.filters.date = ''
  } else {
     selectedDateStr.value = dayStr
     
     // Reset other filters
     dataStore.articleQueryState.filters = {
         format: '',
         contentType: '',
         difficulty: '',
         status: '',
         date: dayStr
     }
  }

  dataStore.fetchAssignmentsPage(true, authStore.currentUser)
}

const prevMonth = () => {
   const newDate = new Date(displayDate.value)
   newDate.setMonth(newDate.getMonth() - 1)
   displayDate.value = newDate
}

const nextMonth = () => {
   const newDate = new Date(displayDate.value)
   newDate.setMonth(newDate.getMonth() + 1)
   displayDate.value = newDate
}

onMounted(async () => {
  try {
     // Fetch all assignments without pagination to calculate deadline points accurately
     allAssignments.value = await getAssignments()
  } catch(e) {
     console.error("Error fetching assignments for calendar", e)
  }
})
</script>
