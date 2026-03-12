<template>
  <div v-if="isVisible" class="fixed inset-0 z-[100] overflow-y-auto">
    <div class="flex items-center justify-center min-h-screen p-4">
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" @click="closeModal"></div>
      <div class="relative z-10 bg-white rounded-[2rem] w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden animate-slide-up border border-gray-100">
         <div class="bg-slate-50/80 px-10 py-8 border-b flex justify-between items-center">
           <div>
             <h3 class="text-2xl font-black text-gray-800">{{ isEditing ? '修訂成就規則' : '創設新成就' }}</h3>
             <p class="text-xs text-gray-400 mt-1 italic">依才定賞，AI 亦可助興生成。</p>
           </div>
           <button @click="closeModal" class="text-gray-300 hover:text-red-800 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
         </div>
         
         <div class="px-10 py-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div class="md:col-span-1 space-y-2">
                 <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">象徵圖騰</label>
                 <div class="relative group">
                   <input v-model="form.icon" type="text" class="input-styled w-full text-center text-4xl h-24 bg-slate-50 border-dashed hover:bg-white transition-all rounded-2xl" placeholder="🏆">
                   <div class="absolute inset-0 pointer-events-none border-2 border-transparent group-focus-within:border-red-800/10 rounded-2xl transition-all"></div>
                 </div>
              </div>
              <div class="md:col-span-3 space-y-6">
                 <div class="space-y-2">
                   <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">名號</label>
                   <input v-model="form.name" type="text" class="input-styled w-full py-3 px-4 font-bold text-lg" placeholder="例如：博學篤志">
                 </div>
                 <div class="space-y-2">
                   <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">描述（銘文）</label>
                   <textarea v-model="form.description" rows="2" class="input-styled w-full py-3 px-4 text-sm leading-relaxed" placeholder="立意、期許或獲獎後的讚詞"></textarea>
                 </div>
              </div>
            </div>

            <!-- Conditions -->
            <div class="space-y-4 pt-4">
               <div class="flex justify-between items-center border-b border-gray-100 pb-2">
                 <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">獲取機理（條件）</label>
                 <button @click="addCondition" class="text-red-800 hover:scale-105 active:scale-95 font-black text-xs flex items-center gap-1 transition-transform">
                   <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>
                   新增成就門檻
                 </button>
               </div>
               <div class="space-y-3">
                 <div v-for="(cond, idx) in form.conditions" :key="idx" class="flex gap-2 animate-fade-in group items-center">
                    <div class="flex-grow flex gap-2 p-2 bg-slate-50 rounded-xl border border-transparent hover:border-slate-200 transition-colors">
                      <select v-model="cond.type" class="bg-transparent border-none focus:ring-0 flex-grow text-sm py-1 font-bold text-slate-700">
                         <option value="" disabled>-- 選擇條件類型 --</option>
                         <optgroup v-for="grp in conditionOptions" :key="grp.label" :label="grp.label">
                           <option v-for="opt in grp.options" :key="opt.value" :value="opt.value">{{ opt.text }}</option>
                         </optgroup>
                      </select>
                      <div class="flex items-center gap-1.5 px-3 border-l border-slate-200">
                        <span class="text-[10px] font-bold text-slate-400">≥</span>
                        <input v-if="!['first_login'].includes(cond.type)" v-model.number="cond.value" type="number" class="bg-transparent border-none focus:ring-0 w-16 text-right text-sm py-1 font-mono font-bold text-red-800" placeholder="目標">
                      </div>
                    </div>
                    <button @click="removeCondition(idx)" class="p-2.5 text-slate-300 hover:text-rose-600 transition-colors rounded-full hover:bg-rose-50">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                 </div>
                 <p v-if="form.conditions.length === 0" class="text-xs text-slate-400 italic text-center py-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">夫子，目前尚無定例條件。滿足任意學習行為即可獲賞。</p>
               </div>
            </div>

            <!-- Options -->
            <div class="flex flex-wrap gap-8 pt-6 border-t border-gray-100">
               <label class="flex items-center gap-3 cursor-pointer group">
                  <div class="relative flex items-center">
                    <input v-model="form.isEnabled" type="checkbox" class="peer h-5 w-5 rounded-md border-gray-300 text-red-800 focus:ring-red-400 transition-all">
                  </div>
                  <span class="text-sm font-black text-slate-600 group-hover:text-red-800 transition-colors">即刻宣示（啟用）</span>
               </label>
               <label class="flex items-center gap-3 cursor-pointer group">
                  <input v-model="form.isHidden" type="checkbox" class="h-5 w-5 rounded-md border-gray-300 text-red-800 focus:ring-red-400 transition-all">
                  <span class="text-sm font-black text-slate-600 group-hover:text-red-800 transition-colors">祕傳獎章（隱藏）</span>
               </label>
               <label class="flex items-center gap-3 cursor-pointer group">
                  <input v-model="form.isRepeatable" type="checkbox" class="h-5 w-5 rounded-md border-gray-300 text-red-800 focus:ring-red-400 transition-all">
                  <span class="text-sm font-black text-slate-600 group-hover:text-red-800 transition-colors">累進獲取（多重頒授）</span>
               </label>
            </div>
         </div>

         <div class="px-10 py-8 bg-slate-50/80 border-t flex flex-col sm:flex-row gap-4">
            <button @click="autoGenerateAchievement" :disabled="generatingAI" class="btn-secondary py-4 font-black border-2 border-dashed border-indigo-200 text-indigo-700 hover:bg-white hover:border-indigo-400 flex-1 whitespace-nowrap flex items-center justify-center gap-2 shadow-sm">
              <span v-if="generatingAI" class="loader-sm w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></span>
              <span v-else>✨ AI 隨機創設案</span>
            </button>
            <div class="flex gap-3 sm:flex-[2]">
              <button @click="closeModal" class="btn-secondary flex-1 py-4 font-bold text-slate-500">罷了</button>
              <button @click="handleSave" :disabled="saving" class="btn-primary flex-[2] py-4 font-black shadow-xl shadow-red-100 flex items-center justify-center gap-2">
                <span v-if="saving" class="loader-sm w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></span>
                {{ isEditing ? '確認銘刻更新' : '完成成就創設' }}
              </button>
            </div>
         </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/init'
