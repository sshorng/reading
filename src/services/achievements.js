/**
 * 成就自動頒發與連續完成天數 — 移植自備份版 student.js / scripts.js
 */
import { collection, query, where, getDocs, doc, addDoc, updateDoc, Timestamp, orderBy } from 'firebase/firestore'
import { db } from '../firebase/init'
import { loadStudentSubmissions } from './api'
import { getLocalDateString, toValidDate } from '../utils/helpers'

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

// ─── 事件與條件類別映射 ───
const EVENT_CONDITION_MAP = {
    'quiz_submit': [
        'submission_count', 'genre_explorer', 'unique_formats_read',
        'high_score_streak', 'average_score', 'first_try_min_score',
        'perfect_score_count', 'recovery_count', 'min_retry_count',
        'speed_under_seconds', 'duration_over_seconds', 'days_before_deadline', 'off_hours_count',
        'read_tag_contentType_', 'read_tag_difficulty_',
        'login_streak', 'completion_streak', 'weekly_progress' // 交卷也可能達成天數成就
    ],
    'login': ['login_streak', 'completion_streak', 'weekly_progress'],
    'dashboard_mount': ['login_streak', 'completion_streak', 'weekly_progress']
}

// ─── 核心功能 ───

/**
 * 檢查並自動頒發成就
 */
export async function checkAndAwardAchievements(studentId, eventType, studentData, eventData = {}) {
    console.log(`[Achievement] Checking for ${studentData.name}, event: ${eventType}`)
    if (!studentId || !studentData) return []

    try {
        // 1. 取得所有啟用中的成就
        const achievementsQuery = query(collection(db, 'achievements'), where('isEnabled', '==', true))
        const achievementsSnapshot = await getDocs(achievementsQuery)
        if (achievementsSnapshot.empty) return []
        const allAchievements = achievementsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))

        // 2. 取得已解鎖的成就
        const unlockedQuery = query(collection(db, 'student_achievements'), where('studentId', '==', studentId))
        const unlockedSnapshot = await getDocs(unlockedQuery)
        // 修復：計算該成就已被領取的總次數，而非只記 true/false
        const unlockedMap = new Map()
        unlockedSnapshot.docs.forEach(d => {
            const id = d.data().achievementId
            unlockedMap.set(id, (unlockedMap.get(id) || 0) + 1)
        })
        console.log(`[Achievement] Current unlocked count: ${unlockedMap.size}`)

        // 3. 根據事件類型過濾
        const allowedConditions = EVENT_CONDITION_MAP[eventType] || []
        const filteredAchievements = allAchievements.filter(ach => {
            if (!ach.isRepeatable && unlockedMap.has(ach.id)) return false
            const conditions = ach.conditions || []
            return conditions.some(c => {
                const type = c.type || ''
                if (type.startsWith('read_tag_')) {
                    const prefix = type.startsWith('read_tag_contentType_') ? 'read_tag_contentType_' : 'read_tag_difficulty_'
                    return allowedConditions.includes(prefix)
                }
                return allowedConditions.includes(type)
            })
        })

        if (filteredAchievements.length === 0) {
            console.log('[Achievement] No relevant new achievements to check for this event.')
            return []
        }

        // 4. 準備檢查所需資料
        let studentSubmissions = eventData.submissions || null
        if (studentSubmissions === null) {
            studentSubmissions = await loadStudentSubmissions(studentId)
        }

        const needsAssignments = filteredAchievements.some(ach => {
            return (ach.conditions || []).some(c => c.type?.startsWith('read_tag_') || c.type === 'genre_explorer' || c.type === 'unique_formats_read' || c.type === 'days_before_deadline')
        })

        let assignmentsMap = new Map()
        if (needsAssignments) {
            const { getAssignments } = await import('./api')
            const all = await getAssignments()
            all.forEach(a => assignmentsMap.set(a.id, a))
        }

        // 🌟 關鍵優化：將 enhancedSubs 的預處理提到迴圈外，只做一次
        const enhancedSubs = (studentSubmissions || []).map(s => {
            const assignment = assignmentsMap.get(s.assignmentId) || {}
            const attempts = s.attempts || []
            const bestScore = attempts.length > 0 ? Math.max(...attempts.map(a => a.score)) : (s.score || 0)
            const firstScore = attempts.length > 0 ? attempts[0].score : (s.score || 0)
            const retryCount = Math.max(0, attempts.length - 1)
            const firstPassedAttempt = attempts.find(a => a.score >= 60)
            const passedDuration = firstPassedAttempt ? (firstPassedAttempt.durationSeconds || s.durationSeconds || 0) : (s.durationSeconds || 0)

            let subDateObj = toValidDate(s.lastSubmittedAt || s.submittedAt) || new Date()

            let daysEarly = 0
            const deadlineField = assignment.deadline || assignment.dueDate
            if (deadlineField) {
                const due = toValidDate(deadlineField)
                if (due) daysEarly = (due - subDateObj) / (1000 * 60 * 60 * 24)
            }
            const hour = subDateObj.getHours()
            const isOffHours = hour >= 22 || hour <= 5

            return { assignment, firstScore, bestScore, retryCount, passedDuration, daysEarly, isOffHours, subDateObj }
        })

        // 5. 逐一檢查
        const pendingAwards = []
        for (const achievement of filteredAchievements) {
            const conditions = achievement.conditions || []
            let unlockCount = unlockedMap.get(achievement.id) || 0

            let keepChecking = true
            let safetyCounter = 0 // 🛡️ 安全機制：防止無限迴圈
            while (keepChecking && safetyCounter < 100) {
                safetyCounter++
                let allMet = true
                for (const cond of conditions) {
                    // 修正：將 eventData 傳入 (原誤植為未定義的 evData)
                    const met = await checkSingleCondition(cond, studentData, eventType, enhancedSubs, eventData, unlockCount)
                    if (!met) {
                        allMet = false
                        break
                    }
                }
                
                if (allMet) {
                    pendingAwards.push(achievement)
                    unlockCount++
                    unlockedMap.set(achievement.id, unlockCount)
                    if (!achievement.isRepeatable) keepChecking = false
                } else {
                    keepChecking = false
                }
            }
            if (safetyCounter >= 100) {
                console.warn(`[Achievement] Loop limit reached for achievement: ${achievement.name}. Potential infinite loop logic detected.`)
            }
        }

        // 6. 批次寫入
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
                console.log(`[Achievement] 🏅 Unlocked: "${achievement.name}"`)
            }

            // 如果本次頒發了含 weekly_progress 條件的成就，回寫 lastProgressCheckWeekId 防止同週重複觸發
            const hasWeeklyProgress = pendingAwards.some(ach =>
                (ach.conditions || []).some(c => c.type === 'weekly_progress')
            )
            if (hasWeeklyProgress && studentData.classId) {
                const currentWeekId = getWeekId(new Date())
                const studentRef = doc(db, `classes/${studentData.classId}/students`, studentId)
                batch.update(studentRef, { lastProgressCheckWeekId: currentWeekId })
            }

            await batch.commit()

            // 同步更新前端記憶體與 localStorage 中的值，避免同一 session 或重整後重複觸發
            if (hasWeeklyProgress) {
                studentData.lastProgressCheckWeekId = getWeekId(new Date())
                // 🔥 修復重複觸發的核心：刷新 localStorage 緩存，避免重整後又恢復成沒有 weekId 的舊版資料
                try {
                    const currentTempUserStr = localStorage.getItem('tempUser')
                    if (currentTempUserStr) {
                        const parsed = JSON.parse(currentTempUserStr)
                        if (parsed.studentId === studentId) {
                            parsed.lastProgressCheckWeekId = studentData.lastProgressCheckWeekId
                            localStorage.setItem('tempUser', JSON.stringify(parsed))
                        }
                    }
                } catch(e) { console.warn('Could not update tempUser in localStorage', e) }
            }

            return pendingAwards
        }
    } catch (error) {
        console.error('[Achievement] Error checking achievements:', error)
    }
    return []
}

