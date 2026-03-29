import { defineStore } from 'pinia'
import { ref } from 'vue'

export const ObjectPaginationState = () => ({
    lastVisible: null,
    isLoading: false,
    isLastPage: false,
    filters: {}
})

export const useDataStore = defineStore('data', () => {
    const assignments = ref([])
    const allSubmissions = ref([])
    const editTargetAssignmentId = ref(null)

    const articleQueryState = ref({
        ...ObjectPaginationState(),
        filters: {
            format: '',
            contentType: '',
            difficulty: '',
            status: '',
            date: ''
        }
    })

    // Teacher specific states
    const teacherArticleQueryState = ref({
        ...ObjectPaginationState(),
        articles: [],
        filters: {
            searchTerm: '',
            format: '',
            contentType: '',
            difficulty: '',
            deadlineStatus: ''
        }
    })

    // 篩選結果快取，避免換頁時重複篩選
    let _filteredCache = null
    let _filtersCacheKey = ''

    const fetchAssignmentsPage = async (isNewQuery = false, currentUser) => {
        if (articleQueryState.value.isLoading || (!isNewQuery && articleQueryState.value.isLastPage)) return

        articleQueryState.value.isLoading = true
        if (isNewQuery) {
            articleQueryState.value.isLastPage = false
            assignments.value = []
            _filteredCache = null // 新查詢時清除快取
        }

        try {
            const { getAssignments } = await import('../services/api')
            const allAssignments = await getAssignments()
            const filters = articleQueryState.value.filters
            const cacheKey = JSON.stringify(filters) + (currentUser?.studentId || '')

            // 僅在篩選條件改變時重新篩選
            let filteredAssignments
            if (_filteredCache && _filtersCacheKey === cacheKey) {
                filteredAssignments = _filteredCache
            } else {
                // 1. 啟動過濾流程
                const isStudentUser = currentUser?.type === 'student'
                let passedIds = null
                
                if (isStudentUser && filters.status) {
                    const studentId = currentUser?.studentId
                    const userSubs = studentId
                        ? allSubmissions.value.filter(s => s.studentId === studentId)
                        : allSubmissions.value
                    
                    passedIds = new Set(userSubs.filter(s => {
                        let best = s.score || 0
                        if (s.attempts?.length > 0) {
                            best = Math.max(...s.attempts.map(att => att.score))
                        }
                        return best >= 60
                    }).map(s => s.assignmentId))
                }

                // 2. 過濾與容錯處理
                filteredAssignments = allAssignments.filter(a => {
                    // 學生只能看到 isPublic 為 true 的文章（嚴格檢查）
                    if (isStudentUser && a.isPublic !== true) return false
                    
                    if (filters.format && a.tags?.format !== filters.format) return false
                    if (filters.contentType && a.tags?.contentType !== filters.contentType) return false
                    if (filters.difficulty && a.tags?.difficulty !== filters.difficulty) return false

                    if (filters.date) {
                        try {
                            const deadlineDate = a.deadline?.toDate ? a.deadline.toDate() : new Date(a.deadline)
                            if (isNaN(deadlineDate.getTime())) return false
                            const dString = `${deadlineDate.getFullYear()}-${String(deadlineDate.getMonth() + 1).padStart(2, '0')}-${String(deadlineDate.getDate()).padStart(2, '0')}`
                            if (dString !== filters.date) return false
                        } catch(e) { return false }
                    }

                    if (filters.status && isStudentUser && passedIds) {
                        const isPassed = passedIds.has(a.id)
                        if (filters.status === 'complete' && !isPassed) return false
                        if (filters.status === 'incomplete' && isPassed) return false
                    }
                    return true
                })

                // 3. 強健排序邏輯 (避免 NaN 導致排序不穩)
                filteredAssignments.sort((a, b) => {
                    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime())
                    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime())
                    const validA = isNaN(timeA) ? 0 : timeA
                    const validB = isNaN(timeB) ? 0 : timeB
                    return validB - validA
                })

                _filteredCache = filteredAssignments
                _filtersCacheKey = cacheKey
            }

            const ARTICLES_PER_PAGE = 20
            const startIndex = isNewQuery ? 0 : assignments.value.length
            const newAssignments = filteredAssignments.slice(startIndex, startIndex + ARTICLES_PER_PAGE)

            if (newAssignments.length < ARTICLES_PER_PAGE || (startIndex + newAssignments.length) >= filteredAssignments.length) {
                articleQueryState.value.isLastPage = true
            }

            if (isNewQuery) {
                assignments.value = newAssignments
            } else {
                assignments.value.push(...newAssignments)
            }
        } catch (error) {
            console.error("Error fetching assignments:", error)
        } finally {
            articleQueryState.value.isLoading = false
        }
    }

    return {
        assignments,
        allSubmissions,
        editTargetAssignmentId,
        articleQueryState,
        teacherArticleQueryState,
        fetchAssignmentsPage
    }
})