import { callGenerativeAI } from '../../services/ai'

const props = defineProps({
  isVisible: Boolean,
  editingData: Object,
  isEditing: Boolean
})

const emit = defineEmits(['close', 'success'])

const form = ref({
  name: '', description: '', icon: '🏆',
  isEnabled: true, isHidden: false, isRepeatable: false,
  conditions: []
})
const saving = ref(false)
const generatingAI = ref(false)

const conditionOptions = [
    { 
        label: '【基礎與廣度】', 
        options: [
            { value: 'submission_count', text: '總閱讀篇數 (篇)' },
            { value: 'genre_explorer', text: '文體全通 (完成 N 種不同文體)' },
            { value: 'unique_formats_read', text: '形式大師 (完成 N 種不同形式)' },
            ...['記敘', '抒情', '說明', '議論', '應用'].map(tag => ({ value: `read_tag_contentType_${tag}`, text: `完成「${tag}」文章數 (篇)` })),
            ...['基礎', '普通', '進階', '困難'].map(tag => ({ value: `read_tag_difficulty_${tag}`, text: `完成「${tag}」難度數 (篇)` }))
        ] 
    },
    { 
        label: '【精準與品質】(嚴看初考)', 
        options: [
            { value: 'high_score_streak', text: '連續高分次數 (次)' }, 
            { value: 'average_score', text: '歷史初考總平均達標 (分)' }, 
            { value: 'first_try_min_score', text: '單篇「初考」達標指定分數 (一次即解鎖)' }
        ] 
    },
    { 
        label: '【毅力與重修】(鼓勵練習)', 
        options: [
            { value: 'perfect_score_count', text: '最終獲得 100 分的總篇數 (篇)' }, 
            { value: 'recovery_count', text: '初考不及格，但最終滿分的總篇數 (篇)' }, 
            { value: 'min_retry_count', text: '單篇重考超過 N 次且及格 (一次即解鎖)' }
        ] 
    },
    { 
        label: '【恆心與進階】', 
        options: [
            { value: 'login_streak', text: '連續登入天數 (天)' }, 
            { value: 'completion_streak', text: '課業全清連續天數 (天)' }, 
            { value: 'weekly_progress', text: '本週進步與否 (無需填數值)' }
        ] 
    },
    { 
        label: '【效率與作息】(特殊模組)', 
        options: [
            { value: 'speed_under_seconds', text: '單篇極速完賽短於 N 秒且及格 (一次即解鎖)' }, 
            { value: 'duration_over_seconds', text: '長篇細讀作答長於 N 秒且及格 (一次即解鎖)' }, 
            { value: 'days_before_deadline', text: '未雨綢繆：在期限前提早 N 天交卷 (一次即解鎖)' }, 
            { value: 'off_hours_count', text: '深夜或極早晨交卷的總篇數 (篇)' }
        ] 
    }
]