/**
 * 檢查單一條件
 */
async function checkSingleCondition(condition, sData, evType, enhancedSubs, evData, unlockCount = 0) {
    const baseValue = parseInt(condition.value, 10)
    if (condition.type !== 'weekly_progress' && isNaN(baseValue)) return false
    
    // 只有「數量累計型」才套用階梯式難度 (累積次數 * 基準值)
    // 只有「數量累計型」或「成長目標型」才套用階梯式難度 (累積次數 * 基準值)
    const progressiveTypes = [
        'submission_count', 'genre_explorer', 'unique_formats_read',
        'high_score_streak', 'perfect_score_count', 'recovery_count', 
        'login_streak', 'completion_streak',
        'average_score', 'weekly_progress' // 🛡️ 防止無限迴圈的重要變更
    ]
    const isTagCount = condition.type.startsWith('read_tag_')
    
    const value = (progressiveTypes.includes(condition.type) || isTagCount) 
        ? baseValue * (unlockCount + 1) 
        : baseValue

    // 優化：預先過濾出及格的文章，減少後端重複 filter 負擔
    const passedSubs = enhancedSubs.filter(s => s.bestScore >= 60)

    const STRATEGIES = {
        // 維度一：基礎與廣度
        'submission_count': () => passedSubs.length >= value,
        'genre_explorer': () => new Set(passedSubs.map(s => s.assignment?.tags?.contentType).filter(Boolean)).size >= value,
        'unique_formats_read': () => new Set(passedSubs.map(s => s.assignment?.tags?.format || '預設').filter(Boolean)).size >= value,
        'high_score_streak': () => (sData.highScoreStreak || 0) >= value,
        'average_score': () => enhancedSubs.length > 0 && (enhancedSubs.reduce((acc, s) => acc + s.firstScore, 0) / enhancedSubs.length) >= value,
        
        // 單篇達標型
        'first_try_min_score': () => enhancedSubs.filter(s => s.firstScore >= value).length >= (unlockCount + 1),
        'min_retry_count': () => passedSubs.filter(s => s.retryCount >= value).length >= (unlockCount + 1),
        'speed_under_seconds': () => passedSubs.filter(s => s.passedDuration > 0 && s.passedDuration <= value).length >= (unlockCount + 1),
        'duration_over_seconds': () => passedSubs.filter(s => s.passedDuration >= value).length >= (unlockCount + 1),
        'days_before_deadline': () => passedSubs.filter(s => s.daysEarly >= value).length >= (unlockCount + 1),

        'perfect_score_count': () => enhancedSubs.filter(s => s.bestScore >= 100).length >= value,
        'recovery_count': () => enhancedSubs.filter(s => s.firstScore < 60 && s.bestScore >= 100).length >= value,
        'login_streak': () => (sData.loginStreak || 0) >= value,
        'completion_streak': () => (sData.completionStreak || 0) >= value,
        'weekly_progress': () => {
            const now = new Date()
            const currentWeekId = getWeekId(now)
            if (sData.lastProgressCheckWeekId === currentWeekId) return false
            const startOfThisWeek = getStartOfWeek(now)
            const startOfLastWeek = new Date(startOfThisWeek.getTime() - 7 * 24 * 60 * 60 * 1000)
            const startOfPrevWeek = new Date(startOfLastWeek.getTime() - 7 * 24 * 60 * 60 * 1000)
            const lastWeekTotal = enhancedSubs.filter(s => s.subDateObj >= startOfLastWeek && s.subDateObj < startOfThisWeek).reduce((sum, s) => sum + s.firstScore, 0)
            const prevWeekTotal = enhancedSubs.filter(s => s.subDateObj >= startOfPrevWeek && s.subDateObj < startOfLastWeek).reduce((sum, s) => sum + s.firstScore, 0)
            return lastWeekTotal > 0 && lastWeekTotal > prevWeekTotal
        },
        'off_hours_count': () => passedSubs.filter(s => s.isOffHours).length >= (unlockCount + 1)
    }

    if (condition.type.startsWith('read_tag_')) {
        const isContentType = condition.type.startsWith('read_tag_contentType_')
        const tag = condition.type.replace(isContentType ? 'read_tag_contentType_' : 'read_tag_difficulty_', '')
        return passedSubs.filter(s => {
            return isContentType
                ? (s.assignment?.tags?.contentType === tag)
                : (s.assignment?.tags?.difficulty === tag)
        }).length >= value
    }

    return STRATEGIES[condition.type] ? STRATEGIES[condition.type]() : false
}

