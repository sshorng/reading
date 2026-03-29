import { getDocs, query, collection, where, limit, orderBy, doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/init'
import { useAuthStore } from '../stores/auth'
import { useDataStore } from '../stores/data'

export async function saveSubmission(submissionData) {
    const { assignmentId, score, answers, durationSeconds } = submissionData
    const authStore = useAuthStore()
    const dataStore = useDataStore()
    const studentId = authStore.currentUser?.studentId

    if (!studentId) return

    const submissionId = `${studentId}_${assignmentId}`
    const submissionRef = doc(db, "submissions", submissionId)

    const attempt = {
        score,
        answers,
        durationSeconds,
        submittedAt: new Date()
    }

    try {
        const docSnap = await getDoc(submissionRef)
        if (docSnap.exists()) {
            await updateDoc(submissionRef, {
                attempts: arrayUnion(attempt),
                score: Math.max(docSnap.data().score || 0, score),
                lastSubmittedAt: attempt.submittedAt
            })
            // 重考同一篇文章：不影響連續高分 streak
        } else {
            await setDoc(submissionRef, {
                studentId,
                assignmentId,
                score,
                answers, // Latest answers
                durationSeconds, // Latest duration
                attempts: [attempt],
                submittedAt: attempt.submittedAt,
                lastSubmittedAt: attempt.submittedAt
            })

            // 高分連續次數更新 — 僅首次作答時才計算
            const studentRef = doc(db, `classes/${authStore.currentUser.classId}/students`, studentId)
            const studentSnap = await getDoc(studentRef)
            if (studentSnap.exists()) {
                const studentData = studentSnap.data()
                const newHighScoreStreak = score >= 80 ? (studentData.highScoreStreak || 0) + 1 : 0
                await updateDoc(studentRef, { highScoreStreak: newHighScoreStreak })
                authStore.currentUser.highScoreStreak = newHighScoreStreak
                try { localStorage.setItem('tempUser', JSON.stringify(authStore.currentUser)) } catch(e){}
            }
        }

        // Refresh local store
        await loadStudentSubmissions(studentId)
        return true
    } catch (error) {
        console.error("Error saving submission:", error)
        return false
    }
}

export async function fetchClasses() {
    const q = query(collection(db, "classes"))
    const snapshot = await getDocs(q)
    const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    return classes.sort((a, b) => a.className.localeCompare(b.className, 'zh-Hant'))
}

export async function loadStudentSubmissions(studentId) {
    if (!studentId) return []
    const submissionsQuery = query(
        collection(db, "submissions"),
        where('studentId', '==', studentId),
        limit(300)
    )
    try {
        const snapshot = await getDocs(submissionsQuery)
        const submissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        const dataStore = useDataStore()
        dataStore.allSubmissions = submissions // Pinia store handles this nicely if it's a ref returned from setup
        return submissions
    } catch (error) {
        console.error("Error fetching student submissions:", error)
        return []
    }
}

export async function fetchStudentsByClass(classId) {
    if (!classId) return []
    const q = query(collection(db, `classes/${classId}/students`), orderBy('seatNumber'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function fetchAllSubmissionsByClass(classId) {
    if (!classId) return []
    const q = query(
        collection(db, "submissions"),
        where('studentId', '>=', `${classId}_`),
        where('studentId', '<=', `${classId}_\uf8ff`)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// Memory cache for global assignments
let cachedAssignments = null;
let lastFetchTime = 0;
let cachedAssignmentsPromise = null; // 🛡️ 處理同時發出的請求快取

export async function getAssignments(forceRefresh = false) {
    const now = Date.now()
    const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

    // 1. 如果有現成的記憶體快取且未過期，直接回傳
    if (!forceRefresh && cachedAssignments && (now - lastFetchTime < CACHE_DURATION)) {
        return cachedAssignments
    }

    // 2. 🛡️ 處理 In-flight 請求：如果目前正在抓取中，回傳同一個 Promise
    if (cachedAssignmentsPromise && !forceRefresh) {
        return cachedAssignmentsPromise
    }

    // 3. 建立抓取任務
    cachedAssignmentsPromise = (async () => {
        try {
            console.log('[API] Fetching all assignments from Firestore...')
            const assignmentsSnapshot = await getDocs(collection(db, "assignments"))
            const assignments = assignmentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))

            cachedAssignments = assignments
            lastFetchTime = Date.now()
            return assignments
        } catch (err) {
            console.error("Error fetching assignments:", err)
            return []
        } finally {
            cachedAssignmentsPromise = null // 任務結束後清空，允許下次調度
        }
    })()

    return cachedAssignmentsPromise
}

export async function getAssignmentById(id) {
    if (!id) return null
    try {
        const docRef = doc(db, "assignments", id)
        const snap = await getDoc(docRef)
        return snap.exists() ? { id: snap.id, ...snap.data() } : null
    } catch (err) {
        console.error("Error fetching assignment:", err)
        return null
    }
}

// AI Help 統一使用 ai.js 的 generateAiHelp
export { generateAiHelp as callAiHelp } from './ai'
