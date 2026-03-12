<template>
  <div class="min-h-screen flex items-center justify-center p-4 login-background">
    <div class="login-card">
      <div class="text-center mb-8">
        <h1 class="login-title">書院開筆</h1>
        <p class="login-subtitle">
          {{ loginType === 'student' ? '擇一學堂，入座啟程。' : '夫子講堂，傳道授業。' }}
        </p>
      </div>
      
      <!-- Student Login Form -->
      <div v-if="loginType === 'student'" class="space-y-6">
        <div>
          <label class="block text-sm font-bold text-gray-600 mb-2">選擇學堂 (班級)</label>
          <select v-model="selectedClass" :disabled="loading" class="form-element-ink">
            <option value="">{{ loading ? '載入中...' : '選擇一個學堂...' }}</option>
            <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.className }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-bold text-gray-600 mb-2">選擇學子 (姓名)</label>
          <select v-model="selectedStudent" :disabled="loading || !selectedClass" class="form-element-ink">
            <option value="">--- 請選擇學子 ---</option>
            <option v-for="s in students" :key="s.id" :value="s.id">{{ s.seatNumber ? s.seatNumber + '號 - ' : '' }}{{ s.name }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-bold text-gray-600 mb-2">憑信（密碼）</label>
          <input type="password" v-model="studentPassword" @keyup.enter="handleStudentLogin" :disabled="loading || !selectedStudent" class="form-element-ink" placeholder="預設為班級加座號，共五碼" />
        </div>
        <button @click="handleStudentLogin" :disabled="loading || !selectedStudent || !studentPassword" class="w-full btn-primary py-3 px-4 text-lg btn-seal" :class="{ 'opacity-50': loading || !selectedStudent || !studentPassword }">
          入座啟程
        </button>
      </div>

      <!-- Teacher Login Form -->
      <div v-else class="space-y-6">
        <div>
          <label class="block text-sm font-bold text-gray-600 mb-2">夫子憑信</label>
          <input type="password" v-model="teacherPassword" @keyup.enter="handleTeacherLogin" :disabled="loading" class="form-element-ink" placeholder="請輸入夫子憑信" />
        </div>
        <button @click="handleTeacherLogin" :disabled="loading || !teacherPassword" class="w-full btn-teal py-3 px-4 text-lg btn-seal" :class="{ 'opacity-50': loading || !teacherPassword }">
          升座登堂
        </button>
      </div>

      <!-- Error Message -->
      <p v-if="errorMsg" class="text-red-500 text-sm text-center h-4 font-bold mt-4">{{ errorMsg }}</p>

      <div class="mt-8 text-center">
        <a href="#" @click.prevent="toggleLoginType" class="text-sm text-gray-500 hover:text-red-700 font-bold transition-colors">
          {{ loginType === 'student' ? '我是夫子 (教師)，前往講堂' : '我是學子，返回學堂' }}
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useAppStore } from '../stores/app'
import { fetchClasses, fetchStudentsByClass, loadStudentSubmissions } from '../services/api'
import { calculateCompletionStreak, updateLoginStreak, checkAndAwardAchievements } from '../services/achievements'
import { hashString, generateDefaultPassword } from '../utils/helpers'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/init'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const appStore = useAppStore()

const loading = ref(true)
const classes = ref([])
const students = ref([])

const loginType = ref('student') // 'student' or 'teacher'

// Student form state
const selectedClass = ref('')
const selectedStudent = ref('')
const studentPassword = ref('')

// Teacher form state
const teacherPassword = ref('')

const errorMsg = ref('')

const TEACHER_PASSWORD_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"

onMounted(async () => {
  try {
    classes.value = await fetchClasses()
  } catch (err) {
    errorMsg.value = '無法載入學堂，請重新整理'
  } finally {
    loading.value = false
  }
})

watch(selectedClass, async (newClassId) => {
  if (!newClassId) return
  students.value = []
  selectedStudent.value = ''
  loading.value = true
  errorMsg.value = ''
  try {
    students.value = await fetchStudentsByClass(newClassId)
  } catch (err) {
    errorMsg.value = '加載學子失敗'
  } finally {
    loading.value = false
  }
})

