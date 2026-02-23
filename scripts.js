import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, getDocs, onSnapshot, query, where, writeBatch, setDoc, deleteDoc, updateDoc, arrayUnion, Timestamp, getDoc, orderBy, limit, startAfter, deleteField } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

import { appState, dom, DEFAULT_GEMINI_MODEL, ARTICLES_PER_PAGE, TEACHER_PASSWORD_HASH, db, auth, app, appId, mermaidInitialized, setMermaidInitialized, mermaidLoadPromise, setMermaidLoadPromise } from './state.js';
import { el, updateElement, escapeHtml, normalizeClassName, generateDefaultPassword, markdownToHtml, formatSubmissionTime, formatTime, getLocalDateString, hashString } from './utils.js';
import { loadStudentSubmissions, loadSubmissionsByClass, loadSubmissionsByAssignment, getAssignments } from './api.js';

import { closeModal, modalHtmlGenerators, renderModal, attachModalEventListeners, showLoading, hideLoading } from './ui.js';
import { handleStudentLogin, handleTeacherLogin, handleLogout, handleChangePassword, initializeAuthObserver } from './auth.js';
import { callGenerativeAI, callFullGeminiAnalysis, handleAnalysisAI, handleAiRewrite, handleAiGenerateAchievement, callAchievementAI, callSingleGeminiAnalysis, callAiHelp } from './ai.js';

// Teacher & Student modules
import { renderTeacherUI, switchTeacherTab, updateBulkActionsVisibility, updateTeacherLoadMoreButton, renderTeacherArticleTable, updateRosterDisplay, renderOverdueReport, handleDeleteClass, handleAddStudent, handleBulkImport, handleEditStudent, handleDeleteStudent, handleEditArticle, bulkUpdatePublicStatus, handleDeleteArticle, handleBulkDelete, generateAssignment, updateAssignedArticlesList, fetchTeacherAssignmentsPage, openEditModal, handleSaveEdit, handleStudentAiAnalysis, displaySubmissionReview, setupTeacherEventListeners } from './teacher.js';
import { showArticleContent, renderStudentUI, populateClassSelectors, populateStudentLoginSelector, createFullArticleCard, submitQuiz, displayResults, displayStudentAnalysis, handleTextSelection, checkAndAwardAchievements, renderAchievementsList, loadStudentsForClass } from './student.js';

// 初始化驗證監聽
initializeAuthObserver();

// --- View Management ---
export function showView(viewName, data = {}) {
    dom.loginView.classList.add('hidden');
    dom.mainAppView.classList.add('hidden');
    dom.loginView.innerHTML = '';
    appState.currentView = viewName; // Update current view state

    // Dynamically apply background for the login page
    if (viewName === 'login' || viewName === 'error') {
        document.body.classList.add('login-background');
    } else {
        document.body.classList.remove('login-background');
    }

    if (viewName === 'login') {
        const template = document.getElementById('template-login-view');
        if (template) {
            const content = template.content.cloneNode(true);
            dom.loginView.appendChild(content);

            // Daily Quote Logic
            const quotes = [
                "學而時習之，不亦說乎？有朋自遠方來，不亦樂乎？",
                "溫故而知新，可以為師矣。",
                "學而不思則罔，思而不學則殆。",
                "知之者不如好之者，好之者不如樂之者。",
                "三人行，必有我師焉。擇其善者而從之，其不善者而改之。",
                "逝者如斯夫，不舍晝夜。",
                "歲寒，然後知松柏之後凋也。",
                "君子坦蕩蕩，小人長戚戚。",
                "工欲善其事，必先利其器。",
                "學如逆水行舟，不進則退。",
                "讀書破萬卷，下筆如有神。",
                "黑髮不知勤學早，白首方悔讀書遲。",
                "書山有路勤為徑，學海無涯苦作舟。",
                "博學之，審問之，慎思之，明辨之，篤行之。",
                "非淡泊無以明志，非寧靜無以致遠。",
                "勿以惡小而為之，勿以善小而不為。",
                "天行健，君子以自強不息；地勢坤，君子以厚德載物。",
                "路漫漫其修遠兮，吾將上下而求索。",
                "奇文共欣賞，疑義相與析。",
                "問渠那得清如許？為有源頭活水來。"
            ];
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            const quoteEl = dom.loginView.querySelector('#daily-quote p');
            const quoteContainer = dom.loginView.querySelector('#daily-quote');
            if (quoteEl && quoteContainer) {
                quoteEl.textContent = randomQuote;
                quoteContainer.classList.remove('hidden');
                // Simple fade-in animation
                quoteContainer.animate([
                    { opacity: 0, transform: 'translateY(10px)' },
                    { opacity: 1, transform: 'translateY(0)' }
                ], {
                    duration: 800,
                    easing: 'ease-out',
                    fill: 'forwards',
                    delay: 500 // Wait for card animation
                });
            }
        }
        dom.loginView.classList.remove('hidden');
    } else if (viewName === 'app') {
        dom.mainAppView.classList.remove('hidden');
        // Default to student view when app is shown
        switchViewTab('student');
    } else if (viewName === 'error') {
        dom.loginView.innerHTML = `<div class="card text-center text-red-600"><h2 class="text-xl font-bold">${data.title || '書院開啟失敗'}</h2><p>${data.message || '書院初始化或憑證驗證失敗，請刷新頁面或聯繫夫子。'}</p></div>`;
        dom.loginView.classList.remove('hidden');
    }
}

// --- Modal Management ---


function closeTopModal() {
    closeModal();
}

;

