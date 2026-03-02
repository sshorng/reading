/**
 * 成就自動頒發與連續完成天數 — 移植自備份版 student.js / scripts.js
 */
import { collection, query, where, getDocs, doc, addDoc, updateDoc, Timestamp, orderBy } from 'firebase/firestore'
import { db } from '../firebase/init'
import { loadStudentSubmissions } from './api'
import { getLocalDateString } from '../utils/helpers'

// ─── 輔助函式 ───

function getStartOfWeek(date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
}

function getWeekId(date) {
    const startOfWeek = getStartOfWeek(date)
    const y = startOfWeek.getFullYear()
    const firstDay = new Date(y, 0, 1)
    const pastDays = (startOfWeek - firstDay) / 86400000
    const weekNum = Math.ceil((pastDays + firstDay.getDay() + 1) / 7)
    return `${y}-W${String(weekNum).padStart(2, '0')}`
}

// ─── 成就檢查核心 ───

/**
 * 檢查並自動頒發成就
 * @param {string} studentId   - 學生 ID
 * @param {string} eventType   - 觸發事件類型，例如 'quiz_submit'
 * @param {Object} studentData - 學生文件資料（含 classId, name 等）
 * @param {Object} eventData   - 額外事件資料（可選，含 submissions）
 * @returns {Promise<number>}  - 本次新解鎖的成就數量
 */
export async function checkAndAwardAchievements(studentId, eventType, studentData, eventData = {}) {
    console.log(`[Achievement] Checking for ${studentData.name}, event: ${eventType}`)
    if (!studentId || !studentData) return 0
    let unlockedCount = 0

    // 檢查單一條件
    async function checkSingleCondition(condition, sData, evType, subs, evData) {
        let isMet = false
        const value = parseInt(condition.value, 10)
        if (condition.type !== 'weekly_progress' && isNaN(value)) return false

        switch (condition.type) {
            case 'submission_count':
                if (subs && subs.length >= value) isMet = true
                break
            case 'login_streak':
                if ((sData.loginStreak || 0) >= value) isMet = true
                break
            case 'high_score_streak':
                if ((sData.highScoreStreak || 0) >= value) isMet = true
                break
            case 'completion_streak':
                if ((sData.completionStreak || 0) >= value) isMet = true
                break
            case 'average_score':
                if (subs && subs.length > 0) {
                    const totalScore = subs.reduce((sum, s) => {
                        const first = (s.attempts && s.attempts.length > 0) ? s.attempts[0].score : (s.score || 0)
                        return sum + first
                    }, 0)
                    if ((totalScore / subs.length) >= value) isMet = true
                }
                break
            case 'genre_explorer': {
                const tagCounts = sData.tagReadCounts || {}
                const completedGenres = Object.keys(tagCounts).filter(key => key.startsWith('contentType_')).length
                if (completedGenres >= value) isMet = true
                break
            }
            case 'weekly_progress': {
                const now = new Date()
                const currentWeekId = getWeekId(now)
                if (sData.lastProgressCheckWeekId === currentWeekId) break
                // 更新 check 標記
                const studentRef = doc(db, `classes/${sData.classId}/students`, studentId)
                updateDoc(studentRef, { lastProgressCheckWeekId: currentWeekId }).catch(console.error)
                const startOfThisWeek = getStartOfWeek(now)
                const startOfLastWeek = new Date(startOfThisWeek.getTime() - 7 * 24 * 60 * 60 * 1000)
                const endOfLastWeek = new Date(startOfThisWeek.getTime() - 1)
                const startOfPrevWeek = new Date(startOfLastWeek.getTime() - 7 * 24 * 60 * 60 * 1000)
                const endOfPrevWeek = new Date(startOfLastWeek.getTime() - 1)
                const lastWeekSubs = subs.filter(s => {
                    const d = s.submittedAt?.toDate ? s.submittedAt.toDate() : new Date(s.submittedAt)
                    return d >= startOfLastWeek && d <= endOfLastWeek
                })
                const prevWeekSubs = subs.filter(s => {
                    const d = s.submittedAt?.toDate ? s.submittedAt.toDate() : new Date(s.submittedAt)
                    return d >= startOfPrevWeek && d <= endOfPrevWeek
                })
                const getFirst = (s) => (s.attempts && s.attempts.length > 0) ? s.attempts[0].score : (s.score || 0)
                const lastWeekTotal = lastWeekSubs.reduce((sum, s) => sum + getFirst(s), 0)
                const prevWeekTotal = prevWeekSubs.reduce((sum, s) => sum + getFirst(s), 0)
                if (lastWeekTotal > 0 && lastWeekTotal > prevWeekTotal) isMet = true
                break
            }
            default:
                // read_tag_* 類別
                if (condition.type && condition.type.startsWith('read_tag_')) {
                    const key = condition.type.replace('read_tag_', '')
                    const tagCount = (sData.tagReadCounts || {})[key] || 0
                    if (tagCount >= value) isMet = true
                }
                break
        }
        return isMet
    }

    try {
        // 取得所有啟用中的成就
        const achievementsQuery = query(collection(db, 'achievements'), where('isEnabled', '==', true))
        const achievementsSnapshot = await getDocs(achievementsQuery)
        if (achievementsSnapshot.empty) return 0
        const allAchievements = achievementsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))

        // 取得已解鎖的成就
        const unlockedQuery = query(collection(db, 'student_achievements'), where('studentId', '==', studentId))
        const unlockedSnapshot = await getDocs(unlockedQuery)
        const unlockedMap = new Map(unlockedSnapshot.docs.map(d => [d.data().achievementId, true]))

        // 依需要取得提交記錄
        let studentSubmissions = eventData.submissions || null
        if (studentSubmissions === null) {
            const needsSubs = allAchievements.some(ach => {
                if (!ach.isRepeatable && unlockedMap.has(ach.id)) return false
                const conditions = ach.conditions || []
                return conditions.some(c =>
                    c.type?.includes('score') ||
                    c.type === 'submission_count' ||
                    c.type?.includes('tag') ||
                    c.type === 'weekly_progress'
                )
            })
            if (needsSubs) {
                studentSubmissions = await loadStudentSubmissions(studentId)
            }
        }

        // 逐一檢查成就，收集待頒發的成就
        const pendingAwards = []
        for (const achievement of allAchievements) {
            if (!achievement.isRepeatable && unlockedMap.has(achievement.id)) continue
            const conditions = achievement.conditions || []
            if (conditions.length === 0) continue

            let allMet = true
            for (const cond of conditions) {
                const met = await checkSingleCondition(cond, studentData, eventType, studentSubmissions || [], eventData)
                if (!met) { allMet = false; break }
            }

            if (allMet) {
                pendingAwards.push(achievement)
            }
        }

        // 批次寫入（減少 N 次網路來回為 1 次）
        if (pendingAwards.length > 0) {
            const { writeBatch } = await import('firebase/firestore')
            const batch = writeBatch(db)
            for (const achievement of pendingAwards) {
                const newDocRef = doc(collection(db, 'student_achievements'))
                batch.set(newDocRef, {
                    studentId,
                    achievementId: achievement.id,
                    unlockedAt: Timestamp.now(),
                    eventType
                })
                console.log(`[Achievement] 🏅 Unlocked: "${achievement.name}" for ${studentData.name}`)
            }
            await batch.commit()
            unlockedCount = pendingAwards.length
        }
    } catch (error) {
        console.error('[Achievement] Error checking achievements:', error)
    }

    return unlockedCount
}

