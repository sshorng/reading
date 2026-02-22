import { getDoc, setDoc, doc, updateDoc, collection, getDocs, deleteDoc, writeBatch, query, where, arrayUnion, deleteField, Timestamp, orderBy, limit, startAfter, addDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { appState, dom, TEACHER_PASSWORD_HASH, db, auth, app, appId, mermaidInitialized, setMermaidInitialized } from './state.js';
import { el, updateElement, escapeHtml, normalizeClassName, generateDefaultPassword, markdownToHtml, formatSubmissionTime, formatTime, getLocalDateString, hashString } from './utils.js';
import { loadStudentSubmissions, loadSubmissionsByClass, loadSubmissionsByAssignment, getAssignments } from './api.js';
import { closeModal, modalHtmlGenerators, renderModal, attachModalEventListeners, showLoading, hideLoading } from './ui.js';
import { callGenerativeAI, callFullGeminiAnalysis, handleAnalysisAI, handleAiRewrite, handleAiGenerateAchievement, callAchievementAI, callSingleGeminiAnalysis } from './ai.js';
import { showView, loadAllData, updateHeader, showArticleGrid, displayAssignment, fetchAssignmentsPage, stopQuizTimer, renderCalendar } from './scripts.js';
import { fetchTeacherAssignmentsPage, handleStudentAiAnalysis, displaySubmissionReview, handleSaveEdit } from './teacher.js';

export function showArticleContent() {
    document.getElementById('student-sidebar').classList.add('hidden');
    const readingView = document.getElementById('reading-view');
    readingView.classList.remove('lg:col-span-2');
    readingView.classList.add('lg:col-span-3', 'reading-mode');

    document.getElementById('article-grid-view')?.classList.add('hidden');
    document.getElementById('content-display')?.classList.remove('hidden');
}

export function renderStudentUI() {
    renderCalendar();
    // renderAssignmentsList and renderArticleGrid are now called by fetchAssignmentsPage
}

export function populateClassSelectors() {
    const selectors = [
        document.getElementById('class-login-selector'),
        document.getElementById('class-selector')
    ];

    selectors.forEach(selector => {
        if (selector) {
            const currentVal = selector.value;
            selector.innerHTML = ''; // Clear existing options

            const placeholderText = selector.id === 'class-login-selector' ? '請選擇學堂...' : '選擇一個學堂...';
            selector.appendChild(el('option', { value: '', textContent: placeholderText }));

            appState.allClasses.forEach(cls => {
                selector.appendChild(el('option', { value: cls.id, textContent: cls.className }));
            });

            if (appState.allClasses.some(c => c.id === currentVal)) {
                selector.value = currentVal;
            }
        }
    });
}

export async function populateStudentLoginSelector(classId) {
    const studentSelector = document.getElementById('student-login-selector');
    const passwordInput = document.getElementById('student-password-input');
    const loginBtn = document.getElementById('student-login-btn');

    studentSelector.innerHTML = ''; // Clear
    studentSelector.appendChild(el('option', { value: '', textContent: '--- 請選擇學子 ---' }));

    studentSelector.disabled = true;
    passwordInput.disabled = true;
    loginBtn.disabled = true;

    if (!classId) return;

    try {
        const studentsQuery = query(collection(db, `classes/${classId}/students`), orderBy('seatNumber'));
        const studentsSnapshot = await getDocs(studentsQuery);

        if (!studentsSnapshot.empty) {
            const fragment = document.createDocumentFragment();
            studentsSnapshot.forEach(doc => {
                const student = doc.data();
                fragment.appendChild(
                    el('option', {
                        value: doc.id, // Use studentId as the value
                        textContent: `${student.seatNumber}號 ${student.name}`
                    })
                );
            });
            studentSelector.appendChild(fragment);
            studentSelector.disabled = false;
            passwordInput.disabled = false;
        }
    } catch (error) {
        console.error("Error populating student selector:", error);
    }
}



export function createFullArticleCard(assignment) {
    const userSubmissions = (appState.currentUser?.studentId) ? appState.allSubmissions.filter(s => s.studentId === appState.currentUser.studentId) : [];
    const submission = userSubmissions.find(s => s.assignmentId === assignment.id);
    const isCompleted = !!submission;

    let highestScore = 0;
    if (isCompleted) {
        if (submission.attempts && submission.attempts.length > 0) {
            highestScore = Math.max(...submission.attempts.map(a => a.score));
        } else {
            highestScore = submission.score; // 兼容舊資料
        }
    }
    const isPassed = isCompleted && highestScore >= 60;

    let statusDiv;
    if (isPassed) {
        statusDiv = el('div', { class: 'status-seal status-seal-complete', title: `已完成`, textContent: '完成' });
    } else if (assignment.deadline && new Date() > assignment.deadline.toDate()) {
        statusDiv = el('div', { class: 'status-seal status-seal-overdue', title: '已過期', textContent: '逾期' });
    } else {
        statusDiv = el('div', { class: 'status-seal status-seal-incomplete', title: '未完成', textContent: '未完' });
    }

    let deadlineDiv = null;
    if (assignment.deadline) {
        const d = assignment.deadline.toDate();
        deadlineDiv = el('div', {
            class: 'absolute top-4 right-5 text-xs font-semibold inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-800 z-10',
            textContent: `期限: ${d.getMonth() + 1}/${d.getDate()}`
        });
    }

    const tags = assignment.tags || {};
    const tagChildren = [];
    if (tags.format) tagChildren.push(el('span', { class: 'bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-medium', textContent: `#${tags.format}` }));
    if (tags.contentType) tagChildren.push(el('span', { class: 'bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-medium', textContent: `#${tags.contentType}` }));
    if (tags.difficulty) tagChildren.push(el('span', { class: 'bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium', textContent: `#${tags.difficulty}` }));

    const card = el('div', {
        'data-assignment-id': assignment.id,
        class: 'assignment-card-item relative flex flex-col justify-between bg-white border-2 border-slate-200 rounded-lg shadow-sm hover:shadow-xl hover:border-red-700 transition-all duration-300 cursor-pointer animate-fade-in' // Added fade-in animation
    }, [
        statusDiv,
        el('div', { class: 'p-5 pt-10 flex flex-col flex-grow' }, [
            deadlineDiv,
            el('h3', { class: 'text-lg font-bold text-slate-800 mb-2 flex-grow', textContent: assignment.title }),
            el('p', { class: 'text-sm text-slate-500 mb-4', textContent: `${assignment.article.replace(/(\r\n|\n|\r|　)/gm, " ").trim().substring(0, 20)}...` }),
            el('div', { class: 'mt-auto' }, [el('div', { class: 'flex flex-wrap gap-2 text-xs' }, tagChildren)])
        ]),
        el('div', { class: 'p-4 bg-slate-50 border-t-2 border-slate-100 rounded-b-lg' }, [
            el('button', { class: 'w-full btn-primary py-2 px-4 text-sm', textContent: isPassed ? '查看結果' : (isCompleted ? `再次挑戰 (${highestScore}分)` : '開始試煉') })
        ])
    ]);
    return card;
}




export async function submitQuiz(assignment) {
    if (appState.quizTimer.elapsedSeconds < 30) {
        renderModal('message', {
            title: '過於倉促！',
            message: '夫子見你閱讀速度異於常人！請多花點時間細細品味文章，思考後再作答。請至少閱讀 30 秒。',
            type: 'info'
        });
        return;
    }
    stopQuizTimer(true);
    const formData = new FormData(document.getElementById('quiz-form'));
    let score = 0;
    const userAnswers = [];
    assignment.questions.forEach((q, index) => {
        const userAnswer = formData.get(`question-${index}`);
        userAnswers.push(userAnswer !== null ? parseInt(userAnswer) : null);
        if (userAnswer !== null && parseInt(userAnswer) === q.correctAnswerIndex) score++;
    });
    const finalScore = Math.round((score / assignment.questions.length) * 100);
    const isOverdue = assignment.deadline && new Date() > assignment.deadline.toDate();
    const durationSeconds = appState.quizTimer.elapsedSeconds || 0;
    const submissionId = `${appState.currentUser.studentId}_${assignment.id}`;

    // 檢查是否有舊的作答紀錄
    const existingIndex = appState.allSubmissions.findIndex(s => s.id === submissionId);
    let submissionData;

    const currentAttempt = {
        answers: userAnswers,
        score: finalScore,
        submittedAt: Timestamp.now(),
        durationSeconds: durationSeconds
    };

    if (existingIndex > -1) {
        // 已經有作答紀錄，追加 attempt
        const existingRecord = appState.allSubmissions[existingIndex];

        // 升級舊資料結構
        let attempts = existingRecord.attempts || [];
        if (attempts.length === 0) {
            attempts.push({
                answers: existingRecord.answers,
                score: existingRecord.score,
                submittedAt: existingRecord.submittedAt,
                durationSeconds: existingRecord.durationSeconds || 0
            });
        }

        attempts.push(currentAttempt);

        submissionData = {
            ...existingRecord,
            attempts: attempts,
            // 頂層 score 保留第一次成績，不隨後續挑戰覆寫
            // 後續答案與時間記錄在 attempts 中，完成判定用 highestScore
            answers: userAnswers,
            submittedAt: Timestamp.now(),
            durationSeconds: durationSeconds
        };
        appState.allSubmissions[existingIndex] = submissionData;
    } else {
        // 第一次作答
        submissionData = {
            studentId: appState.currentUser.studentId,
            name: appState.currentUser.name,
            classId: appState.currentUser.classId,
            className: appState.currentUser.className,
            assignmentId: assignment.id,
            assignmentTitle: assignment.title,
            answers: userAnswers,
            score: finalScore,
            firstAttemptScore: finalScore, // 記下第一次的成績作為判定依據
            submittedAt: Timestamp.now(),
            isOverdue: !!isOverdue,
            durationSeconds: durationSeconds,
            attempts: [currentAttempt]
        };
        appState.allSubmissions.push({ ...submissionData, id: submissionId });
    }

    await setDoc(doc(db, "submissions", submissionId), submissionData, { merge: true });

    fetchAssignmentsPage(true);
    displayAssignment(assignment); // 先刷新表單背景畫面，移除未達標提示
    displayResults(finalScore, assignment, userAnswers);

    const analysisTab = document.querySelector('.content-tab[data-tab="analysis"]');
    if (analysisTab) {
        analysisTab.disabled = false;
        analysisTab.title = "查看解析";
    }

    // --- Upsert Student Stats and Check Achievements ---
    // 只有在第一次繳交 (existingIndex === -1) 時才更新成就與歷程紀錄，避免洗數據
    if (existingIndex === -1) {
        try {
            const studentRef = doc(db, `classes/${appState.currentUser.classId}/students`, appState.currentUser.studentId);
            const studentSnap = await getDoc(studentRef);

            if (!studentSnap.exists()) {
                console.error("Student document not found, cannot update stats.");
                return;
            }

            const studentData = studentSnap.data();
            const updates = {
                submissionCount: (studentData.submissionCount || 0) + 1,
                tagReadCounts: { ...(studentData.tagReadCounts || {}) }
            };

            const tags = assignment.tags || {};
            if (tags.contentType) updates.tagReadCounts[`contentType_${tags.contentType.trim()}`] = (updates.tagReadCounts[`contentType_${tags.contentType.trim()}`] || 0) + 1;
            if (tags.difficulty) updates.tagReadCounts[`difficulty_${tags.difficulty.trim()}`] = (updates.tagReadCounts[`difficulty_${tags.difficulty.trim()}`] || 0) + 1;

            // --- High Score Streak Logic (No Date Dependency) ---
            if (finalScore >= 90) {
                updates.highScoreStreak = (studentData.highScoreStreak || 0) + 1;
                console.log(`[High Score Streak] Score >= 90. New streak: ${updates.highScoreStreak}`);
            } else {
                updates.highScoreStreak = 0;
                console.log(`[High Score Streak] Score < 90. Streak reset.`);
            }

            console.log("Preparing to update Firestore with submission stats:", updates);
            await updateDoc(studentRef, updates);
            console.log("Firestore updated successfully.");

            const finalStudentData = { ...studentData, ...updates };
            Object.assign(appState.currentUser, finalStudentData);

            await checkAndAwardAchievements(appState.currentUser.studentId, 'submit', appState.currentUser, { submissions: appState.allSubmissions });

        } catch (error) {
            console.error("CRITICAL: Failed to update student stats or check achievements:", error);
        }
    }
}

export function displayResults(score, assignment, userAnswers) {
    appState.currentAssignment = assignment; // Ensure current assignment is set for the modal
    renderModal('result', { score, assignment, userAnswers });
}

export async function displayStudentAnalysis(studentId, classId) {
    await renderModal('studentAnalysis');
    const contentEl = document.getElementById('student-analysis-content');
    const titleEl = document.getElementById('student-analysis-title');
    if (!contentEl || !titleEl) return;

    contentEl.innerHTML = '<div class="text-center p-8"><div class="loader"></div><p class="mt-4">讀取學子紀錄中...</p></div>';

    try {
        let student = null;
        let userName = '';
        const isCurrentUserStudent = appState.currentUser.type === 'student' && studentId === appState.currentUser.studentId;
        const isViewingSelfAsTeacher = appState.currentUser.type === 'teacher' && studentId === 'teacher_user';

        if (isCurrentUserStudent || isViewingSelfAsTeacher) {
            userName = appState.currentUser.name;
        } else if (classId) {
            const studentDoc = await getDoc(doc(db, `classes/${classId}/students`, studentId));
            if (studentDoc.exists()) {
                student = { id: studentDoc.id, ...studentDoc.data() };
                userName = student.name;
            }
        }

        if (!userName) throw new Error(`無法找到 ID 為 ${studentId} 的使用者資訊。`);

        titleEl.textContent = `${userName} 的個人課業`;

        const submissionsQuery = query(collection(db, "submissions"), where("studentId", "==", studentId));
        const submissionsSnapshot = await getDocs(submissionsQuery);
        const studentSubmissions = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const canChangePassword = isCurrentUserStudent || isViewingSelfAsTeacher;
        const changePasswordBtn = canChangePassword ? `<button id="change-password-btn" class="w-full btn-secondary py-3 mb-6 font-bold">修訂憑信</button>` : '';

        if (studentSubmissions.length === 0) {
            contentEl.innerHTML = `<div class="p-8">${changePasswordBtn}<p class="text-center text-slate-500">此學子尚未有任何課業記錄。</p></div>`;
        } else {
            const completedCount = studentSubmissions.length;
            const totalScore = studentSubmissions.reduce((sum, s) => sum + s.score, 0);
            const avgScore = completedCount > 0 ? totalScore / completedCount : 0;

            // Note: Completion rate logic depends on appState.assignments which might be stale.
            // For now, we'll calculate based on what's loaded.
            // To calculate completion rate correctly, we need ALL assignments, not just the paginated ones.
            const allAssignmentsSnapshot = await getDocs(collection(db, "assignments"));
            const allAssignments = allAssignmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const now = new Date();
            const dueAssignments = allAssignments.filter(a => a.deadline && a.deadline.toDate() < now);
            const completedDueAssignmentIds = new Set(studentSubmissions.filter(s => dueAssignments.some(a => a.id === s.assignmentId)).map(s => s.assignmentId));
            const completionRate = dueAssignments.length > 0 ? (completedDueAssignmentIds.size / dueAssignments.length) * 100 : 100; // If no assignments are due, completion is 100%

            // --- Weekly Score Chart Logic ---
            const weeklyData = {};

            studentSubmissions.forEach(sub => {
                if (!sub.submittedAt) return;
                const date = sub.submittedAt.toDate();
                const startOfWeek = getStartOfWeek(date).toISOString().split('T')[0];
                if (!weeklyData[startOfWeek]) {
                    weeklyData[startOfWeek] = { scores: [], count: 0 };
                }
                weeklyData[startOfWeek].scores.push(sub.score);
                weeklyData[startOfWeek].count++;
            });

            const sortedWeeks = Object.keys(weeklyData).sort();
            const chartLabels = sortedWeeks.map(week => {
                const startDate = new Date(week);
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                const format = (d) => `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
                return `${format(startDate)}~${format(endDate)}`;
            });

            const scoreData = sortedWeeks.map(week => {
                const { scores } = weeklyData[week];
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                return avg.toFixed(0);
            });
            const completionData = sortedWeeks.map(week => weeklyData[week].count || 0);

            const chartHtml = sortedWeeks.length > 1 ? `
                        <h3 class="font-bold text-lg mb-2">每週學習趨勢分析</h3>
                        <div class="p-4 bg-white rounded-lg shadow">
                            <canvas id="weekly-score-chart"></canvas>
                        </div>
                    ` : '<div class="p-4 bg-white rounded-lg shadow text-center text-slate-500">尚無足夠資料可繪製學習趨勢圖，完成兩週以上的課業後將會顯示。</div>';

            contentEl.innerHTML = `
                        <div class="p-2">
                            ${changePasswordBtn}
                            <button id="ai-student-analysis-btn" data-student-id="${studentId}" class="w-full btn-teal py-3 mb-6 font-bold">啟動 AI 提供個人策勵</button>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div class="p-4 bg-white rounded-lg text-center shadow"><div class="text-sm text-gray-500">平均得分</div><div class="text-3xl font-bold text-gray-700">${avgScore.toFixed(1)}</div></div>
                                <div class="p-4 bg-white rounded-lg text-center shadow"><div class="text-sm text-gray-500">完成篇數</div><div class="text-3xl font-bold text-gray-700">${completedCount}</div></div>
                                <div class="p-4 bg-white rounded-lg text-center shadow"><div class="text-sm text-gray-500">課業完成率</div><div class="text-3xl font-bold text-gray-700">${completionRate.toFixed(0)}%</div></div>
                            </div>
                            ${chartHtml}
                        </div>`;

            if (sortedWeeks.length > 1) {
                setTimeout(() => {
                    const ctx = document.getElementById('weekly-score-chart')?.getContext('2d');
                    if (ctx) {
                        new Chart(ctx, {
                            type: 'bar',
                            data: {
                                labels: chartLabels,
                                datasets: [{
                                    label: '每週完成篇數',
                                    data: completionData,
                                    backgroundColor: 'rgba(255, 159, 64, 0.5)',
                                    borderColor: 'rgba(255, 159, 64, 1)',
                                    yAxisID: 'y1',
                                    order: 2
                                }, {
                                    type: 'line',
                                    label: '每週平均分數',
                                    data: scoreData,
                                    fill: true,
                                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                                    borderColor: 'rgba(75, 192, 192, 1)',
                                    tension: 0.1,
                                    yAxisID: 'y',
                                    order: 1
                                }]
                            },
                            options: {
                                responsive: true,
                                interaction: {
                                    mode: 'index',
                                    intersect: false,
                                },
                                scales: {
                                    y: {
                                        type: 'linear',
                                        display: true,
                                        position: 'left',
                                        beginAtZero: true,
                                        max: 100,
                                        title: {
                                            display: true,
                                            text: '平均分數'
                                        }
                                    },
                                    y1: {
                                        type: 'linear',
                                        display: true,
                                        position: 'right',
                                        beginAtZero: true,
                                        title: {
                                            display: true,
                                            text: '完成篇數'
                                        },
                                        grid: {
                                            drawOnChartArea: false,
                                        },
                                        ticks: {
                                            stepSize: 1
                                        }
                                    }
                                }
                            }
                        });
                    }
                }, 100);
            }
        }

        // Re-attach event listeners inside the modal
        if (canChangePassword) {
            const pwBtn = contentEl.querySelector('#change-password-btn');
            if (pwBtn) pwBtn.addEventListener('click', () => renderModal('changePassword'));
        }
        // .view-submission-review-btn clicks are handled by delegation in attachModalEventListeners
        const aiBtn = contentEl.querySelector('#ai-student-analysis-btn');
        if (aiBtn) aiBtn.addEventListener('click', e => handleStudentAiAnalysis(e.currentTarget.dataset.studentId));

    } catch (error) {
        console.error("Error displaying student analysis:", error);
        contentEl.innerHTML = `<p class="text-red-500 p-8">讀取學子紀錄失敗：${error.message}</p>`;
    }
}

export function handleTextSelection(event) {
    // Add a small delay for touch events to ensure selection is registered
    const delay = event.type === 'touchend' ? 50 : 10;

    setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            // If no selection, hide the toolbar unless we clicked inside it
            if (!dom.highlightToolbar.contains(event.target)) {
                dom.highlightToolbar.classList.add('hidden');
            }
            return;
        }

        const range = selection.getRangeAt(0);
        appState.currentSelectionRange = range; // Always store the latest range

        // If the selection is not collapsed (i.e., text is selected), show the toolbar
        if (!selection.isCollapsed && selection.toString().trim() !== '') {
            const rect = range.getBoundingClientRect();
            const toolbar = dom.highlightToolbar;
            toolbar.classList.remove('hidden');
            // Position the toolbar near the end of the selection
            const endRect = selection.getRangeAt(selection.rangeCount - 1).getBoundingClientRect();
            toolbar.style.left = `${endRect.right + window.scrollX + 10}px`;
            toolbar.style.top = `${endRect.top + window.scrollY}px`;
        } else {
            // If selection is collapsed (a click/tap), check if it's inside a highlight
            const container = range.commonAncestorContainer;
            const highlight = container.nodeType === 1 ? container.closest('.highlight') : container.parentNode.closest('.highlight');

            if (highlight) {
                // If inside a highlight, show the toolbar next to the highlight
                const rect = highlight.getBoundingClientRect();
                const toolbar = dom.highlightToolbar;
                toolbar.classList.remove('hidden');
                toolbar.style.left = `${rect.right + window.scrollX + 10}px`;
                toolbar.style.top = `${rect.top + window.scrollY}px`;
            } else {
                // If not inside a highlight, hide the toolbar
                if (!dom.highlightToolbar.contains(event.target)) {
                    dom.highlightToolbar.classList.add('hidden');
                }
            }
        }
    }, delay);
}

export function applyHighlight(color) {
    if (!appState.currentSelectionRange) return;

    const range = appState.currentSelectionRange;
    if (!range.collapsed) {
        const span = document.createElement('span');
        span.className = 'highlight';
        span.style.backgroundColor = color;
        span.appendChild(range.extractContents());
        range.insertNode(span);
    }

    // Clear the selection from the window and our state
    const selection = window.getSelection();
    if (selection) {
        selection.removeAllRanges();
    }
    appState.currentSelectionRange = null;

    dom.highlightToolbar.classList.add('hidden');
    saveHighlights(appState.currentAssignment.id);
}

export function removeHighlight() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const articleBody = document.getElementById('article-body');
    if (!articleBody) return;

    const unwrapHighlight = (el) => {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
    };

    // Case 1: A range of text is selected. Unwrap all highlights that intersect it.
    if (!range.collapsed) {
        const allHighlights = Array.from(articleBody.querySelectorAll('.highlight'));

        allHighlights.forEach(highlight => {
            // Check if the highlight node intersects with the user's selection range
            if (range.intersectsNode(highlight)) {
                // A simple unwrap is sufficient for now. A more complex solution
                // would involve splitting nodes if the selection is partial.
                unwrapHighlight(highlight);
            }
        });

        // Case 2: Selection is collapsed (it's a tap/click). Find the highlight under the cursor.
    } else {
        let node = range.commonAncestorContainer;
        const highlightNode = node.nodeType === 1 ? node.closest('.highlight') : node.parentNode.closest('.highlight');

        if (highlightNode) {
            unwrapHighlight(highlightNode);
        }
    }

    // General cleanup
    articleBody.normalize(); // Merge adjacent text nodes
    selection.removeAllRanges();
    appState.currentSelectionRange = null;
    dom.highlightToolbar.classList.add('hidden');
    if (appState.currentAssignment) {
        saveHighlights(appState.currentAssignment.id);
    }
}

export function saveHighlights(assignmentId) {
    if (!appState.currentUser || !appState.currentUser.studentId || !assignmentId) return;
    const articleBody = document.getElementById('article-body');
    if (articleBody) {
        const key = `highlights_${appId}_${appState.currentUser.studentId}_${assignmentId}`;
        try { localStorage.setItem(key, articleBody.innerHTML); }
        catch (e) { console.error("儲存螢光筆劃記失敗:", e); }
    }
}

export function loadAndApplyHighlights(assignmentId) {
    if (!appState.currentUser || !appState.currentUser.studentId || !assignmentId) return;
    const articleBody = document.getElementById('article-body');
    const key = `highlights_${appId}_${appState.currentUser.studentId}_${assignmentId}`;
    try {
        const savedHtml = localStorage.getItem(key);
        if (savedHtml && articleBody) articleBody.innerHTML = savedHtml;
    } catch (e) { console.error("讀取螢光筆劃記失敗:", e); }
}

export function handleHighlightToolbarAction(event) {
    // Prevent the browser from doing its default action (like deselecting text or firing a click)
    event.preventDefault();

    const target = event.target;
    const highlightBtn = target.closest('.highlight-btn');
    const removeBtn = target.closest('#remove-highlight-btn');

    if (highlightBtn) {
        applyHighlight(highlightBtn.dataset.color);
    } else if (removeBtn) {
        removeHighlight();
    }
}

export async function checkAndAwardAchievements(studentId, eventType, studentData, eventData = {}) {
    console.log(`Checking achievements for ${studentData.name}, event: ${eventType}`, 'Received studentData:', studentData);
    if (!studentId || !studentData) return 0;
    let unlockedCount = 0;

    // Helper function to check a single condition
    async function checkSingleCondition(condition, studentData, eventType, studentSubmissions, eventData) {
        let isMet = false;
        const value = parseInt(condition.value, 10);
        if (condition.type !== 'weekly_progress' && isNaN(value)) return false;

        switch (condition.type) {
            case 'submission_count':
                if (studentSubmissions && studentSubmissions.length >= value) isMet = true;
                break;
            case 'login_streak':
                if ((studentData.loginStreak || 0) >= value) isMet = true;
                break;
            case 'high_score_streak':
                if ((studentData.highScoreStreak || 0) >= value) isMet = true;
                break;
            case 'completion_streak':
                if ((studentData.completionStreak || 0) >= value) isMet = true;
                break;
            case 'average_score':
                if (studentSubmissions && studentSubmissions.length > 0) {
                    const totalScore = studentSubmissions.reduce((sum, s) => sum + s.score, 0);
                    if ((totalScore / studentSubmissions.length) >= value) isMet = true;
                }
                break;
            case 'genre_explorer':
                const tagCounts = studentData.tagReadCounts || {};
                const completedGenres = Object.keys(tagCounts).filter(key => key.startsWith('contentType_')).length;
                if (completedGenres >= value) isMet = true;
                break;
            case 'weekly_progress':
                const now = new Date();
                const currentWeekId = getWeekId(now);
                if (studentData.lastProgressCheckWeekId === currentWeekId) break;
                const studentRef = doc(db, `classes/${studentData.classId}/students`, studentId);
                updateDoc(studentRef, { lastProgressCheckWeekId: currentWeekId }).catch(console.error);
                const startOfThisWeek = getStartOfWeek(now);
                const startOfLastWeek = new Date(startOfThisWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
                const endOfLastWeek = new Date(startOfThisWeek.getTime() - 1);
                const startOfPrevWeek = new Date(startOfLastWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
                const endOfPrevWeek = new Date(startOfLastWeek.getTime() - 1);
                const lastWeekSubs = studentSubmissions.filter(s => { const d2 = s.submittedAt.toDate(); return d2 >= startOfLastWeek && d2 <= endOfLastWeek; });
                const prevWeekSubs = studentSubmissions.filter(s => { const d2 = s.submittedAt.toDate(); return d2 >= startOfPrevWeek && d2 <= endOfPrevWeek; });
                const lastWeekTotal = lastWeekSubs.reduce((sum, s) => sum + s.score, 0);
                const prevWeekTotal = prevWeekSubs.reduce((sum, s) => sum + s.score, 0);
                if (lastWeekTotal > 0 && lastWeekTotal > prevWeekTotal) isMet = true;
                break;
            default:
                if (condition.type && condition.type.startsWith('read_tag_')) {
                    const key = condition.type.replace('read_tag_', '');
                    const tagCount = (studentData.tagReadCounts || {})[key] || 0;
                    if (tagCount >= value) isMet = true;
                }
                break;
        }
        return isMet;
    }

    try {
        const achievementsQuery = query(collection(db, "achievements"), where("isEnabled", "==", true));
        const achievementsSnapshot = await getDocs(achievementsQuery);
        if (achievementsSnapshot.empty) return 0;
        const allAchievements = achievementsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const unlockedQuery = query(collection(db, "student_achievements"), where("studentId", "==", studentId));
        const unlockedSnapshot = await getDocs(unlockedQuery);
        const unlockedMap = new Map(unlockedSnapshot.docs.map(d => [d.data().achievementId, { id: d.id, ...d.data() }]));

        let studentSubmissions = eventData.submissions || null;
        if (studentSubmissions === null) {
            const needsSubmissions = allAchievements.some(ach => {
                if (!ach.isRepeatable && unlockedMap.has(ach.id)) return false;
                const check = (conditions) => conditions.some(c => c.type.includes('score') || c.type === 'submission_count' || c.type.includes('tag') || c.type === 'weekly_progress');
                if (ach.conditions) return check(ach.conditions);
                if (ach.type) return check([{ type: ach.type }]);
                return false;
            });
            if (needsSubmissions) studentSubmissions = await loadStudentSubmissions(studentId);
        }

        for (const ach of allAchievements) {
            const existingUnlock = unlockedMap.get(ach.id);
            if (!ach.isRepeatable && existingUnlock) continue;

            let allConditionsMet = false;
            if (ach.conditions && Array.isArray(ach.conditions) && ach.conditions.length > 0) {
                let conditionsResult = true;
                for (const condition of ach.conditions) {
                    if (!await checkSingleCondition(condition, studentData, eventType, studentSubmissions, eventData)) {
                        conditionsResult = false;
                        break;
                    }
                }
                if (conditionsResult) allConditionsMet = true;
            } else if (ach.type) {
                if (await checkSingleCondition(ach, studentData, eventType, studentSubmissions, eventData)) allConditionsMet = true;
            }

            if (allConditionsMet) {
                unlockedCount++;
                let newCount = 1;
                if (ach.isRepeatable) {
                    if (existingUnlock) {
                        newCount = (existingUnlock.count || 1) + 1;
                        await updateDoc(doc(db, "student_achievements", existingUnlock.id), { count: newCount, unlockedAt: Timestamp.now() });
                    } else {
                        await addDoc(collection(db, "student_achievements"), { studentId, achievementId: ach.id, unlockedAt: Timestamp.now(), classId: appState.currentUser.classId, count: newCount });
                    }
                } else {
                    await addDoc(collection(db, "student_achievements"), { studentId, achievementId: ach.id, unlockedAt: Timestamp.now(), classId: appState.currentUser.classId });
                }
                unlockedMap.set(ach.id, { ...unlockedMap.get(ach.id), count: newCount });
                renderModal('achievementUnlocked', { icon: ach.icon, title: ach.name, description: ach.description, count: ach.isRepeatable ? newCount : null });
            }
        }
    } catch (error) {
        console.error("Error during achievement check:", error);
    }
    return unlockedCount;
}

export function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday (0)
    const startOfWeek = new Date(d.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
}

export function getWeekId(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    // Get first day of year
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    // Return YYYY-WW
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getAchievementSortKeys(ach) {
    let type, value, conditionCount;

    if (ach.conditions && ach.conditions.length > 0) {
        type = ach.conditions[0].type;
        value = parseInt(ach.conditions[0].value, 10);
        conditionCount = ach.conditions.length;
    } else { // Legacy format
        type = ach.type;
        value = parseInt(ach.value, 10);
        conditionCount = 1;
    }
    if (isNaN(value)) value = 0; // Handle types without a value like 'weekly_progress'
    return { type, value, conditionCount };
}

export async function renderAchievementsList() {
    if (!appState.currentUser || !appState.currentUser.studentId) return;
    showLoading('讀取成就...');

    try {
        // 1. Fetch all achievement definitions
        const achievementsQuery = query(collection(db, "achievements"), orderBy("createdAt", "desc"));
        const allAchievementsSnapshot = await getDocs(achievementsQuery);
        const allAchievements = allAchievementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 2. Fetch unlocked achievements for the current student
        const unlockedQuery = query(collection(db, "student_achievements"), where("studentId", "==", appState.currentUser.studentId));
        const unlockedSnapshot = await getDocs(unlockedQuery);
        const unlockedAchievements = unlockedSnapshot.docs.map(doc => doc.data());

        // 3. Get student submissions for progress calculation
        const studentSubmissions = appState.allSubmissions || [];

        // 4. Define achievement categories for grouping
        const categoryOrder = [
            { key: 'basic', name: '📚 基本成就', types: ['submission_count', 'login_streak', 'high_score_streak', 'completion_streak'] },
            { key: 'performance', name: '🎯 學習表現', types: ['average_score', 'genre_explorer', 'weekly_progress'] },
            { key: 'content', name: '📖 閱讀廣度 (內容)', types: ['read_tag_contentType_記敘', 'read_tag_contentType_抒情', 'read_tag_contentType_說明', 'read_tag_contentType_議論', 'read_tag_contentType_應用'] },
            { key: 'difficulty', name: '⭐ 閱讀廣度 (難度)', types: ['read_tag_difficulty_基礎', 'read_tag_difficulty_普通', 'read_tag_difficulty_進階', 'read_tag_difficulty_困難'] }
        ];

        const unlockedIds = new Set(unlockedAchievements.map(ua => ua.achievementId));

        // 5. Filter and categorize achievements
        const filteredAchievements = allAchievements
            .filter(ach => ach.isEnabled && (!ach.isHidden || unlockedIds.has(ach.id)));

        // 6. Prepare achievements with full data for progress calculation
        const modalAchievements = filteredAchievements.map(ach => {
            const condition = (ach.conditions && ach.conditions.length > 0) ? ach.conditions[0] : null;
            return {
                id: ach.id,
                title: ach.name,
                description: ach.description,
                icon: ach.icon,
                condition: condition,
                conditions: ach.conditions || []
            };
        });

        await renderModal('achievementsList', {
            allAchievements: modalAchievements,
            unlockedAchievements,
            studentData: appState.currentUser,
            studentSubmissions,
            categoryOrder
        });

    } catch (error) {
        console.error("Error rendering achievements list:", error);
        renderModal('message', { title: '錯誤', message: '無法載入成就列表。' });
    } finally {
        hideLoading();
    }
}

export function getConditionTypeName(type) {
    const typeNames = {
        'submission_count': '閱讀篇數',
        'login_streak': '連續登入',
        'high_score_streak': '高分連勝',
        'average_score': '平均分數',
        'genre_explorer': '探索體裁',
        'specific_assignment': '完成特定任務',
        'specific_score': '達成特定分數',
        'manual_award': '手動授予'
    };
    // Handle dynamic tag-based types
    if (type.startsWith('read_tag_')) {
        const parts = type.split('_');
        if (parts.length === 4) {
            const [, , category, value] = parts;
            return `閱讀 ${category}:${value}`;
        }
    }
    return typeNames[type] || type;
}

export async function loadStudentsForClass(classId) {
    // Return cached data if available
    if (appState.students && appState.students[classId]) {
        return appState.students[classId];
    }

    try {
        const studentsRef = collection(db, `classes/${classId}/students`);
        const snapshot = await getDocs(studentsRef);

        if (snapshot.empty) {
            console.log(`學堂 ${classId} 中沒有學生。`);
            if (!appState.students) { appState.students = {}; }
            appState.students[classId] = []; // Cache empty result
            return [];
        }

        const studentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (!appState.students) { appState.students = {}; }
        appState.students[classId] = studentList; // Cache the list
        return studentList;
    } catch (error) {
        console.error(`無法載入學堂 ${classId} 的學生:`, error);
        // In case of error, return null to let the caller handle it
        return null;
    }
}


// Expose to window for UI event handlers
window.showArticleContent = showArticleContent;
window.renderStudentUI = renderStudentUI;
window.populateClassSelectors = populateClassSelectors;
window.populateStudentLoginSelector = populateStudentLoginSelector;


window.createFullArticleCard = createFullArticleCard;
window.submitQuiz = submitQuiz;
window.displayResults = displayResults;
window.displayStudentAnalysis = displayStudentAnalysis;
window.handleTextSelection = handleTextSelection;
window.applyHighlight = applyHighlight;
window.removeHighlight = removeHighlight;
window.saveHighlights = saveHighlights;
window.loadAndApplyHighlights = loadAndApplyHighlights;
window.handleHighlightToolbarAction = handleHighlightToolbarAction;
window.checkAndAwardAchievements = checkAndAwardAchievements;
window.getStartOfWeek = getStartOfWeek;
window.getWeekId = getWeekId;
window.getAchievementSortKeys = getAchievementSortKeys;
window.renderAchievementsList = renderAchievementsList;
window.getConditionTypeName = getConditionTypeName;
window.loadStudentsForClass = loadStudentsForClass;