modalHtmlGenerators.achievementForm = function (data) {
    return new Promise(resolve => {
        const isEditing = data && data.achievement;
        const ach = isEditing ? data.achievement : {};
        const title = isEditing ? '編輯成就' : '新增成就';

        const formContent = el('div', { class: 'card max-w-2xl w-full' }, [
            el('h2', { class: 'text-2xl font-bold mb-6 text-gray-800 font-rounded', textContent: title }),
            el('div', { class: 'space-y-4' }, [
                el('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-4' }, [
                    el('div', {}, [
                        el('label', { class: 'font-bold text-sm', textContent: '成就名稱' }),
                        el('input', { type: 'text', id: 'ach-name', class: 'w-full form-element-ink mt-1', value: ach.name || '' })
                    ]),
                    el('div', {}, [
                        el('label', { class: 'font-bold text-sm', textContent: '圖示 (HTML)' }),
                        el('input', { type: 'text', id: 'ach-icon', class: 'w-full form-element-ink mt-1', value: ach.icon || '' })
                    ])
                ]),
                el('div', {}, [
                    el('label', { class: 'font-bold text-sm', textContent: '描述' }),
                    el('textarea', { id: 'ach-description', class: 'w-full form-element-ink mt-1', rows: '3', textContent: ach.description || '' })
                ]),
                el('div', { class: 'w-full' }, [
                    el('label', { class: 'font-bold text-sm mb-2 block', textContent: '成就條件 (所有條件需同時滿足)' }),
                    el('div', { id: 'conditions-container', class: 'space-y-3' }),
                    el('button', {
                        id: 'add-condition-btn',
                        type: 'button',
                        class: 'btn-secondary-outline text-sm py-1 px-3 mt-3',
                        textContent: '+ 新增條件'
                    })
                ]),
                el('div', { class: 'flex items-center space-x-8 pt-2' }, [
                    el('label', { class: 'flex items-center gap-2 cursor-pointer' }, [
                        el('input', { type: 'checkbox', id: 'ach-isEnabled', class: 'h-4 w-4 rounded' }),
                        el('span', { class: 'font-bold text-sm', textContent: '啟用此成就' })
                    ]),
                    el('label', { class: 'flex items-center gap-2 cursor-pointer' }, [
                        el('input', { type: 'checkbox', id: 'ach-isHidden', class: 'h-4 w-4 rounded' }),
                        el('span', { class: 'font-bold text-sm', textContent: '設為隱藏成就' })
                    ]),
                    el('label', { class: 'flex items-center gap-2 cursor-pointer' }, [
                        el('input', { type: 'checkbox', id: 'ach-isRepeatable', class: 'h-4 w-4 rounded' }),
                        el('span', { class: 'font-bold text-sm', textContent: '可重複獲得' })
                    ])
                ])
            ]),
            el('p', { id: 'ach-form-error', class: 'text-red-500 text-sm h-4 mt-4' }),
            el('div', { class: 'flex justify-between items-center mt-6' }, [
                el('button', { id: 'ai-generate-achievement-btn', class: 'btn-teal py-2 px-5 font-bold', textContent: 'AI 發想' }),
                el('div', { class: 'flex gap-4' }, [
                    el('button', { id: 'cancel-ach-form-btn', class: 'btn-secondary py-2 px-5 font-bold', textContent: '返回' }),
                    el('button', { id: 'save-ach-form-btn', 'data-id': isEditing ? ach.id : '', class: 'btn-primary py-2 px-5 font-bold', textContent: '儲存' })
                ])
            ])
        ]);

        // --- Logic for the new dynamic condition form ---

        const conditionOptions = [
            {
                label: '基本成就', options: [
                    { value: 'submission_count', text: '總閱讀篇數' },
                    { value: 'login_streak', text: '連續登入天數' },
                    { value: 'high_score_streak', text: '連續高分次數' },
                    { value: 'completion_streak', text: '課業完成率100%連續天數' },
                ]
            },
            {
                label: '學習表現', options: [
                    { value: 'average_score', text: '平均分數達標' },
                    { value: 'genre_explorer', text: '文體全通 (完成 N 種文體)' },
                    { value: 'weekly_progress', text: '本週進步 (與上週比)' },
                ]
            },
            {
                label: '閱讀廣度 (內容)', options:
                    ['記敘', '抒情', '說明', '議論', '應用'].map(tag => ({ value: `read_tag_contentType_${tag}`, text: `完成「${tag}」文章數` }))
            },
            {
                label: '閱讀廣度 (難度)', options:
                    ['基礎', '普通', '進階', '困難'].map(tag => ({ value: `read_tag_difficulty_${tag}`, text: `完成「${tag}」文章數` }))
            }
        ];
        // Expose conditionOptions for AI function
        modalHtmlGenerators.achievementForm.conditionOptions = conditionOptions;

        function renderConditionBlock(condition = {}) {
            const container = document.getElementById('conditions-container');
            const conditionDiv = el('div', { class: 'condition-block flex items-center gap-2 p-2 border rounded-md bg-gray-50' }, [
                el('div', { class: 'flex-grow' }, [
                    el('select', { class: 'ach-condition-type w-full form-element-ink' },
                        [el('option', { value: '', textContent: '---選取條件類型---' })].concat(
                            conditionOptions.map(group =>
                                el('optgroup', { label: group.label },
                                    group.options.map(opt => el('option', { value: opt.value, textContent: opt.text }))
                                )
                            )
                        )
                    )
                ]),
                el('div', { class: 'flex-grow' }, [
                    el('input', { type: 'number', class: 'ach-condition-value w-full form-element-ink', placeholder: '條件值' })
                ]),
                el('button', { type: 'button', class: 'remove-condition-btn btn-danger-outline text-xl font-bold w-8 h-8 flex items-center justify-center', textContent: '×' })
            ]);

            // Set values if editing
            if (condition.type) {
                conditionDiv.querySelector('.ach-condition-type').value = condition.type;
            }
            if (condition.value) {
                conditionDiv.querySelector('.ach-condition-value').value = condition.value;
            }

            container.appendChild(conditionDiv);

            // After appending, check and set initial visibility
            const typeSelect = conditionDiv.querySelector('.ach-condition-type');
            const valueInput = conditionDiv.querySelector('.ach-condition-value');
            const typesWithoutValue = ['weekly_progress'];
            valueInput.style.display = typesWithoutValue.includes(typeSelect.value) ? 'none' : '';
        }

        // Initial state & Event listeners
        setTimeout(() => {
            if (isEditing) {
                if (ach.conditions && Array.isArray(ach.conditions)) {
                    ach.conditions.forEach(cond => renderConditionBlock(cond));
                } else if (ach.type) { // Backward compatibility for old format
                    renderConditionBlock({ type: ach.type, value: ach.value });
                }
                document.getElementById('ach-isEnabled').checked = ach.isEnabled;
                document.getElementById('ach-isHidden').checked = ach.isHidden;
                document.getElementById('ach-isRepeatable').checked = ach.isRepeatable;
            } else {
                renderConditionBlock(); // Start with one empty block
                document.getElementById('ach-isEnabled').checked = true;
            }

            // Attach event listeners now that the modal is in the DOM
            document.getElementById('add-condition-btn').addEventListener('click', () => renderConditionBlock());
            document.getElementById('conditions-container').addEventListener('click', function (e) {
                if (e.target && e.target.classList.contains('remove-condition-btn')) {
                    e.target.closest('.condition-block').remove();
                }
            });

            document.getElementById('conditions-container').addEventListener('change', function (e) {
                if (e.target && e.target.classList.contains('ach-condition-type')) {
                    const conditionBlock = e.target.closest('.condition-block');
                    const valueInput = conditionBlock.querySelector('.ach-condition-value');
                    const typesWithoutValue = ['weekly_progress'];

                    if (typesWithoutValue.includes(e.target.value)) {
                        valueInput.style.display = 'none';
                        valueInput.value = ''; // Clear value when hidden
                    } else {
                        valueInput.style.display = '';
                    }
                }
            });
        }, 0);

        const base = this._base('', 60); // Higher z-index
        const baseElement = document.createElement('div');
        baseElement.innerHTML = base;
        baseElement.querySelector('.modal-backdrop').appendChild(formContent);
        resolve(baseElement.innerHTML);
    });
}











export function startQuizTimer() {
    stopQuizTimer(); // Ensure no multiple timers running
    appState.quizTimer.startTime = Date.now();
    appState.quizTimer.elapsedSeconds = 0;
    const timerElement = document.getElementById('quiz-timer-display');
    if (timerElement) {
        timerElement.textContent = formatTime(0);
    }

    appState.quizTimer.intervalId = setInterval(() => {
        const now = Date.now();
        appState.quizTimer.elapsedSeconds = Math.floor((now - appState.quizTimer.startTime) / 1000);
        if (timerElement) {
            timerElement.textContent = formatTime(appState.quizTimer.elapsedSeconds);
        }
    }, 1000);
}

export function stopQuizTimer(preserveDisplay = false) {
    if (appState.quizTimer.intervalId) {
        clearInterval(appState.quizTimer.intervalId);
        appState.quizTimer.intervalId = null;
    }
    if (!preserveDisplay) {
        appState.quizTimer.elapsedSeconds = 0;
        const timerDisplay = document.getElementById('quiz-timer-display');
        if (timerDisplay) timerDisplay.textContent = '00:00';
    }
}


