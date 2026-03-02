<template>
  <div v-if="isInitializing" class="min-h-screen flex items-center justify-center app-background">
    <div class="flex flex-col items-center space-y-4">
      <div class="loader"></div>
      <p class="text-lg font-medium text-gray-800 font-rounded">正在載入書院...</p>
    </div>
  </div>
  <router-view v-else />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { auth } from './firebase/init'
import { signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth'

const isInitializing = ref(true)

onMounted(async () => {
  try {
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
