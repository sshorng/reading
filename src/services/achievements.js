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
        const value = parseInt(condition.value, 10)
        if (condition.type !== 'weekly_progress' && isNaN(value)) return false

        const allAssignments = evData.allAssignments || []
        // == 預處理：統一增強版數據 ==
        const enhancedSubs = (subs || []).map(s => {
            const assignment = allAssignments.find(a => a.id === s.assignmentId) || {}
            const attempts = s.attempts || []
            const firstAttempt = attempts.length > 0 ? attempts[0] : s

            const firstScore = firstAttempt.score || 0
            const bestScore = attempts.length > 0 ? Math.max(...attempts.map(a => a.score)) : (s.score || 0)
            const retryCount = Math.max(0, attempts.length - 1)

            const firstPassedAttempt = attempts.find(a => a.score >= 60)
            const passedDuration = firstPassedAttempt ? (firstPassedAttempt.durationSeconds || s.durationSeconds || 0) : (s.durationSeconds || 0)

            let daysEarly = 0
            let subDateObj = new Date()
            if (s.submittedAt) {
                subDateObj = s.submittedAt.toDate ? s.submittedAt.toDate() : new Date(s.submittedAt)
                if (assignment.dueDate) {
                    const due = typeof assignment.dueDate === 'string' ? new Date(assignment.dueDate) : (assignment.dueDate.toDate ? assignment.dueDate.toDate() : new Date())
                    daysEarly = (due - subDateObj) / (1000 * 60 * 60 * 24)
                }
            }

            const hour = subDateObj.getHours()
            // 深夜定義：23:00-04:59 (跨日判定)
            const isOffHours = hour >= 23 || hour <= 4

            return {
                ...s, assignment, firstScore, bestScore, retryCount, passedDuration, daysEarly, isOffHours, subDateObj
            }
        })

        const checkWeeklyProgress = () => {
            const now = new Date()
            const currentWeekId = getWeekId(now)
            if (sData.lastProgressCheckWeekId === currentWeekId) return false
            const studentRef = doc(db, `classes/${sData.classId}/students`, studentId)
            updateDoc(studentRef, { lastProgressCheckWeekId: currentWeekId }).catch(console.error)

            const startOfThisWeek = getStartOfWeek(now)
            const startOfLastWeek = new Date(startOfThisWeek.getTime() - 7 * 24 * 60 * 60 * 1000)
            const startOfPrevWeek = new Date(startOfLastWeek.getTime() - 7 * 24 * 60 * 60 * 1000)

            const lastWeekTotal = enhancedSubs.filter(s => s.subDateObj >= startOfLastWeek && s.subDateObj < startOfThisWeek).reduce((sum, s) => sum + s.firstScore, 0)
            const prevWeekTotal = enhancedSubs.filter(s => s.subDateObj >= startOfPrevWeek && s.subDateObj < startOfLastWeek).reduce((sum, s) => sum + s.firstScore, 0)
            return lastWeekTotal > 0 && lastWeekTotal > prevWeekTotal
        }

        // == 策略註冊表 (Strategy Map) ==
        const STRATEGIES = {
            // 維度一：基礎與廣度
            'submission_count': () => enhancedSubs.length >= value,
            'genre_explorer': () => new Set(enhancedSubs.map(s => s.assignment?.tags?.contentType).filter(Boolean)).size >= value,
            'unique_formats_read': () => new Set(enhancedSubs.map(s => s.assignment?.tags?.format || '預設').filter(Boolean)).size >= value,

            // 維度二：精準與品質
            'high_score_streak': () => (sData.highScoreStreak || 0) >= value,
            'average_score': () => enhancedSubs.length > 0 && (enhancedSubs.reduce((acc, s) => acc + s.firstScore, 0) / enhancedSubs.length) >= value,
            'first_try_min_score': () => enhancedSubs.filter(s => s.firstScore >= value).length > 0,

            // 維度三：毅力與重修
            'perfect_score_count': () => enhancedSubs.filter(s => s.bestScore >= 100).length >= value,
            'recovery_count': () => enhancedSubs.filter(s => s.firstScore < 60 && s.bestScore >= 100).length >= value,
            'min_retry_count': () => enhancedSubs.filter(s => s.retryCount >= value && s.bestScore >= 60).length > 0,

            // 維度四：恆心與進階
            'login_streak': () => (sData.loginStreak || 0) >= value,
            'completion_streak': () => (sData.completionStreak || 0) >= value,
            'weekly_progress': () => checkWeeklyProgress(),

            // 維度五：作答效率與作息
            'speed_under_seconds': () => enhancedSubs.filter(s => s.passedDuration > 0 && s.passedDuration <= value && s.bestScore >= 60).length > 0,
            'duration_over_seconds': () => enhancedSubs.filter(s => s.passedDuration >= value && s.bestScore >= 60).length > 0,
            'days_before_deadline': () => enhancedSubs.filter(s => s.daysEarly >= value).length > 0,
            'off_hours_count': () => enhancedSubs.filter(s => s.isOffHours).length >= value
        }

        if (condition.type.startsWith('read_tag_')) {
            const isContentType = condition.type.startsWith('read_tag_contentType_')
            const tag = condition.type.replace(isContentType ? 'read_tag_contentType_' : 'read_tag_difficulty_', '')
            const count = enhancedSubs.filter(s => isContentType ? (s.assignment?.tags?.contentType === tag) : (s.assignment?.tags?.difficulty === tag)).length
            return count >= value
        }

        return STRATEGIES[condition.type] ? STRATEGIES[condition.type]() : false
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

        const needsAssignments = allAchievements.some(ach => {
            if (!ach.isRepeatable && unlockedMap.has(ach.id)) return false
            return (ach.conditions || []).some(c => c.type?.startsWith('read_tag_') || c.type === 'genre_explorer')
        })

        if (needsAssignments && !eventData.allAssignments) {
            const { getAssignments } = await import('./api')
            eventData.allAssignments = await getAssignments()
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
/**
 * 更新學生的連續登入天數
 * @param {string} studentId 
 * @param {Object} studentData 
 * @returns {Promise<Object>} 需要更新的欄位 (若無則回傳空物件)
 */
export async function updateLoginStreak(studentId, studentData) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const lastLogin = studentData.lastLoginDate
    const lastLoginDate = lastLogin?.toDate ? lastLogin.toDate() : (lastLogin ? new Date(lastLogin) : null)

    const updates = {}
    if (lastLoginDate) {
        lastLoginDate.setHours(0, 0, 0, 0)
        const diffDays = Math.round((today - lastLoginDate) / 86400000)

        if (diffDays === 1) {
            // 接續昨天的登入
            updates.loginStreak = (studentData.loginStreak || 0) + 1
        } else if (diffDays > 1) {
            // 斷掉，重起爐灶
            updates.loginStreak = 1
        }
        // diffDays === 0 代表當天重複登入，無需更新計數
    } else {
        // 首次登入
        updates.loginStreak = 1
    }

    updates.lastLoginDate = new Date()
    return updates
}
