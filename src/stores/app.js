import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
    const currentView = ref('login')
    const isLoading = ref(false)
    const loadingMessage = ref('')
    const geminiApiKey = ref(null)

    const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
    const geminiModel = ref(DEFAULT_GEMINI_MODEL)
    const teacherGeminiModel = ref(DEFAULT_GEMINI_MODEL)

    function showLoading(msg = '處理中...') {
        loadingMessage.value = msg
        isLoading.value = true
    }

    function hideLoading() {
        isLoading.value = false
        loadingMessage.value = ''
    }

    function clearAchievementQueue() {
        achievementQueue.value = []
    }

    const achievementQueue = ref([])
    const isShowingAchievement = ref(false)

    function pushAchievement(achievement) {
        // 查找隊列中是否已有相同的成就 ID
        const existingIdx = achievementQueue.value.findIndex(a => a.id === achievement.id)
        if (existingIdx !== -1) {
            // 如果已在隊列中，直接遞增倍數
            achievementQueue.value[existingIdx].count = (achievementQueue.value[existingIdx].count || 1) + 1
        } else {
            // 如果是新成就，初始化 count = 1 並推入
            achievementQueue.value.push({ ...achievement, count: achievement.count || 1 })
        }
    }

    return {
        currentView,
        isLoading,
        loadingMessage,
        geminiApiKey,
        geminiModel,
        teacherGeminiModel,
        achievementQueue,
        isShowingAchievement,
        showLoading,
        hideLoading,
        pushAchievement
    }
})
