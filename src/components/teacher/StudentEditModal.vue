<template>
  <div v-if="isVisible" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[250] animate-fade-in p-4" @click.self="$emit('close')">
    <div class="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl space-y-6 border border-gray-100 animate-slide-up relative">
      <button @click="$emit('close')" class="absolute top-6 right-6 text-gray-400 hover:text-red-800 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>

      <div class="space-y-2">
        <h3 class="text-xl font-black text-gray-800 flex items-center gap-2">
          <span class="w-2 h-6 bg-red-800 rounded-full"></span>
          修訂學籍資料
        </h3>
        <p class="text-xs text-gray-400 italic">更正學子之座號或姓名編組。</p>
      </div>

      <div class="space-y-5">
        <div class="space-y-1.5">
          <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">座位編號</label>
          <div class="relative">
            <input v-model.number="form.seatNumber" type="number" class="input-styled w-full pl-10 pr-4 py-3 font-bold" placeholder="座號">
            <svg class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16" /></svg>
          </div>
        </div>
        <div class="space-y-1.5">
          <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">學子姓名</label>
          <div class="relative">
            <input v-model.trim="form.name" type="text" class="input-styled w-full pl-10 pr-4 py-3 font-bold" placeholder="姓名">
            <svg class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
        </div>
        <div class="space-y-2 pt-2 border-t border-slate-100">
          <label class="flex items-center gap-3 cursor-pointer group">
            <div class="relative flex items-center">
              <input type="checkbox" v-model="form.isExempted" class="peer sr-only">
              <div class="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-teal-700 transition-colors"></div>
              <div class="absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
            </div>
            <div class="flex flex-col">
              <span class="text-sm font-bold text-slate-700 group-hover:text-teal-700 transition-colors">暫停考核 (免修生)</span>
              <span class="text-[10px] text-slate-400">開啟後不再列入逾期催收名單</span>
            </div>
          </label>
        </div>
      </div>

      <div class="flex gap-3 pt-4">
        <button @click="$emit('close')" class="btn-secondary flex-1 py-3.5 text-sm font-bold">先不修訂</button>
        <button @click="handleSave" :disabled="saving" class="btn-primary flex-[2] py-3.5 text-sm font-black shadow-lg">
          <span v-if="saving" class="loader-sm w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          {{ saving ? '銘刻雲端中...' : '儲存變更' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/init'

const props = defineProps({
  isVisible: Boolean,
  studentData: Object,
  classId: String
})

const emit = defineEmits(['close', 'success'])

const form = ref({ name: '', seatNumber: 0, isExempted: false })
const saving = ref(false)

watch(() => props.studentData, (newData) => {
  if (newData) {
    form.value = { ...newData }
  }
}, { immediate: true })

const handleSave = async () => {
  if (!form.value.name || isNaN(form.value.seatNumber)) {
    return alert('請完整填寫座號與姓名。')
  }
  saving.value = true
  try {
    const { id, name, seatNumber, isExempted } = form.value
    await updateDoc(doc(db, `classes/${props.classId}/students`, id), { 
      name, 
      seatNumber, 
      isExempted: !!isExempted 
    })
    emit('success')
    emit('close')
  } catch (err) {
    alert('儲存失敗：' + err.message)
  } finally {
    saving.value = false
  }
}
</script>