// ─── 連續完成天數計算 ───

/**
 * 計算學生的連續完成天數（截止日前的作業是否都已完成）
 * @param {string} studentId   - 學生 ID
 * @param {Object} studentData - 學生文件資料
 * @returns {Promise<Object>}  - 需要更新的欄位
 */
export async function calculateCompletionStreak(studentId, studentData) {
    console.log(`[Completion Streak] Starting check for student ${studentId}`)
    const updates = {}
    const todayStr = getLocalDateString(new Date())

    const lastCheckDate = studentData.lastCompletionCheckDate
    const lastCheckStr = (lastCheckDate && typeof lastCheckDate.toDate === 'function')
        ? getLocalDateString(lastCheckDate.toDate())
        : null

    if (lastCheckStr === todayStr) {
        console.log('[Completion Streak] Check already performed today.')
        return {}
    }

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(23, 59, 59, 999)

    const assignmentsQuery = query(
        collection(db, 'assignments'),
        where('deadline', '<=', Timestamp.fromDate(yesterday))
    )
    const dueSnap = await getDocs(assignmentsQuery)
    const dueAssignments = dueSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    console.log(`[Completion Streak] Found ${dueAssignments.length} assignments due by yesterday.`)

    if (dueAssignments.length === 0) {
        updates.lastCompletionCheckDate = Timestamp.now()
        return updates
    }

    const userSubmissions = await loadStudentSubmissions(studentId)
    const userSubmissionIds = new Set((userSubmissions || []).map(s => s.assignmentId))
    const allCompleted = dueAssignments.every(a => userSubmissionIds.has(a.id))

    if (allCompleted) {
        updates.completionStreak = (studentData.completionStreak || 0) + 1
        console.log(`[Completion Streak] New streak: ${updates.completionStreak}`)
    } else {
        updates.completionStreak = 0
        console.log('[Completion Streak] Not all completed. Streak reset.')
    }

    updates.lastCompletionCheckDate = Timestamp.now()
    return updates
}
