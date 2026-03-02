<template>
  <div v-if="isVisible" class="fixed inset-0 z-[100] overflow-y-auto">
    <div class="flex items-center justify-center min-h-screen p-4">
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>
      <div class="relative z-10 bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-slide-up border border-gray-100">

        <!-- Header -->
        <div class="bg-slate-50/80 px-8 py-6 border-b flex justify-between items-center">
          <h2 class="text-xl font-black text-slate-800 flex items-center gap-3">
            <span class="w-2 h-8 bg-red-800 rounded-full"></span>
            修訂密語
          </h2>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-red-800 rounded-full hover:bg-red-50 transition-all">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Body -->
        <div class="px-8 py-8 space-y-6">
          <div class="space-y-2">
            <label class="text-sm font-bold text-slate-600 ml-1">舊密語</label>
            <input v-model="currentPassword" type="password" class="input-styled w-full" placeholder="請輸入目前的密語" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-bold text-slate-600 ml-1">新密語</label>
            <input v-model="newPassword" type="password" class="input-styled w-full" placeholder="至少四個字元" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-bold text-slate-600 ml-1">確認新密語</label>
            <input v-model="confirmPassword" type="password" class="input-styled w-full" placeholder="再次輸入新密語" @keyup.enter="handleChange" />
          </div>

          <p v-if="errorMsg" class="text-red-500 text-sm font-bold text-center">{{ errorMsg }}</p>
          <p v-if="successMsg" class="text-green-600 text-sm font-bold text-center">{{ successMsg }}</p>
        </div>

        <!-- Footer -->
        <div class="px-8 py-6 bg-slate-50/80 border-t flex justify-end gap-4">
          <button @click="$emit('close')" class="btn-secondary py-2.5 px-8 font-bold">取消</button>
          <button @click="handleChange" :disabled="saving" class="btn-primary py-2.5 px-8 font-bold shadow-lg hover:translate-y-[-1px] transition-transform">
            {{ saving ? '正在更新...' : '確認修訂' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/init'
import { useAuthStore } from '../stores/auth'
import { hashString, generateDefaultPassword } from '../utils/helpers'

const TEACHER_PASSWORD_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"

defineProps({
  isVisible: { type: Boolean, default: false }
})
const emit = defineEmits(['close'])

const authStore = useAuthStore()
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const errorMsg = ref('')
const successMsg = ref('')
const saving = ref(false)

const handleChange = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    errorMsg.value = '所有欄位皆為必填。'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMsg.value = '新密語與確認密語不相符。'
    return
  }
  if (newPassword.value.length < 4) {
    errorMsg.value = '新密語長度至少需要四個字元。'
    return
  }

  saving.value = true

  try {
    const user = authStore.currentUser
    if (!user) throw new Error('User not logged in.')

    if (user.type === 'teacher') {
      // 教師修改密碼
      const teacherRef = doc(db, 'classes/teacher_class/students', 'teacher_user')
      const teacherSnap = await getDoc(teacherRef)

      let currentHash
      if (teacherSnap.exists() && teacherSnap.data().passwordHash) {
        currentHash = teacherSnap.data().passwordHash
      } else {
        currentHash = TEACHER_PASSWORD_HASH
      }

      const enteredHash = await hashString(currentPassword.value)
      if (enteredHash !== currentHash) {
        errorMsg.value = '舊密語錯誤。'
        return
      }

      const newHash = await hashString(newPassword.value)
      await setDoc(teacherRef, { passwordHash: newHash }, { merge: true })
      successMsg.value = '憑信已成功修訂！'
      setTimeout(() => emit('close'), 1500)

    } else if (user.type === 'student') {
      // 學生修改密碼
      const studentRef = doc(db, `classes/${user.classId}/students`, user.studentId)
      const studentSnap = await getDoc(studentRef)

      if (!studentSnap.exists()) {
        errorMsg.value = '找不到您的學生資料。'
        return
      }

      const studentData = studentSnap.data()
      const selectedClass = authStore.allClasses?.find(c => c.id === user.classId)
      const defaultPass = generateDefaultPassword(selectedClass?.className || user.className || '', studentData.seatNumber)
      const currentHashOnRecord = studentData.passwordHash || await hashString(defaultPass)
      const enteredHash = await hashString(currentPassword.value)

      if (enteredHash !== currentHashOnRecord) {
        errorMsg.value = '舊密語有誤。'
        return
      }

      const newHash = await hashString(newPassword.value)
      await updateDoc(studentRef, { passwordHash: newHash })
      successMsg.value = '憑信已成功修訂！'
      setTimeout(() => emit('close'), 1500)
    }
  } catch (error) {
    console.error('Password change failed:', error)
    errorMsg.value = '更新密語時發生錯誤。'
  } finally {
    saving.value = false
  }
}
</script>