async function initializeAppCore() {
    setupEventListeners();
    setupTeacherEventListeners();
    try {
        // First, fetch the API Key from Firestore
        const settingsDoc = await getDoc(doc(db, "settings", "api_keys"));
        if (settingsDoc.exists()) {
            const settings = settingsDoc.data();
            appState.geminiApiKey = settings.gemini || null;
            appState.geminiModel = settings.model || DEFAULT_GEMINI_MODEL; // Default model (Student/Frontend)
            appState.teacherGeminiModel = settings.teacherModel || appState.geminiModel; // Teacher/Backend model, fallback to default
        } else {
            console.error("Gemini API Key not found in Firestore under settings/api_keys");
            appState.teacherGeminiModel = DEFAULT_GEMINI_MODEL;
            // We don't show a fatal error here, but AI features will fail.
            // The error will be caught when an AI function is called.
        }

        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }

        // 檢查儲存的登入狀態
        const savedUser = localStorage.getItem(`currentUser_${appId}`);
        if (savedUser) {
            appState.currentUser = JSON.parse(savedUser);

            // 📌 每日登入檢查：從 localStorage 恢復的使用者也需要更新 streak
            if (appState.currentUser.type === 'student' && appState.currentUser.studentId) {
                try {
                    const studentDocRef = doc(db, `classes/${appState.currentUser.classId}/students`, appState.currentUser.studentId);
                    const studentDoc = await getDoc(studentDocRef);
                    if (studentDoc.exists()) {
                        await processUserLogin(studentDoc.data(), appState.currentUser.studentId, appState.currentUser.classId);
                        // 同步更新 localStorage
                        localStorage.setItem(`currentUser_${appId}`, JSON.stringify(appState.currentUser));
                    }
                } catch (error) {
                    console.error("[Daily Login Check] Error:", error);
                }
            }

            await loadStudentSubmissions(appState.currentUser.studentId);
            if (appState.currentUser.type === 'student') {
                document.getElementById('teacher-view-btn').classList.add('hidden');
                document.getElementById('view-tabs').classList.add('hidden');
                switchViewTab('student');
            } else if (appState.currentUser.type === 'teacher') {
                document.getElementById('teacher-view-btn').classList.remove('hidden');
                document.getElementById('view-tabs').classList.remove('hidden');
                switchViewTab('student'); // 預設顯示學生視角，老師可自行切換
            }
            showView('app');
            requestAnimationFrame(updateHeader); // Update header after view is shown
        } else {
            showView('login');
        }

        // The logic for ensuring teacher settings/user exists is now handled
        // by the login and password change functions. This block is obsolete.
        loadAllData();
    } catch (error) {
        console.error("Authentication or Initialization failed:", error);
        showView('error', { title: '書院開啟失敗', message: '書院初始化或憑證驗證失敗，請刷新頁面或聯繫夫子。' });
    } finally {
        dom.appLoader.classList.add('hidden');
    }
}

export function loadAllData() {
    const commonErrorHandler = (name) => (error) => console.error(`讀取${name}有誤:`, error);

    onSnapshot(query(collection(db, "classes")), snapshot => {
        let wasSelectedClassRemoved = false;
        const selectedClassId = document.getElementById('class-selector')?.value;

        snapshot.docChanges().forEach(change => {
            const doc = change.doc;
            const classData = { id: doc.id, ...doc.data() };
            const index = appState.allClasses.findIndex(c => c.id === doc.id);

            if (change.type === "added") {
                if (index === -1) appState.allClasses.push(classData);
            }
            if (change.type === "modified") {
                if (index > -1) appState.allClasses[index] = classData;
            }
            if (change.type === "removed") {
                if (index > -1) appState.allClasses.splice(index, 1);
                if (doc.id === selectedClassId) {
                    wasSelectedClassRemoved = true;
                }
            }
        });

        appState.allClasses.sort((a, b) => a.className.localeCompare(b.className, 'zh-Hant'));

        populateClassSelectors();

        if (wasSelectedClassRemoved) {
            // If the active class was deleted, re-render the management panel to its empty state.
            renderClassManagement(null);
        }

    }, commonErrorHandler('班級'));

}

export function updateHeader() {
    const avatarDiv = document.getElementById('user-avatar');
    const avatarTextSpan = document.getElementById('user-avatar-text');
    const userGreeting = document.getElementById('user-greeting');
    const userClass = document.getElementById('user-class');
    const viewTabsContainer = document.getElementById('view-tabs-container');

    if (!appState.currentUser || !appState.currentUser.name) {
        userGreeting.textContent = '歡迎！';
        userClass.textContent = '訪客';
        avatarDiv.classList.remove('avatar-seal');
        avatarDiv.classList.add('bg-gray-200');
        avatarTextSpan.textContent = '?';
        avatarTextSpan.className = 'text-xl font-bold text-gray-600';
        if (viewTabsContainer) viewTabsContainer.classList.add('hidden');
        return;
    }

    const lastChar = appState.currentUser.name.slice(-1);

    avatarDiv.classList.remove('bg-gray-200');
    avatarDiv.classList.add('avatar-seal');
    avatarTextSpan.className = 'avatar-seal-text';
    avatarTextSpan.textContent = lastChar;

    if (appState.currentUser.type === 'student') {
        userGreeting.textContent = `學子 ${appState.currentUser.name}`;
        userClass.textContent = appState.currentUser.className || '尚未分班';
    } else if (appState.currentUser.type === 'teacher') {
        userGreeting.textContent = `夫子 ${appState.currentUser.name}`;
        userClass.textContent = '指導中';
    }

    if (viewTabsContainer) {
        viewTabsContainer.classList.toggle('hidden', appState.currentUser.type !== 'teacher');
    }
}

function renderAllViews() {
    // This function is now deprecated and replaced by more granular rendering.
    // Kept empty to avoid breaking any potential old references, will be removed later.
}

export async function showArticleGrid() {
    // Clear existing articles and reset state for a fresh view
    const container = document.getElementById('assignment-grid-container');
    if (container) {
        container.innerHTML = ''; // Clear previous content
    }
    // Fetch the first page of articles
    await fetchAssignmentsPage(true);
    document.getElementById('student-sidebar').classList.remove('hidden');
    const readingView = document.getElementById('reading-view');
    readingView.classList.remove('lg:col-span-3', 'reading-mode');
    readingView.classList.add('lg:col-span-2');
    readingView.style.padding = ''; // Let the .card style restore padding

    document.getElementById('article-grid-view')?.classList.remove('hidden');
    document.getElementById('analysis-display')?.classList.add('hidden'); // Hide analysis view
    const contentView = document.getElementById('content-display');
    if (contentView) {
        contentView.classList.add('hidden');
        contentView.innerHTML = '';
    }
    appState.currentAssignment = null;
}







export function switchViewTab(view) {
    appState.currentView = view; // Update current view state
    const container = document.getElementById('app-content-container');
    if (!container) return;

    container.innerHTML = ''; // Clear previous view

    const templateId = view === 'student' ? 'template-student-view' : 'template-teacher-view';
    const template = document.getElementById(templateId);

    if (template) {
        const content = template.content.cloneNode(true);
        container.appendChild(content);
    }

    document.getElementById('student-view-btn').classList.toggle('active', view === 'student');
    document.getElementById('teacher-view-btn').classList.toggle('active', view === 'teacher');

    if (view === 'teacher') {
        appState.currentAssignment = null;
        renderTeacherUI();
    } else {
        // Re-render necessary components for student view
        fetchAssignmentsPage(true);
        renderCalendar();
        // renderAssignmentsList is now called by fetchAssignmentsPage
    }
}





















export async function calculateCompletionStreak(studentId, studentData) {
    console.log(`[Completion Streak] Starting check for student ${studentId}`);
    const updates = {};
    const todayStr = getLocalDateString(new Date());

    const lastCheckDate = studentData.lastCompletionCheckDate;
    const lastCheckStr = (lastCheckDate && typeof lastCheckDate.toDate === 'function')
        ? getLocalDateString(lastCheckDate.toDate())
        : null;

    if (lastCheckStr === todayStr) {
        console.log(`[Completion Streak] Check already performed today. No update needed.`);
        return {};
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    const assignmentsQuery = query(
        collection(db, "assignments"),
        where("deadline", "<=", Timestamp.fromDate(yesterday))
    );
    const dueAssignmentsSnapshot = await getDocs(assignmentsQuery);
    const dueAssignments = dueAssignmentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`[Completion Streak] Found ${dueAssignments.length} assignments due by yesterday.`);

    if (dueAssignments.length === 0) {
        console.log(`[Completion Streak] No assignments were due. Streak is not broken, only check date updates.`);
        updates.lastCompletionCheckDate = Timestamp.now();
        return updates;
    }

    const userSubmissions = await loadStudentSubmissions(studentId);
    const userSubmissionIds = new Set((userSubmissions || []).map(s => s.assignmentId));
    const allDueAssignmentsCompleted = dueAssignments.every(a => userSubmissionIds.has(a.id));

    if (allDueAssignmentsCompleted) {
        console.log(`[Completion Streak] All ${dueAssignments.length} due assignments were completed.`);
        updates.completionStreak = (studentData.completionStreak || 0) + 1;
        console.log(`[Completion Streak] New streak: ${updates.completionStreak}`);
    } else {
        console.log(`[Completion Streak] Not all due assignments were completed. Streak reset.`);
        updates.completionStreak = 0;
    }

    updates.lastCompletionCheckDate = Timestamp.now();
    return updates;
}





