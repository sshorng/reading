<template>
  <div class="achievement-toast-container fixed top-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
    <transition name="achievement-pop">
      <div v-if="currentAchievement" :key="currentAchievement.id" class="achievement-toast pointer-events-auto">
        <div class="achievement-card">
          <div class="achievement-icon-wrapper">
            <span class="achievement-icon">{{ currentAchievement.icon || '🏆' }}</span>
            <div class="achievement-aura"></div>
          </div>
          
          <div class="achievement-content">
            <div class="achievement-label">成就解鎖</div>
            <h3 class="achievement-name">{{ currentAchievement.name }}</h3>
            <p class="achievement-desc">{{ currentAchievement.description }}</p>
          </div>
          
          <div class="achievement-close" @click="closeAchievement">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>
        
        <!-- Progress bar indicating auto-close time -->
        <div class="achievement-progress">
          <div class="achievement-progress-bar" :style="{ width: progress + '%' }"></div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useAppStore } from '../stores/app'

const appStore = useAppStore()
const currentAchievement = ref(null)
const progress = ref(100)
let timer = null
let progressTimer = null

const SHOW_DURATION = 4000 // 4 seconds

function showNext() {
  if (appStore.achievementQueue.length > 0 && !currentAchievement.value) {
    currentAchievement.value = appStore.achievementQueue.shift()
    progress.value = 100
    
    // Animate progress bar
    const step = 100 / (SHOW_DURATION / 16) // roughly 60fps
    progressTimer = setInterval(() => {
      progress.value -= step
      if (progress.value <= 0) {
        clearInterval(progressTimer)
      }
    }, 16)

    timer = setTimeout(() => {
      closeAchievement()
    }, SHOW_DURATION)
  }
}

function closeAchievement() {
  currentAchievement.value = null
  progress.value = 0
  if (timer) clearTimeout(timer)
  if (progressTimer) clearInterval(progressTimer)
  
  // Wait for transition to end then show next
  setTimeout(() => {
    showNext()
  }, 400)
}

watch(() => appStore.achievementQueue.length, () => {
  if (!currentAchievement.value) {
    showNext()
  }
})

onMounted(() => {
  showNext()
})
</script>

<style scoped>
.achievement-toast {
  width: 380px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12), 
              inset 0 0 15px rgba(255, 215, 0, 0.1);
  overflow: hidden;
  position: relative;
}

.achievement-card {
  display: flex;
  align-items: center;
  padding: 20px;
  gap: 18px;
}

.achievement-icon-wrapper {
  position: relative;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, #fffbeb, #fef3c7);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.2);
  flex-shrink: 0;
}

.achievement-icon {
  font-size: 34px;
  z-index: 2;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
}

.achievement-aura {
  position: absolute;
  width: 100%;
  height: 100%;
  background: white;
  border-radius: 50%;
  opacity: 0.6;
  filter: blur(10px);
  animation: pulse-aura 2s infinite ease-in-out;
}

@keyframes pulse-aura {
  0%, 100% { transform: scale(0.8); opacity: 0.3; }
  50% { transform: scale(1.3); opacity: 0.6; }
}

.achievement-content {
  flex-grow: 1;
  min-width: 0;
}

.achievement-label {
  font-size: 10px;
  font-weight: 800;
  color: #b45309;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-bottom: 2px;
}

.achievement-name {
  font-size: 18px;
  font-weight: 900;
  color: #1e293b;
  margin: 0;
  line-height: 1.2;
}

.achievement-desc {
  font-size: 12px;
  color: #64748b;
  margin: 4px 0 0 0;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.achievement-close {
  position: absolute;
  top: 12px;
  right: 12px;
  color: #cbd5e1;
  cursor: pointer;
  transition: all 0.2s;
}

.achievement-close:hover {
  color: #ef4444;
  transform: scale(1.2);
}

.achievement-progress {
  height: 4px;
  background: rgba(0, 0, 0, 0.05);
  width: 100%;
}

.achievement-progress-bar {
  height: 100%;
  background: linear-gradient(to right, #fbbf24, #d97706);
  transition: width 0.016s linear;
}

/* Animations */
.achievement-pop-enter-active {
  animation: achievement-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.achievement-pop-leave-active {
  animation: achievement-out 0.4s ease-in forwards;
}

@keyframes achievement-in {
  0% { transform: translateY(-100px) scale(0.7); opacity: 0; }
  70% { transform: translateY(10px) scale(1.05); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}

@keyframes achievement-out {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.8) translateY(-20px); opacity: 0; }
}
</style>
