<template>
  <div v-if="isInitializing" class="min-h-screen flex items-center justify-center app-background">
    <div class="flex flex-col items-center space-y-4">
      <div class="loader"></div>
      <p class="text-lg font-medium text-gray-800 font-rounded">正在載入書院...</p>
    </div>
  </div>
  <router-view v-else />
  <AchievementToast />
</template>

<script setup>
import AchievementToast from './components/AchievementToast.vue'
import { ref, onMounted } from 'vue'
import { auth } from './firebase/init'
import { signInAnonymously, signInWithCustomToken } from 'firebase/auth'
import { useAuthStore } from './stores/auth'
import { loadStudentSubmissions } from './services/api'

const isInitializing = ref(true)
const authStore = useAuthStore()

onMounted(async () => {
  try {
    // 優先從持久化存儲恢復 (localStorage > sessionStorage)
    const savedUser = localStorage.getItem('tempUser') || sessionStorage.getItem('tempUser')
    if (savedUser) {
      const userData = JSON.parse(savedUser)
      authStore.setUser(userData)
      // 持久化使用者也要載入他的提交紀錄
      await loadStudentSubmissions(userData.studentId)
    }

    // 載入系統配置 (API Keys 等)
    if (!authStore.configLoaded) {
        await authStore.fetchSystemConfig()
    }

    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
      await signInWithCustomToken(auth, __initial_auth_token)
    } else {
      await signInAnonymously(auth)
    }
  } catch (error) {
    console.error("Firebase Auth Error:", error)
  } finally {
    isInitializing.value = false
  }
})
</script>

<style>
/* 全域樣式請透過 Tailwind 或 src/assets/styles.css 處理 */
.app-background {
  background-color: var(--bg-ink);
}
</style>