export async function processUserLogin(userData, userId, classId) {
    try {
        const userRef = doc(db, `classes/${classId}/students`, userId);
        let updates = {};
        const todayStr = getLocalDateString(new Date());

        // 1. Login Streak
        const lastLogin = userData.lastLoginDate ? getLocalDateString(userData.lastLoginDate.toDate()) : null;
        if (lastLogin !== todayStr) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getLocalDateString(yesterday);
            if (lastLogin === yesterdayStr) {
                updates.loginStreak = (userData.loginStreak || 0) + 1;
            } else {
                updates.loginStreak = 1;
            }
            updates.lastLoginDate = Timestamp.now();
        }

        // 2. Completion Streak (for any user type, e.g., teacher)
        const completionUpdates = await calculateCompletionStreak(userId, { ...userData, ...updates });
        updates = { ...updates, ...completionUpdates };

        if (Object.keys(updates).length > 0) {
            await updateDoc(userRef, updates);
            Object.assign(appState.currentUser, updates);
            console.log(`User ${userId} - Updated streaks:`, updates);
        }

        checkAndAwardAchievements(userId, 'login', appState.currentUser);

    } catch (error) {
        console.error(`Failed to process login for user ${userId}:`, error);
    }
}


export async function renderCalendar() {
    const calendarEl = document.getElementById('calendar-view');
    if (!calendarEl) return;

    const allAssignments = await getAssignments();

    appState.calendarDisplayDate = appState.calendarDisplayDate || new Date();
    const displayDate = appState.calendarDisplayDate;

    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayIndex = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const now = new Date();
    const today = (now.getFullYear() === year && now.getMonth() === month) ? now.getDate() : -1;

    let header = `
                <div class="flex justify-between items-center mb-2">
                    <button id="prev-month-btn" class="p-1 rounded-full hover:bg-gray-200"><</button>
                    <h4 class="font-bold">${year}年 ${month + 1}月</h4>
                    <button id="next-month-btn" class="p-1 rounded-full hover:bg-gray-200">></button>
                </div>`;

    let weekDays = `<div class="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">` + ['日', '一', '二', '三', '四', '五', '六'].map(d => `<div>${d}</div>`).join('') + `</div>`;

    let daysGrid = `<div class="grid grid-cols-7 gap-1 mt-2">`;
    for (let i = 0; i < firstDayIndex; i++) daysGrid += `<div></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
        const dayString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const deadlines = allAssignments.filter(a => {
            const isStudentUser = appState.currentUser?.type === 'student';
            if (isStudentUser && a.isPublic !== true) {
                return false;
            }
            return a.deadline && a.deadline.toDate().toISOString().startsWith(dayString);
        });

        let dayClasses = "h-9 flex items-center justify-center rounded-full text-sm relative cursor-pointer hover:bg-gray-100";
        if (day === today) {
            dayClasses += " bg-gray-800 text-white font-bold is-today";
        }

        let deadlineMarkers = deadlines.map(() => `<div class="absolute bottom-1 w-1.5 h-1.5 bg-red-500 rounded-full"></div>`).join('');
        daysGrid += `<div data-date="${dayString}" class="calendar-day ${dayClasses}">${day}${deadlineMarkers}</div>`;
    }
    daysGrid += `</div>`;

    calendarEl.innerHTML = header + weekDays + daysGrid;

    // Event Listeners
    calendarEl.querySelectorAll('.calendar-day').forEach(dayEl => {
        dayEl.addEventListener('click', (e) => {
            const target = e.currentTarget;
            appState.calendarFilterDate = target.dataset.date;

            // Visually mark the selected day
            // Visually mark the selected day, while correctly handling the "today" style
            calendarEl.querySelectorAll('.calendar-day').forEach(d => {
                // Remove selection-related styles from all days
                d.classList.remove('bg-red-700', 'text-white');

                // If the day is 'today', ensure its original style is restored.
                if (d.classList.contains('is-today')) {
                    d.classList.add('bg-gray-800', 'text-white', 'font-bold');
                }
            });

            // Add selection style to the clicked day. This will override the 'today' style if needed.
            target.classList.add('bg-red-700', 'text-white');

            // Reset other filters
            document.getElementById('filter-format').value = '';
            document.getElementById('filter-contentType').value = '';
            document.getElementById('filter-difficulty').value = '';
            document.getElementById('filter-status').value = '';
            appState.articleQueryState.filters = { format: '', contentType: '', difficulty: '', status: '' };

            // Fetch assignments for the selected date
            fetchAssignmentsPage(true);
        });
    });

    const prevBtn = document.getElementById('prev-month-btn');
    const nextBtn = document.getElementById('next-month-btn');

    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => {
            appState.calendarDisplayDate.setMonth(appState.calendarDisplayDate.getMonth() - 1);
            renderCalendar();
        });

        nextBtn.addEventListener('click', () => {
            appState.calendarDisplayDate.setMonth(appState.calendarDisplayDate.getMonth() + 1);
            renderCalendar();
        });
    }
}

export function renderAssignmentsList(assignmentsToRender) {
    const listEl = document.getElementById('assignments-list');
    if (!listEl) return;

    listEl.innerHTML = ''; // Clear previous content

    if (assignmentsToRender.length === 0) {
        listEl.appendChild(el('p', { class: 'text-slate-500 text-center py-4', textContent: '太棒了！沒有設定期限的緊急任務。' }));
        return;
    }

    const fragment = document.createDocumentFragment();
    assignmentsToRender.forEach(assignment => {
        const deadlineDate = assignment.deadline.toDate();
        const isOverdue = new Date() > deadlineDate;
        const deadlineInfo = el('div', { class: 'mt-2 text-sm' });

        if (isOverdue) {
            deadlineInfo.appendChild(el('span', { class: 'text-xs font-bold text-red-500', textContent: '已過期' }));
        } else {
            deadlineInfo.appendChild(el('span', { class: 'text-xs text-slate-500', textContent: `期限: ${deadlineDate.getMonth() + 1}/${deadlineDate.getDate()}` }));
        }
        const statusBorderClass = isOverdue ? 'status-border-overdue' : 'status-border-incomplete';
        const item = el('div', {
            id: `assignment-list-item-${assignment.id}`,
            'data-assignment-id': assignment.id,
            class: `assignment-item ${statusBorderClass} p-4 bg-white border-y-2 border-r-2 border-l-0 border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer`
        }, [
            el('div', { class: 'flex justify-between items-center gap-3' }, [
                el('div', { class: 'flex-grow' }, [
                    el('h3', { class: 'font-semibold text-slate-800', textContent: assignment.title }),
                    deadlineInfo
                ])
            ])
        ]);
        item.addEventListener('click', () => displayAssignment(assignment));
        fragment.appendChild(item);
    });
    listEl.appendChild(fragment);
}

export async function fetchAssignmentsPage(isNewQuery = false) {
    const state = appState.articleQueryState;
    if (state.isLoading || (!isNewQuery && state.isLastPage)) return;

    state.isLoading = true;
    if (isNewQuery) {
        state.isLastPage = false;
        appState.assignments = [];
    }
    showLoading('正在擷取篇章...');

    try {
        const allAssignments = await getAssignments();
        const filters = state.filters;

        let filteredAssignments = allAssignments.filter(a => {
            // For student-type users, only show public assignments. Teachers can see all.
            const isStudentUser = appState.currentUser?.type === 'student';
            if (isStudentUser && a.isPublic !== true) {
                return false;
            }

            if (appState.calendarFilterDate) {
                if (!a.deadline) return false;
                const aDate = a.deadline.toDate().toISOString().split('T')[0];
                return aDate === appState.calendarFilterDate;
            }
            if (filters.format && a.tags?.format !== filters.format) return false;
            if (filters.contentType && a.tags?.contentType !== filters.contentType) return false;
            if (filters.difficulty && a.tags?.difficulty !== filters.difficulty) return false;
            if (filters.status) {
                const studentId = appState.currentUser?.studentId;
                const userSubs = studentId ? appState.allSubmissions.filter(s => s.studentId === studentId) : appState.allSubmissions;
                const passedIds = new Set(userSubs.filter(s => {
                    let best = s.score || 0;
                    if (s.attempts && s.attempts.length > 0) {
                        best = Math.max(...s.attempts.map(a => a.score));
                    }
                    return best >= 60;
                }).map(s => s.assignmentId));
                const isPassed = passedIds.has(a.id);
                if (filters.status === 'complete' && !isPassed) return false;
                if (filters.status === 'incomplete' && isPassed) return false;
            }
            return true;
        });

        const startIndex = isNewQuery ? 0 : appState.assignments.length;
        const newAssignments = filteredAssignments.slice(startIndex, startIndex + ARTICLES_PER_PAGE);

        if (newAssignments.length < ARTICLES_PER_PAGE || (startIndex + newAssignments.length) >= filteredAssignments.length) {
            state.isLastPage = true;
        }

        if (isNewQuery) {
            appState.assignments = newAssignments;
        } else {
            appState.assignments.push(...newAssignments);
        }

        renderArticleGrid(newAssignments, isNewQuery);
        updateAssignedArticlesList();

    } catch (error) {
        console.error("Error fetching assignments:", error);
    } finally {
        state.isLoading = false;
        hideLoading();
    }
}



export function renderArticleGrid(assignments = [], isNewQuery = false) {
    const gridContainer = document.getElementById('article-grid-container');
    const paginationContainer = document.getElementById('pagination-container');
    if (!gridContainer) return;

    if (isNewQuery) {
        gridContainer.innerHTML = '';
    }

    if (assignments.length === 0 && isNewQuery) {
        gridContainer.appendChild(el('div', { class: 'col-span-full text-center py-12' }, [
            el('h3', { class: 'text-xl text-slate-500', textContent: '找不到符合條件的篇章' }),
            el('p', { class: 'text-slate-400 mt-2', textContent: '請試著調整篩選條件。' })
        ]));
    } else {
        const fragment = document.createDocumentFragment();
        assignments.forEach(assignment => {
            fragment.appendChild(createFullArticleCard(assignment));
        });
        gridContainer.appendChild(fragment);
    }

    // Replace pagination with a "Load More" button
    if (paginationContainer) {
        paginationContainer.innerHTML = '';
        if (!appState.articleQueryState.isLastPage) {
            const loadMoreBtn = el('button', { id: 'load-more-btn', class: 'btn-primary mx-auto py-2 px-6', textContent: '載入更多' });
            loadMoreBtn.addEventListener('click', () => fetchAssignmentsPage(false));
            paginationContainer.appendChild(loadMoreBtn);
        }
    }
}




export function renderAnalysisContent(container, analysis) {
    container.innerHTML = ''; // Clear existing content
    if (analysis.mindmap) {
        container.appendChild(el('h2', { class: 'text-2xl font-bold mb-4', textContent: '心智圖' }));
        const mindmapDiv = el('div', { class: 'mermaid' }, [analysis.mindmap]);
        container.appendChild(mindmapDiv);
    }
    if (analysis.explanation) {
        container.appendChild(el('h2', { class: 'text-2xl font-bold mt-8 mb-4', textContent: '深度解析' }));
        // Custom rendering for explanation to avoid <p> tags and handle markdown
        const escapedText = analysis.explanation.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
        const boldedText = escapedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        const finalHtml = boldedText.replace(/\n/g, '<br>');
        container.appendChild(el('div', { innerHTML: finalHtml }));
    }
    if (analysis.thinking_questions) {
        container.appendChild(el('h2', { class: 'text-2xl font-bold mt-8 mb-4', textContent: '延伸思考' }));
        container.appendChild(el('div', { innerHTML: markdownToHtml(analysis.thinking_questions) }));
    }
}

export async function displayAssignment(assignment) {
    appState.currentAssignment = assignment;
    const contentDisplay = document.getElementById('content-display');
    contentDisplay.innerHTML = ''; // Clear previous content

    const submission = appState.currentUser?.studentId ? appState.allSubmissions.find(s => s.studentId === appState.currentUser.studentId && s.assignmentId === assignment.id) : null;
    const isCompleted = !!submission;
    const tags = assignment.tags || {};

    // Build tag elements
    const tagChildren = [];
    if (tags.format) tagChildren.push(el('span', { class: 'bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-medium', textContent: `#${tags.format}` }));
    if (tags.contentType) tagChildren.push(el('span', { class: 'bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-medium', textContent: `#${tags.contentType}` }));
    if (tags.difficulty) tagChildren.push(el('span', { class: 'bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium', textContent: `#${tags.difficulty}` }));
    const tagContainer = el('div', { class: 'flex flex-wrap gap-2 text-xs mb-6' }, tagChildren);

    // --- Tab Interface ---
    const articleTab = el('button', { 'data-tab': 'article', class: 'content-tab tab-btn active', textContent: '文章' });
    const analysisTab = el('button', { 'data-tab': 'analysis', class: 'content-tab tab-btn', textContent: '解析' });

    // 從 `submission.attempts` 中取得最高分
    let highestScore = 0;
    if (isCompleted) {
        if (submission.attempts && submission.attempts.length > 0) {
            highestScore = Math.max(...submission.attempts.map(a => a.score));
        } else {
            highestScore = submission.score; // 兼容舊資料
        }
    }

    // 只有最高分達 60 分才算真正「過關」鎖定選項，並開放解析
    const isPassed = isCompleted && highestScore >= 60;

    const hasAnalysis = assignment.analysis && (assignment.analysis.mindmap || assignment.analysis.explanation || assignment.analysis.thinking_questions);

    if (!isPassed || !hasAnalysis) {
        analysisTab.disabled = true;
        analysisTab.title = "得分達 60 分後即可查看";
    }
    const tabContainer = el('div', { class: 'border-b-2 border-gray-200 mb-6 flex space-x-1' }, [articleTab, analysisTab]);

    // --- Content Panels ---
    const articleBody = el('div', { id: 'article-body', class: 'prose-custom content-panel', innerHTML: markdownToHtml(assignment.article) });
    const analysisBody = el('div', { id: 'analysis-body', class: 'prose-custom content-panel hidden' });
    if (hasAnalysis) {
        renderAnalysisContent(analysisBody, assignment.analysis);
    }

    // --- 題目渲染邏輯變更 ---
    // 若已作答但未過關 (isCompleted && !isPassed)，找出最後一次的答案並預填，但保持 un-disabled 讓學生可修改
    const lastAttempt = isCompleted ? (submission.attempts && submission.attempts.length > 0 ? submission.attempts[submission.attempts.length - 1] : submission) : null;
    const lastAttemptAnswers = lastAttempt ? lastAttempt.answers : null;

    // 冷卻時間邏輯 (3分鐘 = 180秒)
    let cooldownRemainingSeconds = 0;
    if (isCompleted && !isPassed && lastAttempt && lastAttempt.submittedAt && lastAttempt.submittedAt.toDate) {
        const lastSubmittedMs = lastAttempt.submittedAt.toDate().getTime();
        const diffMs = Date.now() - lastSubmittedMs;
        const cooldownMs = 3 * 60 * 1000;
        if (diffMs < cooldownMs) {
            cooldownRemainingSeconds = Math.ceil((cooldownMs - diffMs) / 1000);
        }
    }
    const isLockedByCooldown = cooldownRemainingSeconds > 0;

    const questionElements = assignment.questions.map((q, index) => {
        const userAnswerIndex = lastAttemptAnswers ? lastAttemptAnswers[index] : null;
        const optionElements = q.options.map((option, optionIndex) => {
            const input = el('input', { type: 'radio', name: `question-${index}`, value: optionIndex, class: 'mr-3 h-5 w-5 text-red-800 focus:ring-red-500' });
            if (userAnswerIndex === optionIndex) input.checked = true;
            if (isPassed || isLockedByCooldown) input.disabled = true; // 真正過關或冷卻中鎖定
            return el('div', {}, [
                el('label', { class: 'flex items-center p-3 border rounded-lg hover:bg-slate-100 cursor-pointer' }, [
                    input,
                    el('span', { class: 'font-medium', textContent: option })
                ])
            ]);
        });
        return el('div', { class: 'mb-8' }, [
            el('p', { class: 'font-semibold text-lg', textContent: `${index + 1}. ${q.questionText}` }),
            el('div', { class: 'mt-4 space-y-2' }, optionElements)
        ]);
    });

    // Build submit button
    let submitButton;
    if (isPassed) {
        submitButton = el('button', { id: 'review-submission-btn', type: 'button', class: 'mt-8 w-full btn-secondary py-3 text-base font-bold', textContent: '審閱課卷' });
    } else {
        const btnText = isCompleted ? `再次挑戰 (前次最高分：${highestScore})` : '繳交課卷';
        submitButton = el('button', { type: 'submit', class: 'mt-8 w-full btn-primary py-3 text-base font-bold btn-seal', textContent: btnText });

        if (isLockedByCooldown) {
            submitButton.disabled = true;
            submitButton.classList.add('opacity-50', 'cursor-not-allowed');

            const formatCooldown = (secs) => {
                const m = Math.floor(secs / 60);
                const s = secs % 60;
                return `重新挑戰冷卻中... (剩餘 ${m}分 ${s}秒)`;
            };
            submitButton.textContent = formatCooldown(cooldownRemainingSeconds);

            if (appState.cooldownIntervalId) clearInterval(appState.cooldownIntervalId);
            appState.cooldownIntervalId = setInterval(() => {
                cooldownRemainingSeconds--;
                if (cooldownRemainingSeconds <= 0) {
                    clearInterval(appState.cooldownIntervalId);
                    appState.cooldownIntervalId = null;
                    submitButton.disabled = false;
                    submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
                    submitButton.textContent = `再次挑戰 (前次最高分：${highestScore})`;
                    // 解鎖選項
                    const quizFormElement = document.getElementById('quiz-form');
                    if (quizFormElement) {
                        quizFormElement.querySelectorAll('input[type="radio"]').forEach(radio => radio.disabled = false);
                    }
                } else {
                    submitButton.textContent = formatCooldown(cooldownRemainingSeconds);
                }
            }, 1000);
        }
    }

    // Build back button
    const backButton = el('button', { id: 'back-to-grid-btn', class: 'absolute top-6 left-6 btn-secondary py-2 px-4 text-sm flex items-center gap-2' }, [
        el('svg', { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", fill: "currentColor", viewBox: "0 0 16 16" }, [
            el('path', { 'fill-rule': "evenodd", d: "M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z" })
        ]),
        '返回'
    ]);

    // Assemble the view
    const formChildren = [
        el('h2', { class: 'text-2xl font-bold py-4 mb-4', textContent: '閱讀試煉' })
    ];

    if (isCompleted && submission.attempts && submission.attempts.length > 0) {
        const attemptsList = submission.attempts.map((att, idx) => {
            return el('li', { class: 'text-sm text-slate-700' }, `第 ${idx + 1} 次挑戰：得分 ${att.score} 分 (耗時 ${formatTime(att.durationSeconds || 0)})`);
        });
        formChildren.push(el('div', { class: 'mb-6 p-4 bg-sky-50 border border-sky-200 rounded-lg' }, [
            el('h3', { class: 'font-bold text-sky-800 mb-2' }, '📝 您的作答歷程'),
            el('ul', { class: 'list-disc list-inside space-y-1' }, attemptsList)
        ]));
    }

    if (isCompleted && !isPassed) {
        const aiHelpBtn = el('button', { id: 'ai-help-btn', type: 'button', class: 'mt-3 btn-primary py-2 px-4 text-sm font-bold flex items-center gap-2' }, [
            '🆘 AI 求救'
        ]);
        const aiHelpFeedback = el('div', { id: 'ai-help-feedback', class: 'hidden mt-3 p-4 bg-teal-50 border border-teal-200 rounded-lg text-left prose-custom' });

        aiHelpBtn.addEventListener('click', () => {
            aiHelpBtn.disabled = true;
            aiHelpBtn.innerHTML = '<div class="loader-sm"></div> AI 書僮思考中...';
            callAiHelp(assignment.article, assignment.questions, submission.attempts ? submission.attempts[submission.attempts.length - 1].answers : submission.answers)
                .then(feedback => {
                    aiHelpFeedback.innerHTML = `<h3 class="font-bold text-teal-800 mb-2">📖 AI 書僮的引導</h3>` + markdownToHtml(feedback);
                    aiHelpFeedback.classList.remove('hidden');
                    aiHelpFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    aiHelpBtn.textContent = '✅ 已取得引導';
                })
                .catch(err => {
                    console.error('[AI Help]', err);
                    aiHelpFeedback.innerHTML = '<p class="text-red-600">AI 書僮暫時無法回應，請稍後再試。</p>';
                    aiHelpFeedback.classList.remove('hidden');
                    aiHelpBtn.disabled = false;
                    aiHelpBtn.textContent = '🆘 AI 求救';
                });
        });

        formChildren.push(el('div', { class: 'mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg shadow-sm' }, [
            el('div', {}, [
                el('h3', { class: 'font-bold text-red-800 text-lg mb-1', textContent: '【挑戰尚未成功！】' }),
                el('p', { class: 'text-red-700 font-medium', textContent: `您的最高得分為 ${highestScore} 分，尚未達到 60 分過關門檻，因此標記為「未完成」。` }),
                el('p', { class: 'text-red-600 text-sm mt-1', textContent: `請您重新閱讀文章資訊並再次挑戰，過關後才能查看深度解析喔！` }),
                aiHelpBtn,
                aiHelpFeedback
            ])
        ]));
    }

    formChildren.push(...questionElements, submitButton);

    const quizForm = el('form', { id: 'quiz-form' }, formChildren);

    const timerDisplay = el('div', { id: 'quiz-timer-display', class: 'text-lg font-semibold text-gray-700 bg-gray-100 px-4 py-2 rounded-lg' }, '00:00');
    const topRightContainer = el('div', { class: 'absolute top-6 right-6 flex gap-2 items-center' });

    if (appState.currentUser.type === 'teacher') {
        const teacherActions = [
            el('button', {
                class: 'edit-article-btn btn-secondary py-2 px-4 text-sm',
                'data-assignment-id': assignment.id,
                textContent: '潤飾'
            }),
            el('button', {
                class: 'delete-article-btn btn-danger py-2 px-4 text-sm',
                'data-assignment-id': assignment.id,
                textContent: '刪除'
            })
        ];
        teacherActions.forEach(btn => topRightContainer.appendChild(btn));
    }

    topRightContainer.appendChild(timerDisplay);

    const mainContent = el('div', { class: 'p-6 relative' }, [
        backButton,
        topRightContainer,
        el('div', { class: 'mt-16 grid grid-cols-1 lg:grid-cols-3 lg:gap-8' }, [
            el('div', { class: 'lg:col-span-2' }, [
                el('article', {}, [
                    el('h1', { class: 'text-3xl font-bold mb-2', textContent: assignment.title }),
                    tagContainer,
                    tabContainer, // Add tabs here
                    articleBody,
                    analysisBody
                ])
            ]),
            el('div', { class: 'lg:col-span-1 mt-8 lg:mt-0' }, [
                el('div', { class: 'lg:sticky lg:top-8' }, [
                    el('div', { class: 'lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar p-1' }, [quizForm])
                ])
            ])
        ])
    ]);

    contentDisplay.appendChild(mainContent);

    let mindmapRendered = false;

    // Render Mermaid diagrams in the article body now that it's in the DOM
    renderAllMermaidDiagrams(contentDisplay.querySelector('#article-body'));

    showArticleContent();
    loadAndApplyHighlights(assignment.id);

    // --- Event Listeners ---
    backButton.addEventListener('click', () => {
        stopQuizTimer();
        if (appState.cooldownIntervalId) {
            clearInterval(appState.cooldownIntervalId);
            appState.cooldownIntervalId = null;
        }
        showArticleGrid();
    });
    articleBody.addEventListener('mouseup', handleTextSelection);
    articleBody.addEventListener('touchend', handleTextSelection);

    tabContainer.addEventListener('click', (e) => {
        const targetTab = e.target.closest('.tab-btn');
        if (!targetTab || targetTab.disabled) return;

        const tabName = targetTab.dataset.tab;

        // Update tab styles
        tabContainer.querySelectorAll('.tab-btn').forEach(tab => tab.classList.remove('active'));
        targetTab.classList.add('active');

        // Update content visibility
        contentDisplay.querySelectorAll('.content-panel').forEach(panel => panel.classList.add('hidden'));
        const targetPanel = contentDisplay.querySelector(`#${tabName}-body`);
        if (targetPanel) targetPanel.classList.remove('hidden');

        // Render mermaid in analysis tab using the new centralized function
        if (tabName === 'analysis' && !mindmapRendered && hasAnalysis) {
            renderAllMermaidDiagrams(contentDisplay.querySelector('#analysis-body'));
            mindmapRendered = true;
        }
    });

    // 事件監聽器的 `isCompleted` 必須改為判斷是否 `isPassed`
    if (isPassed) {
        submitButton.addEventListener('click', () => {
            if (submission) displayResults(submission.score, assignment, submission.answers);
        });
    } else {
        quizForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = submitButton; // submitButton is scoped from above
            if (btn) btn.disabled = true;
            try {
                await submitQuiz(assignment);
            } finally {
                if (btn) btn.disabled = false;
            }
        });
    }
    if (isPassed) {
        stopQuizTimer(); // Ensure no timers are running
        const timerDisplay = document.getElementById('quiz-timer-display');
        // display the first attempt duration for consistency
        const displayDuration = submission.attempts ? submission.attempts[0].durationSeconds : submission.durationSeconds;
        if (timerDisplay && displayDuration) {
            timerDisplay.textContent = formatTime(displayDuration);
        }
    } else {
        startQuizTimer();
    }
}

