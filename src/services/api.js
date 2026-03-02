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
                lastSubmittedAt: serverTimestamp()
            })
        } else {
            await setDoc(submissionRef, {
                studentId,
                assignmentId,
                score,
                answers, // Latest answers
                durationSeconds, // Latest duration
                attempts: [attempt],
                submittedAt: serverTimestamp(),
                lastSubmittedAt: serverTimestamp()
            })
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

export async function getAssignments(forceRefresh = false) {
    const now = Date.now()
    const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

    if (!forceRefresh && cachedAssignments && (now - lastFetchTime < CACHE_DURATION)) {
        return cachedAssignments
    }

    try {
        const assignmentsSnapshot = await getDocs(query(collection(db, "assignments"), orderBy("createdAt", "desc")))
        const assignments = assignmentsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }))

        cachedAssignments = assignments
        lastFetchTime = now
        return assignments
    } catch (err) {
        console.error("Error fetching assignments:", err)
        return []
    }
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