watch([() => props.isVisible, () => props.editingData], ([newVisible, newData]) => {
  if (newVisible) {
    if (newData) {
      form.value = JSON.parse(JSON.stringify(newData))
    } else {
      form.value = { name: '', description: '', icon: '🏆', isEnabled: true, isHidden: false, isRepeatable: false, conditions: [] }
    }
  }
}, { immediate: true })

const closeModal = () => emit('close')

const addCondition = () => form.value.conditions.push({ type: '', value: 0 })
const removeCondition = (idx) => form.value.conditions.splice(idx, 1)

const handleSave = async () => {
  if (!form.value.name || !form.value.description) return alert('名號與描述為創設成就之必需。')
  saving.value = true
  try {
    if (props.isEditing) {
      const { id, ...payload } = form.value
      await updateDoc(doc(db, 'achievements', id), { ...payload, updatedAt: serverTimestamp() })
    } else {
      await addDoc(collection(db, 'achievements'), { ...form.value, createdAt: serverTimestamp() })
    }
    emit('success')
    closeModal()
  } catch (err) {
    alert('創設失敗：' + err.message)
  } finally {
    saving.value = false
  }
}

const autoGenerateAchievement = async () => {
    generatingAI.value = true
    try {
        const hasExistingConditions = form.value.conditions && form.value.conditions.length > 0;
        
        let conditionPrompt = '';
        if (hasExistingConditions) {
            conditionPrompt = `目前的成就已經鎖定了以下條件架構：\n${JSON.stringify(form.value.conditions, null, 2)}\n請務必「保留這些 type」，你只能負責幫忙決定合理的數值 (value) 以及發想名稱與描述，絕對不能發明新的 type。`;
        } else {
            conditionPrompt = `目前沒有設定條件，請你從以下合法的條件模組 (type) 中，挑選 1 到 2 個來組合，並賦予合理的數值 (value)：
【合法 type 列表】：
- submission_count (總閱讀篇數)
- genre_explorer (讀過幾種不同文體)
- unique_formats_read (讀過幾種不同形式)
- high_score_streak (連續幾次高分)
- average_score (歷史初考總平均達幾分)
- first_try_min_score (單篇初考達幾分)
- perfect_score_count (最終滿分的總篇數)
- recovery_count (不及格後訂正到滿分的總篇數)
- min_retry_count (單篇重考超過幾次且及格)
- login_streak (連續登入天數)
- completion_streak (進度全清連續天數)
- speed_under_seconds (作答短於幾秒且及格)
- duration_over_seconds (作答長於幾秒且及格)
- days_before_deadline (提早幾天交卷)
- off_hours_count (深夜或極早晨交卷篇數)
- read_tag_contentType_記敘 (或抒情/說明/議論/應用)
- read_tag_difficulty_普通 (或基礎/進階/困難)

警告：絕對不可發明上列以外的 type 屬性！`;
        }

        const prompt = `你是一位學識淵博、充滿想像力的書院總教習。請為學習系統設計一個充滿創意與文藝氣息的成就。
設定名號需優雅典雅，脫離呆板。描述應如古人策勵般動人，結尾括號中可以用一句白話文解釋條件。
${conditionPrompt}

請傳回 JSON 格式，必須包含：
{
  "name": "成就名稱(字數勿太長)",
  "description": "文雅的描述語 (達成條件)",
  "icon": "單一個emoji符號",
  "reasoning": "給總教習(我)的一句設計理念解說",
  "conditions": [{ "type": "合法的type代碼", "value": 數字 }]
}`;
        
        const schema = {
            type: "OBJECT",
            properties: {
                name: { type: "STRING" },
                description: { type: "STRING" },
                icon: { type: "STRING" },
                reasoning: { type: "STRING" },
                conditions: { type: "ARRAY", items: { type: "OBJECT", properties: { type: { type: "STRING" }, value: { type: "NUMBER" } } } }
            },
            required: ["name", "description", "icon", "reasoning", "conditions"]
        };

        const res = await callGenerativeAI(prompt, null, schema, 'teacher');
        const data = JSON.parse(res);
        form.value.name = data.name;
        form.value.description = data.description;
        form.value.icon = data.icon;
        
        // 修正：如果夫子已經手動加了條件，不要讓 AI 覆蓋掉夫子的條件邏輯
        if (!hasExistingConditions && data.conditions && data.conditions.length > 0) {
            form.value.conditions = data.conditions;
        }
        
        alert(`AI 夫子諫言：\n${data.reasoning}`);
    } catch (e) {
        console.error(e)
        alert('AI 創思受阻，請稍後。')
    } finally {
        generatingAI.value = false
    }
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 5px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
</style>