/**
 * Dynamically loads Mermaid library on demand.
 * Uses Mermaid v10 for best features; falls back to mermaid.ink image service on old devices.
 */
function loadMermaidLibrary() {
    if (window.mermaid) return Promise.resolve(true);
    if (mermaidLoadPromise) return mermaidLoadPromise;

    const promise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
        script.onload = () => {
            console.log('[Mermaid] Library v10 loaded.');
            resolve(true);
        };
        script.onerror = () => {
            console.warn('[Mermaid] Library failed to load.');
            resolve(false);
        };
        document.head.appendChild(script);
    });
    setMermaidLoadPromise(promise);
    return promise;
}

/**
 * Encode UTF-8 text to base64 (works with Chinese characters).
 */
function textToBase64(text) {
    try {
        const utf8Bytes = new TextEncoder().encode(text);
        let binaryStr = '';
        for (let i = 0; i < utf8Bytes.length; i++) {
            binaryStr += String.fromCharCode(utf8Bytes[i]);
        }
        return btoa(binaryStr);
    } catch (e) {
        // Fallback for very old browsers without TextEncoder
        return btoa(unescape(encodeURIComponent(text)));
    }
}

/**
 * Renders a Mermaid diagram as an image via the mermaid.ink cloud service.
 * This works on ANY device since it's just an <img> tag.
 * Falls back to text display if the image also fails.
 */
