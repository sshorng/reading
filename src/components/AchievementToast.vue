<template>
  <div class="achievement-toast-container fixed top-10 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
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
            <!-- 移除文字截斷，確保顯示完整 -->
            <p class="achievement-desc">{{ currentAchievement.description }}</p>
            
            <button @click="closeAchievement" class="achievement-btn">
              已知悉，收下獎勵
            </button>
          </div>
          
          <div class="achievement-close" @click="closeAchievement" title="關閉">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
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

function showNext() {
  if (appStore.achievementQueue.length > 0 && !currentAchievement.value) {
    currentAchievement.value = appStore.achievementQueue.shift()
  }
}

function closeAchievement() {
  currentAchievement.value = null
  
  // 等待過渡動畫結束後顯示下一個
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
  width: 420px;
  max-width: 90vw;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(15px);
  border: 2px solid rgba(251, 191, 36, 0.4);
  border-radius: 24px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15), 
              inset 0 0 20px rgba(251, 191, 36, 0.1);
  overflow: hidden;
  position: relative;
}

.achievement-card {
  display: flex;
  align-items: flex-start;
  padding: 24px;
  gap: 20px;
}

.achievement-icon-wrapper {
  position: relative;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, #fffbeb, #fef3c7);
  border-radius: 20px;
  box-shadow: 0 8px 16px rgba(251, 191, 36, 0.25);
  flex-shrink: 0;
  margin-top: 4px;
}

.achievement-icon {
  font-size: 38px;
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
  filter: blur(12px);
  animation: pulse-aura 2.5s infinite ease-in-out;
}

@keyframes pulse-aura {
  0%, 100% { transform: scale(0.9); opacity: 0.3; }
  50% { transform: scale(1.4); opacity: 0.7; }
}

.achievement-content {
  flex-grow: 1;
  min-width: 0;
}

.achievement-label {
  font-size: 11px;
  font-weight: 800;
  color: #b45309;
  text-transform: uppercase;
  letter-spacing: 2.5px;
  margin-bottom: 4px;
}

.achievement-name {
  font-size: 20px;
  font-weight: 900;
  color: #0f172a;
  margin: 0;
  line-height: 1.25;
}

.achievement-desc {
  font-size: 14px;
  color: #475569;
  margin: 8px 0 16px 0;
  line-height: 1.5;
  /* 移除截斷，確保完整顯示 */
  word-wrap: break-word;
  white-space: normal;
}

.achievement-btn {
  background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%);
  color: white;
  font-weight: 800;
  font-size: 14px;
  padding: 10px 20px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);
}

.achievement-btn:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 15px rgba(217, 119, 6, 0.4);
}

.achievement-btn:active {
  transform: translateY(0) scale(0.98);
}

.achievement-close {
  position: absolute;
  top: 16px;
  right: 16px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  padding: 4px;
  border-radius: 50%;
}

.achievement-close:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #ef4444;
  transform: rotate(90deg);
}

/* Animations */
.achievement-pop-enter-active {
  animation: achievement-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.achievement-pop-leave-active {
  animation: achievement-out 0.4s ease-in forwards;
}

@keyframes achievement-in {
  0% { transform: translateY(-120px) scale(0.6); opacity: 0; }
  70% { transform: translateY(15px) scale(1.08); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}

@keyframes achievement-out {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.7) translateY(-30px); opacity: 0; }
}
</style>
