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

    return {
        currentView,
        isLoading,
        loadingMessage,
        geminiApiKey,
        geminiModel,
        teacherGeminiModel,
        showLoading,
        hideLoading
    }
})