function renderMermaidAsImage(element, graphDefinition, rawText) {
    if (element.getAttribute('data-processed') === 'true') return;

    const base64 = textToBase64(graphDefinition);
    const imageUrl = `https://mermaid.ink/svg/${base64}`;

    element.innerHTML = '<div class="text-center p-6 text-slate-400 text-sm">圖表載入中...</div>';

    const img = new Image();
    img.onload = () => {
        element.innerHTML = '';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.alt = '圖表';
        element.appendChild(img);
        element.classList.remove('mermaid');
        element.setAttribute('data-processed', 'true');
    };
    img.onerror = () => {
        console.warn('[Mermaid] mermaid.ink image also failed.');
        showMermaidFallback(element, '此圖表無法渲染', rawText);
    };
    img.src = imageUrl;
}

/**
 * Last-resort text fallback for Mermaid diagrams.
 * Displays the raw syntax in a styled code block.
 */
function showMermaidFallback(element, reason, rawText) {
    if (element.getAttribute('data-processed') === 'true') return;
    const displayText = rawText || element.textContent || element.innerText || '';
    element.innerHTML = `<div class="my-4 rounded-lg border-2 border-slate-200 overflow-hidden">
        <div class="bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ${reason || '圖表 (您的裝置不支援即時渲染)'}
        </div>
        <pre class="p-4 text-sm text-slate-700 bg-white overflow-x-auto whitespace-pre-wrap" style="margin:0;">${displayText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </div>`;
    element.classList.remove('mermaid');
    element.setAttribute('data-processed', 'true');
}

