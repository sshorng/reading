<template>
  <div class="card p-6 shadow-md border border-gray-100">
    <h3 class="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
      <span class="w-2 h-6 bg-red-800 rounded-full"></span>
      系統設定與 AI 配置
    </h3>

    <div class="space-y-8">
      <!-- AI Config -->
      <section class="max-w-2xl">
        <h4 class="font-bold text-slate-600 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.674a1 1 0 00.922-.617l2.108-4.742A1 1 0 0016.445 10H14a1 1 0 01-1-1V5a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 01-1 1H4.555a1 1 0 00-.922 1.358l2.108 4.742a1 1 0 00.922.617z" /></svg>
          教師端 Gemini AI 配置 (存於雲端)
        </h4>
        
        <div class="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <div class="space-y-2">
            <label class="text-sm font-bold text-slate-500 ml-1">教師端 Gemini API 金鑰 (高權限)</label>
            <div class="relative">
              <input 
                v-model="config.teacherApiKey" 
                type="text"
                autocomplete="off"
                class="input-styled w-full font-mono text-sm"
                placeholder="在此輸入教師專用的 Gemini API Key"
              >
            </div>
            <p class="text-[10px] text-slate-400 mt-1 italic">此金鑰用於出題、生成篇章與深度解析，建議使用高額度金鑰。</p>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-bold text-slate-500 ml-1">學生端 Gemini API 金鑰 (低權限)</label>
            <div class="relative">
              <input 
                v-model="config.studentApiKey" 
                type="text"
                autocomplete="off"
                class="input-styled w-full font-mono text-sm border-teal-200 focus:border-teal-500"
                placeholder="在此輸入學生專用的 Gemini API Key (可省略)"
              >
            </div>
            <p class="text-[10px] text-teal-600/80 mt-1 italic font-bold">此金鑰僅供前台學生與「閱讀小書僮」互動使用，建議使用免費層級以控管成本。</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200/50">
            <div class="space-y-2">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">前台模型（學生端）</label>
              <input v-model="config.studentModel" type="text" class="input-styled w-full text-sm font-mono py-2" placeholder="例如: gemini-1.5-pro">
              <p class="text-[9px] text-slate-400 italic">用於對話、摘要與互動學習。</p>
            </div>
            <div class="space-y-2">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">後台模型（教師端）</label>
              <input v-model="config.teacherModel" type="text" class="input-styled w-full text-sm font-mono py-2" placeholder="例如: gemini-2.0-flash">
              <p class="text-[9px] text-slate-400 italic">用於產生篇章、題目與深度解析。</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Save Button -->
      <div class="pt-6 border-t border-gray-100 flex justify-end">
        <button @click="saveConfig" :disabled="saving" class="btn-primary py-3 px-12 font-bold shadow-lg hover:translate-y-[-2px] transition-transform">
          {{ saving ? '正在同步雲端...' : '儲存系統設定' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
const saving = ref(false)

const config = ref({
  teacherApiKey: '',
  studentApiKey: '',
  studentModel: 'gemini-1.5-flash',
  teacherModel: 'gemini-1.5-pro'
})

const saveConfig = async () => {
  saving.value = true
  try {
    await authStore.saveSystemConfig(config.value.teacherApiKey, config.value.studentApiKey, config.value.studentModel, config.value.teacherModel)
    alert('系統設定已成功同步至雲端。')
  } catch (err) {
    alert('保存失敗：' + err.message)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (!authStore.configLoaded) {
    await authStore.fetchSystemConfig()
  }
  config.value.teacherApiKey = authStore.teacherApiKey || ''
  config.value.studentApiKey = authStore.studentApiKey || ''
  config.value.studentModel = authStore.studentGeminiModel || 'gemini-1.5-flash'
  config.value.teacherModel = authStore.teacherGeminiModel || 'gemini-1.5-pro'
})
</script>