/**
 * 計算學生的連續完成天數
 */
export async function calculateCompletionStreak(studentId, studentData) {
    const updates = {}
    const todayStr = getLocalDateString(new Date())
    const lastCheckDate = toValidDate(studentData.lastCompletionCheckDate)
    const lastCheckStr = lastCheckDate ? getLocalDateString(lastCheckDate) : null
    if (lastCheckStr === todayStr) return {}

    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(23, 59, 59, 999)
    const { getAssignments } = await import('./api')
    const allAssignments = await getAssignments()
    const dueAssignments = allAssignments.filter(a => a.deadline && toValidDate(a.deadline) <= yesterday)

    if (dueAssignments.length === 0) {
        updates.lastCompletionCheckDate = Timestamp.now()
        return updates
    }

    const userSubmissions = await loadStudentSubmissions(studentId)
    const userSubmissionIds = new Set((userSubmissions || []).map(s => s.assignmentId))
    const allCompleted = dueAssignments.every(a => userSubmissionIds.has(a.id))

    updates.completionStreak = allCompleted ? (studentData.completionStreak || 0) + 1 : 0
    updates.lastCompletionCheckDate = Timestamp.now()
    return updates
}

/**
 * 更新學生的連續登入天數
 */
export async function updateLoginStreak(studentId, studentData) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const lastLoginDate = toValidDate(studentData.lastLoginDate)
    const updates = { lastLoginDate: new Date() }

    if (lastLoginDate) {
        lastLoginDate.setHours(0, 0, 0, 0)
        const diffDays = Math.round((today - lastLoginDate) / 86400000)
        if (diffDays === 1) updates.loginStreak = (studentData.loginStreak || 0) + 1
        else if (diffDays > 1) updates.loginStreak = 1
    } else {
        updates.loginStreak = 1
    }
    return updates
}
