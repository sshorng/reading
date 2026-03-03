<template>
  <div 
    class="relative flex flex-col justify-between bg-white border border-slate-200 rounded-2xl shadow-sm cursor-pointer card-hover-ink"
    :class="cardBorderClass"
    @click="handleClick"
  >
    <!-- Status Seal -->
    <div v-if="isPassed" class="status-seal status-seal-complete" title="已完成">完成</div>
    <div v-else-if="isOverdue" class="status-seal status-seal-overdue" title="已過期">逾期</div>
    <div v-else class="status-seal status-seal-incomplete" title="未完成">未完</div>

    <!-- Content Area -->
    <div class="p-5 pt-10 flex flex-col flex-grow">
      
      <!-- Deadline -->
      <div v-if="assignment.deadline" class="absolute top-4 right-5 text-xs font-bold inline-flex items-center px-2.5 py-1 rounded-full z-10" :class="isOverdue ? 'bg-red-100 text-red-800' : 'bg-amber-50 text-amber-700'">
        期限: {{ formattedDeadline }}
      </div>
      <div class="text-lg font-bold text-slate-800 mb-2 line-clamp-2 leading-snug" :title="assignment.title">{{ assignment.title }}</div>
      <p class="text-sm text-slate-500 mb-3 line-clamp-2 leading-relaxed">{{ articleSnippet }}</p>
      
      <!-- Tags -->
      <div class="mt-auto">
        <div class="flex flex-wrap gap-2 text-xs">
          <span v-if="tags.format" class="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-medium">#{{ tags.format }}</span>
          <span v-if="tags.contentType" class="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-medium">#{{ tags.contentType }}</span>
          <span v-if="tags.difficulty" class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">#{{ tags.difficulty }}</span>
        </div>
      </div>
    </div>
    
    <!-- Action Button -->
    <div class="p-4 bg-slate-50 border-t-2 border-slate-100 rounded-b-xl">
      <button class="w-full btn-primary py-2.5 px-4 text-sm font-bold tracking-wide">
        {{ actionText }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useDataStore } from '../../stores/data'
import { useAuthStore } from '../../stores/auth'

const props = defineProps({
  assignment: {
    type: Object,
    required: true
  }
})

const dataStore = useDataStore()
const authStore = useAuthStore()

const userSubmissions = computed(() => {
  const studentId = authStore.currentUser?.studentId
  if (!studentId) return []
  return dataStore.allSubmissions.filter(s => s.studentId === studentId)
})

const currentSubmission = computed(() => {
  return userSubmissions.value.find(s => s.assignmentId === props.assignment.id)
})

const isCompleted = computed(() => !!currentSubmission.value)

const highestScore = computed(() => {
  if (!isCompleted.value) return 0
  const sub = currentSubmission.value
  if (sub.attempts && sub.attempts.length > 0) {
    return Math.max(...sub.attempts.map(a => a.score))
  }
  return sub.score || 0
})

const isPassed = computed(() => isCompleted.value && highestScore.value >= 60)

const isOverdue = computed(() => {
  if (!props.assignment.deadline) return false
  const deadline = props.assignment.deadline
  const deadlineDate = deadline.toDate ? deadline.toDate() : new Date(deadline.seconds ? deadline.seconds * 1000 : deadline)
  return new Date() > deadlineDate
})

const cardBorderClass = computed(() => {
  return 'border-gray-200 hover:border-gray-300 transition-colors duration-300'
})

const formattedDeadline = computed(() => {
  if (!props.assignment.deadline) return ''
  const deadline = props.assignment.deadline
  const d = deadline.toDate ? deadline.toDate() : new Date(deadline.seconds ? deadline.seconds * 1000 : deadline)
  if (isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
})

const tags = computed(() => props.assignment.tags || {})

const articleSnippet = computed(() => {
  if (!props.assignment.article) return ''
  return props.assignment.article.replace(/(\r\n|\n|\r|　)/gm, " ").trim().substring(0, 60) + '...'
})

const actionText = computed(() => {
  if (isPassed.value) return '查看結果'
  if (isCompleted.value) return `再次挑戰 (${highestScore.value}分)`
  return '開始試煉'
})

const handleClick = () => {
    // Navigate to assignment detail logic goes here
    console.log("Clicked assignment:", props.assignment.title)
}
</script>
