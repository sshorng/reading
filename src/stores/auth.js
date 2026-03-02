import { defineStore } from 'pinia'
import { ref } from 'vue'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection } from 'firebase/firestore'
import { db } from '../firebase/init'

export const useAuthStore = defineStore('auth', () => {
    const currentUser = ref(null)
    const allClasses = ref([])

    // AI Configs (Teacher side)
    const geminiApiKey = ref('')
    const teacherGeminiModel = ref('gemini-3-flash-preview')
    const studentGeminiModel = ref('gemini-2.5-flash-lite')
    const configLoaded = ref(false)

    function setUser(user) {
        currentUser.value = user
    }

    function setClasses(classes) {
        allClasses.value = classes
    }

    function logout() {
        currentUser.value = null
    }

    /**
     * 從資料庫載入系統配置 (匹配原版 settings/api_keys)
     */
    async function fetchSystemConfig() {
        try {
            const docRef = doc(db, 'settings', 'api_keys')
            const snap = await getDoc(docRef)

            if (snap.exists()) {
                const data = snap.data()
                geminiApiKey.value = data.gemini || ''
                studentGeminiModel.value = data.model || 'gemini-2.5-flash-lite'
                teacherGeminiModel.value = data.teacherModel || 'gemini-3-flash-preview'
            }
            configLoaded.value = true
        } catch (err) {
            console.error("Fetch API Config failed:", err)
        }
    }

    /**
     * 保存系統配置回資料庫 (匹配原版 settings/api_keys)
     */
    async function saveSystemConfig(key, studentModel, teacherModel) {
        try {
            const docRef = doc(db, 'settings', 'api_keys')
            await setDoc(docRef, {
                gemini: key,
                model: studentModel,
                teacherModel: teacherModel,
                updatedAt: new Date()
            }, { merge: true })

            geminiApiKey.value = key
            studentGeminiModel.value = studentModel
            teacherGeminiModel.value = teacherModel
            return true
        } catch (err) {
            console.error("Save API Config failed:", err)
            throw err
        }
    }

    /**
     * 新增班級 / 學堂
     */
    async function addClass(className) {
        try {
            const classRef = doc(collection(db, 'classes'))
            await setDoc(classRef, {
                className,
                teacherId: currentUser.value?.uid || 'teacher_user',
                createdAt: new Date()
            })
            // Fetch all classes again to refresh
            return classRef.id
        } catch (err) {
            console.error("Add class failed:", err)
            throw err
        }
    }

    /**
     * 修訂班級名稱
     */
    async function updateClassName(classId, className) {
        try {
            const docRef = doc(db, 'classes', classId)
            await updateDoc(docRef, { className })
        } catch (err) {
            console.error("Update class name failed:", err)
            throw err
        }
    }

    /**
     * 刪除班級
     */
    async function deleteClass(classId) {
        try {
            const docRef = doc(db, 'classes', classId)
            await deleteDoc(docRef)
        } catch (err) {
            console.error("Delete class failed:", err)
            throw err
        }
    }

    return {
        currentUser,
        allClasses,
        geminiApiKey,
        teacherGeminiModel,
        studentGeminiModel,
        configLoaded,
        setUser,
        setClasses,
        saveSystemConfig,
        fetchSystemConfig,
        logout,
        addClass,
        updateClassName,
        deleteClass
    }
})