/**
 * Renders all Mermaid diagrams in a container.
 * 
 * Three-tier fallback strategy:
 *   1. Client-side Mermaid JS rendering (fastest, modern devices)
 *   2. mermaid.ink cloud image service (works on any device with internet)
 *   3. Raw text display (works everywhere)
 */
export async function renderAllMermaidDiagrams(container) {
    const mermaidElements = Array.from(container.querySelectorAll('.mermaid'));
    if (mermaidElements.length === 0) return;

    // Cache raw text BEFORE any DOM mutation
    const rawTexts = mermaidElements.map(el => (el.textContent || el.innerText || '').trim());

    // Step 1: Try to load the client-side library
    const loaded = await loadMermaidLibrary();
    if (!loaded || !window.mermaid) {
        // Library completely failed → use mermaid.ink image for ALL diagrams
        console.log('[Mermaid] Library unavailable, using mermaid.ink image service.');
        mermaidElements.forEach((el, i) => renderMermaidAsImage(el, rawTexts[i], rawTexts[i]));
        return;
    }

    // Step 2: Initialize once
    if (!mermaidInitialized) {
        const elegantTheme = {
            background: '#FFFFFF',
            fontFamily: "'GenWanNeoSCjk', 'Noto Sans TC', sans-serif",
            fontSize: '16px',
            primaryColor: '#F3F4F6',
            primaryBorderColor: '#D1D5DB',
            primaryTextColor: '#111827',
            lineColor: '#6B7280',
            nodeTextColor: '#111827',
        };
        window.mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            themeVariables: elegantTheme,
            securityLevel: 'loose',
        });
        setMermaidInitialized(true);
    }

    // Step 3: Render each diagram individually
    let renderedCount = 0;
    for (let i = 0; i < mermaidElements.length; i++) {
        const element = mermaidElements[i];
        if (element.getAttribute('data-processed') === 'true') continue;

        const graphDefinition = rawTexts[i];
        if (!graphDefinition) {
            showMermaidFallback(element, '圖表內容為空', '');
            continue;
        }

        try {
            const uniqueId = `mermaid-svg-${Date.now()}-${i}`;
            const result = await window.mermaid.render(uniqueId, graphDefinition);
            const svgCode = (typeof result === 'string') ? result : result.svg;
            element.innerHTML = svgCode;
            element.setAttribute('data-processed', 'true');
            renderedCount++;
        } catch (err) {
            // Client-side render failed → try mermaid.ink image as fallback
            console.warn(`[Mermaid] Diagram ${i} client render failed, trying mermaid.ink...`, err);
            renderMermaidAsImage(element, rawTexts[i], rawTexts[i]);
        }
    }

    if (renderedCount > 0) {
        console.log(`[Mermaid] Client-rendered ${renderedCount}/${mermaidElements.length} diagram(s).`);
    }
}