const handleStudentLogin = async () => {
  if (!selectedClass.value || !selectedStudent.value || !studentPassword.value) {
    errorMsg.value = '請填寫完整資訊'
    return
  }
  
  errorMsg.value = ''
  loading.value = true

  try {
    const classInfo = classes.value.find(c => c.id === selectedClass.value)
    const studentInfo = students.value.find(s => s.id === selectedStudent.value)
    
    if (!classInfo || !studentInfo) {
      errorMsg.value = '學堂或學子資訊有誤'
      return
    }

    const defaultPassword = generateDefaultPassword(classInfo.className, studentInfo.seatNumber)
    const passwordHashOnRecord = studentInfo.passwordHash || await hashString(defaultPassword)
    const enteredPasswordHash = await hashString(studentPassword.value)

    if (enteredPasswordHash !== passwordHashOnRecord) {
      errorMsg.value = '憑信有誤！'
      setTimeout(() => errorMsg.value = '', 3000)
      return
    }

    const userData = { 
      type: 'student', 
      studentId: selectedStudent.value, 
      name: studentInfo.name, 
      seatNumber: studentInfo.seatNumber, 
      classId: selectedClass.value, 
      className: classInfo.className,
      ...studentInfo 
    }
    
    authStore.setUser(userData)
    localStorage.setItem('tempUser', JSON.stringify(userData))

    await loadStudentSubmissions(selectedStudent.value)

    // 連續完成天數計算 + 連續登入天數計算
    try {
      const studentRef = doc(db, `classes/${selectedClass.value}/students`, selectedStudent.value)
      const updates = {}

      // 連續完成天數
      const streakUpdates = await calculateCompletionStreak(selectedStudent.value, studentInfo)
      Object.assign(updates, streakUpdates)

      // 連續登入天數
      const loginUpdates = await updateLoginStreak(selectedStudent.value, studentInfo)
      Object.assign(updates, loginUpdates)

      if (Object.keys(updates).length > 0) {
        await updateDoc(studentRef, updates)
        Object.assign(authStore.currentUser, updates)
        console.log('[Login] Updates:', updates)
      }

      // 登入後主動檢查一次成就 (例如：連續登入、全打卡)
      const awards = await checkAndAwardAchievements(
        selectedStudent.value,
        'login',
        authStore.currentUser,
        {}
      )
      if (awards && awards.length > 0) {
        awards.forEach(ach => appStore.pushAchievement(ach))
      }
    } catch (streakErr) {
      console.error('[Login] Streak/login/achievement calculation failed:', streakErr)
    }

    const redirectPath = route.query.redirect || '/'
    router.push(redirectPath)
  } catch (err) {
    console.error("Login error:", err)
    errorMsg.value = '登入失敗，請稍後再試。'
  } finally {
    loading.value = false
  }
}

const handleTeacherLogin = async () => {
  if (!teacherPassword.value) {
    errorMsg.value = '請輸入夫子憑信'
    return
  }

  errorMsg.value = ''
  loading.value = true

  try {
    const teacherUserRef = doc(db, "classes/teacher_class/students", "teacher_user")
    const teacherUserSnap = await getDoc(teacherUserRef)

    let passwordHashOnRecord
    const teacherData = teacherUserSnap.exists() ? teacherUserSnap.data() : {}

    if (teacherUserSnap.exists() && teacherData.passwordHash) {
      passwordHashOnRecord = teacherData.passwordHash
    } else {
      passwordHashOnRecord = TEACHER_PASSWORD_HASH 
    }

    const enteredPasswordHash = await hashString(teacherPassword.value)

    if (enteredPasswordHash === passwordHashOnRecord) {
      const userData = { 
        type: 'teacher', 
        name: '筱仙', 
        studentId: 'teacher_user', 
        classId: 'teacher_class', 
        className: '教師講堂', 
        ...teacherData 
      }
      
      authStore.setUser(userData)
      localStorage.setItem('tempUser', JSON.stringify(userData))
      
      await loadStudentSubmissions(userData.studentId)

      // 連續完成天數計算 + 連續登入天數計算 (老師帳號若有 studentId 也要計算)
      try {
        const teacherRef = doc(db, `classes/teacher_class/students`, "teacher_user")
        const updates = {}

        // 連續完成天數
        const streakUpdates = await calculateCompletionStreak(userData.studentId, userData)
        Object.assign(updates, streakUpdates)

        // 連續登入天數
        const loginUpdates = await updateLoginStreak(userData.studentId, userData)
        Object.assign(updates, loginUpdates)

        if (Object.keys(updates).length > 0) {
          await updateDoc(teacherRef, updates)
          Object.assign(authStore.currentUser, updates)
          console.log('[Teacher Login] Updates:', updates)
          try { localStorage.setItem('tempUser', JSON.stringify(authStore.currentUser)) } catch(e){}
        }

        // 登入後主動檢查一次成就
        const awards = await checkAndAwardAchievements(
          userData.studentId,
          'login',
          authStore.currentUser,
          {}
        )
        if (awards && awards.length > 0) {
          awards.forEach(ach => appStore.pushAchievement(ach))
        }
      } catch (streakErr) {
        console.error('[Teacher Login] Streak/login/achievement calculation failed:', streakErr)
      }
      
      const redirectPath = route.query.redirect || '/'
      router.push(redirectPath)
    } else {
      errorMsg.value = '憑信錯誤。'
    }
  } catch (error) {
    console.error("Teacher login error:", error)
    errorMsg.value = '驗證時發生錯誤。'
  } finally {
    loading.value = false
  }
}

const toggleLoginType = () => {
  loginType.value = loginType.value === 'student' ? 'teacher' : 'student'
  errorMsg.value = ''
}
</script>