// --- Analysis View ---














































function setupEventListeners() {
    const genButton = document.getElementById('generate-questions-from-pasted-btn');
    if (genButton) {
        genButton.addEventListener('click', handleGenerateQuestionsFromPasted);
    }
    // New, more reliable event handling for the highlight toolbar
    // We use mousedown and touchstart to act immediately and prevent text deselection.
    dom.highlightToolbar.addEventListener('mousedown', handleHighlightToolbarAction);
    dom.highlightToolbar.addEventListener('touchstart', handleHighlightToolbarAction);

    // --- 底部導航列事件監聽 (手機版) ---
    const mobileNav = document.getElementById('mobile-bottom-nav');
    const navHomeBtn = document.getElementById('nav-home-btn');
    const navAssignmentsBtn = document.getElementById('nav-assignments-btn');
    const navAchievementsBtn = document.getElementById('nav-achievements-btn');

    function updateMobileNavState(activeBtn) {
        mobileNav?.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));
        activeBtn?.classList.add('active');
    }

    navHomeBtn?.addEventListener('click', () => {
        updateMobileNavState(navHomeBtn);
        showArticleGrid();
    });

    navAssignmentsBtn?.addEventListener('click', () => {
        updateMobileNavState(navAssignmentsBtn);
        if (appState.currentUser && appState.currentUser.studentId) {
            displayStudentAnalysis(appState.currentUser.studentId);
        }
    });

    navAchievementsBtn?.addEventListener('click', () => {
        updateMobileNavState(navAchievementsBtn);
        renderAchievementsList();
    });

    // --- 回到頂部按鈕事件監聽 ---
    const scrollTopBtn = document.getElementById('scroll-to-top-btn');

    window.addEventListener('scroll', () => {
        if (scrollTopBtn) {
            scrollTopBtn.classList.toggle('visible', window.scrollY > 300);
        }
    }, { passive: true });

    scrollTopBtn?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Use event delegation on the body for dynamically added elements
    document.body.addEventListener('click', e => {
        const target = e.target;

        // Login View
        if (target.closest('#teacher-login-link')) {
            e.preventDefault();
            renderModal('password');
        }
        if (target.closest('#student-login-btn')) {
            handleStudentLogin();
        }

        // Main App View
        if (target.closest('#logout-btn')) {
            handleLogout();
        }
        if (target.closest('#student-view-btn')) {
            switchViewTab('student');
        }
        if (target.closest('#teacher-view-btn')) {
            switchViewTab('teacher');
        }
        if (target.closest('#student-view-analysis-btn')) {
            if (appState.currentUser && appState.currentUser.studentId) {
                displayStudentAnalysis(appState.currentUser.studentId);
            }
        }

        if (target.closest('#toggle-analysis-btn')) {
            const articleBody = document.getElementById('article-body');
            const analysisBody = document.getElementById('analysis-body');
            const isShowingArticle = target.getAttribute('data-view') === 'article';

            if (isShowingArticle) {
                articleBody.classList.add('hidden');
                analysisBody.classList.remove('hidden');
                target.textContent = '返回原文';
                target.setAttribute('data-view', 'analysis');
            } else {
                articleBody.classList.remove('hidden');
                analysisBody.classList.add('hidden');
                target.textContent = '查看解析';
                target.setAttribute('data-view', 'article');
            }
        }

        if (target.closest('.edit-analysis-ai-btn')) {
            handleAnalysisAI(e);
        }
        if (target.closest('#student-view-achievements-btn')) {
            renderAchievementsList();
        }
        if (target.closest('#clear-article-filters-btn')) {
            // Reset filter UI elements
            document.getElementById('filter-format').value = '';
            document.getElementById('filter-contentType').value = '';
            document.getElementById('filter-difficulty').value = '';
            document.getElementById('filter-status').value = '';

            // Reset filter state
            appState.calendarFilterDate = null;
            document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('bg-red-700', 'text-white'));
            appState.articleQueryState.filters = {
                format: '',
                contentType: '',
                difficulty: '',
                status: '',
            };

            // Fetch articles with cleared filters
            fetchAssignmentsPage(true);
        }


        if (target.closest('#load-more-btn')) {
            fetchAssignmentsPage(false);
        }
        if (target.closest('#load-more-teacher-articles-btn')) {
            fetchTeacherAssignmentsPage(false);
        }

        // Student View (delegated from app-content-container)
        const assignmentItem = target.closest('.assignment-item');
        const assignmentCard = target.closest('.assignment-card-item');
        const targetElement = assignmentItem || assignmentCard;
        if (targetElement) {
            const assignmentId = targetElement.dataset.assignmentId;
            const assignment = appState.assignments.find(a => a.id === assignmentId);
            if (assignment) displayAssignment(assignment);
        }

        // Highlight toolbar actions are now handled by their own dedicated listeners ('mousedown' and 'touchstart' on the toolbar itself).
    });

    document.body.addEventListener('change', e => {
        const target = e.target;

        // Login View
        if (target.matches('#class-login-selector')) {
            populateStudentLoginSelector(target.value);
        }
        if (target.matches('#student-login-selector')) {
            document.getElementById('student-login-btn').disabled = !target.value;
        }

        // Student View Filters
        if (target.matches('.article-filter')) {
            const { id, value } = target;
            const filterKey = id.replace('filter-', '');
            appState.articleQueryState.filters[filterKey] = value;
            fetchAssignmentsPage(true); // Re-fetch with new filters
        }

        // Teacher View Filters
        if (target.matches('.teacher-select-filter')) {
            const { id, value } = target;
            let filterKey = id.replace('filter-tag-', '').replace('filter-', '');
            if (filterKey === 'deadline-status') {
                filterKey = 'deadlineStatus'; // Convert to camelCase
            }
            appState.teacherArticleQueryState.filters[filterKey] = value;
            fetchTeacherAssignmentsPage(true);
        }
    });

    document.body.addEventListener('input', e => {
        const target = e.target;
        if (target.matches('#article-search-input')) {
            appState.teacherArticleQueryState.filters.searchTerm = target.value.toLowerCase();
            // Debounce search to avoid excessive queries
            clearTimeout(appState.teacherArticleQueryState.searchTimeout);
            appState.teacherArticleQueryState.searchTimeout = setTimeout(() => {
                fetchTeacherAssignmentsPage(true);
            }, 300);
        }
    });
}


document.addEventListener('DOMContentLoaded', initializeAppCore);


// Expose for UI.js event handlers
window.displayAssignment = displayAssignment;
window.showArticleGrid = showArticleGrid;
window.handleSaveEdit = handleSaveEdit;
window.displaySubmissionReview = displaySubmissionReview;

