import { getDoc, setDoc, doc, updateDoc, collection, getDocs, deleteDoc, writeBatch, query, where, arrayUnion, deleteField, Timestamp, orderBy, limit, startAfter, addDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { appState, dom, TEACHER_PASSWORD_HASH, db, auth, app, appId, mermaidInitialized, setMermaidInitialized, DEFAULT_GEMINI_MODEL, ARTICLES_PER_PAGE } from './state.js';
import { el, updateElement, escapeHtml, normalizeClassName, generateDefaultPassword, markdownToHtml, formatSubmissionTime, formatTime, getLocalDateString, hashString } from './utils.js';
import { loadStudentSubmissions, loadSubmissionsByClass, loadSubmissionsByAssignment, getAssignments } from './api.js';
import { closeModal, modalHtmlGenerators, renderModal, attachModalEventListeners, showLoading, hideLoading } from './ui.js';
import { callGenerativeAI, callFullGeminiAnalysis, handleAnalysisAI, handleAiRewrite, handleAiGenerateAchievement, callAchievementAI, callSingleGeminiAnalysis } from './ai.js';
import { showView, loadAllData, updateHeader, showArticleGrid, displayAssignment, renderAnalysisContent, renderAllMermaidDiagrams, renderAssignmentsList } from './scripts.js';
import { populateClassSelectors, renderAchievementsList, checkAndAwardAchievements, loadStudentsForClass } from './student.js';

export function renderTeacherUI(selectedClassId = null, selectedArticleId = null) {
    const teacherContent = document.getElementById('teacher-main-content');
    if (!teacherContent) return;

    if (!teacherContent.querySelector('#tab-panel-class-overview')) {
        teacherContent.innerHTML = ''; // Clear once
        const fragment = document.createDocumentFragment();

        fragment.appendChild(
            el('div', { class: 'card mb-6' }, [
                el('div', { class: 'flex justify-between items-center' }, [
                    el('h3', { class: 'text-xl font-bold font-rounded', textContent: '掌理學堂' }),
                    el('div', { class: 'flex gap-2 items-center' }, [
                        el('select', { id: 'class-selector', class: 'input-styled' }),
                        el('button', { id: 'add-class-btn', class: 'btn-primary py-2 px-4 text-sm', textContent: '新設學堂' }),
                        el('button', { id: 'edit-class-name-btn', class: 'btn-secondary py-2 px-4 text-sm', disabled: true, textContent: '修訂名號' }),
                        el('button', { id: 'delete-class-btn', class: 'btn-danger py-2 px-4 text-sm', disabled: true, textContent: '解散學堂' })
                    ])
                ])
            ])
        );

        fragment.appendChild(
            el('div', { id: 'tab-panel-class-overview', class: 'teacher-tab-panel' }, [
                el('div', { id: 'class-management-content', class: 'mt-4' })
            ])
        );

        fragment.appendChild(
            el('div', { id: 'tab-panel-article-library', class: 'teacher-tab-panel hidden' }, [
                el('div', { id: 'article-library-content' })
            ])
        );

        fragment.appendChild(
            el('div', { id: 'tab-panel-achievement-management', class: 'teacher-tab-panel hidden' }, [
                el('div', { id: 'achievement-management-content' })
            ])
        );

        teacherContent.appendChild(fragment);
    }

    populateClassSelectors();

    const classSelector = document.getElementById('class-selector');
    if (classSelector && selectedClassId) {
        classSelector.value = selectedClassId;
    }

    const currentTab = document.querySelector('.teacher-tab-btn.active')?.dataset.tab || 'class-overview';
    switchTeacherTab(currentTab, selectedClassId, selectedArticleId);
}

export async function renderClassManagement(classId) {
    const contentDiv = document.getElementById('class-management-content');
    if (!contentDiv) return;
    if (classId) {
        contentDiv.dataset.classId = classId;
    } else {
        delete contentDiv.dataset.classId;
    }

    // Load submissions for the selected class on demand
    appState.classSubmissions = classId ? await loadSubmissionsByClass(classId) : [];

    const editBtn = document.getElementById('edit-class-name-btn');
    const deleteBtn = document.getElementById('delete-class-btn');

    contentDiv.innerHTML = ''; // Clear existing content

    if (!classId) {
        contentDiv.appendChild(
            el('div', { class: 'text-center text-slate-500 p-8 rounded-lg bg-slate-50', textContent: '請先從上方擇一學堂進行掌理，或新設學堂。' })
        );
        if (editBtn) editBtn.disabled = true;
        if (deleteBtn) deleteBtn.disabled = true;
        return;
    }

    if (editBtn) { editBtn.disabled = false; editBtn.dataset.classId = classId; }
    if (deleteBtn) { deleteBtn.disabled = false; deleteBtn.dataset.classId = classId; }

    const fragment = document.createDocumentFragment();

    fragment.appendChild(
        el('div', { class: 'p-4 border-t' }, [
            el('h4', { class: 'font-semibold mb-2 text-slate-600', textContent: '學子名錄' }),
            el('div', { id: 'roster-display', class: 'p-4 border rounded-lg bg-gray-50 min-h-[100px] max-h-[300px] overflow-y-auto custom-scrollbar' })
        ])
    );

    fragment.appendChild(
        el('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6 mt-6' }, [
            el('div', {}, [
                el('h4', { class: 'font-semibold mb-2 text-slate-600', textContent: '單增學子' }),
                el('div', { class: 'flex gap-2' }, [
                    el('input', { type: 'number', id: 'new-student-seat', class: 'w-1/4 input-styled', placeholder: '座號' }),
                    el('input', { type: 'text', id: 'new-student-name', class: 'w-3/4 input-styled', placeholder: '學子姓名' }),
                    el('button', { id: 'add-student-btn', 'data-class-id': classId, class: 'btn-primary py-2 px-5 font-bold', textContent: '登錄' })
                ])
            ]),
            el('div', {}, [
                el('h4', { class: 'font-semibold mb-2 text-slate-600', textContent: '批量延攬' }),
                el('textarea', { id: 'bulk-import-textarea', rows: '5', class: 'w-full input-styled', placeholder: '格式：座號,姓名 (一行一位)' }),
                el('button', { id: 'bulk-import-btn', 'data-class-id': classId, class: 'w-full mt-2 btn-secondary py-2 px-5 font-bold', textContent: '延攬' })
            ])
        ])
    );

    fragment.appendChild(
        el('div', { class: 'border-t pt-6 mt-6' }, [
            el('div', { class: 'flex justify-between items-center mb-2' }, [
                el('h4', { class: 'font-semibold text-slate-600', textContent: '逾期課業回報' }),
                el('button', { id: 'generate-overdue-report-btn', 'data-class-id': classId, class: 'btn-secondary py-1 px-3 text-xs', textContent: '生成回報' })
            ]),
            el('div', { id: 'overdue-report-container', class: 'p-4 border rounded-lg bg-red-50 min-h-[100px]' })
        ])
    );

    contentDiv.appendChild(fragment);
    updateRosterDisplay(classId);
    const reportContainer = document.getElementById('overdue-report-container');
    if (reportContainer) {
        reportContainer.innerHTML = `<p class="text-slate-400 text-center">點擊「生成回報」以查看最新數據。</p>`;
    }
}

export async function updateArticleLibraryPanel(classId, selectedArticleId = null) {
    const panel = document.getElementById('tab-panel-article-library');
    if (!panel) return;

    // Only clear if the panel is not already populated
    if (!panel.querySelector('#article-library-main')) {
        panel.innerHTML = '';
    }

    const createTagSelect = (id, label, options) => el('div', {}, [
        el('label', { class: 'text-sm font-medium text-slate-600', textContent: `${label} (選填)` }),
        el('select', { id, class: 'w-full input-styled mt-1 text-sm' }, [
            el('option', { value: '', textContent: 'AI 自動判斷' }),
            ...options.map(opt => el('option', { value: opt, textContent: `#${opt}` }))
        ])
    ]);

    const createFilterSelect = (id, label, options) => el('select', { id, class: 'teacher-select-filter input-styled text-sm' }, [
        el('option', { value: '', textContent: label }),
        ...Object.entries(options).map(([value, text]) => el('option', { value, textContent: text }))
    ]);

    const aiGeneratePanel = el('div', { id: 'panel-ai-generate', class: 'space-y-4' }, [
        el('h3', { class: 'text-lg font-semibold', textContent: '依題生成篇章與試煉' }),
        el('div', { class: 'space-y-3' }, [
            el('input', { type: 'text', id: 'topic-input', class: 'w-full input-styled', placeholder: '請輸入篇章主題' }),
            el('div', { class: 'grid grid-cols-1 md:grid-cols-3 gap-4' }, [
                createTagSelect('tag-format-input', '形式', ['純文', '圖表', '圖文']),
                createTagSelect('tag-contentType-input', '內容', ['記敘', '抒情', '說明', '議論', '應用']),
                createTagSelect('tag-difficulty-input', '難度', ['簡單', '基礎', '普通', '進階', '困難'])
            ]),
            el('div', {}, [
                el('label', { class: 'text-sm font-medium text-slate-600', textContent: '挑戰期限 (選填)' }),
                el('input', { type: 'date', id: 'deadline-input', class: 'w-full input-styled mt-1' })
            ]),
            el('div', { class: 'form-check items-center flex gap-2 my-3' }, [
                el('input', { class: 'form-check-input w-5 h-5', type: 'checkbox', id: 'ai-is-public', checked: false }),
                el('label', { class: 'form-check-label font-bold', htmlFor: 'ai-is-public', textContent: '將此篇章設為公開' })
            ]),
            el('button', { id: 'generate-btn', class: 'w-full btn-primary py-3 text-base font-bold', textContent: '生成' })
        ])
    ]);

    const pasteTextPanel = el('div', { id: 'panel-paste-text', class: 'hidden space-y-4' }, [
        el('h3', { class: 'text-lg font-semibold', textContent: '為文章生成試煉' }),
        el('div', { class: 'space-y-3' }, [
            el('input', { type: 'text', id: 'pasted-title-input', class: 'w-full input-styled', placeholder: '請輸入篇章標題' }),
            el('textarea', { id: 'pasted-article-textarea', rows: '10', class: 'w-full input-styled', placeholder: '請在此貼上你的篇章內容...' }),
            el('div', { class: 'grid grid-cols-1 md:grid-cols-3 gap-4' }, [
                createTagSelect('pasted-tag-format-input', '形式', ['純文', '圖表', '圖文']),
                createTagSelect('pasted-tag-contentType-input', '內容', ['記敘', '抒情', '說明', '議論', '應用']),
                createTagSelect('pasted-tag-difficulty-input', '難度', ['簡單', '基礎', '普通', '進階', '困難'])
            ]),
            el('div', {}, [
                el('label', { class: 'text-sm font-medium text-slate-600', textContent: '挑戰期限 (選填)' }),
                el('input', { type: 'date', id: 'pasted-deadline-input', class: 'w-full input-styled mt-1' })
            ]),
            el('div', { class: 'form-check items-center flex gap-2 my-3' }, [
                el('input', { class: 'form-check-input w-5 h-5', type: 'checkbox', id: 'pasted-is-public', checked: false }),
                el('label', { class: 'form-check-label font-bold', htmlFor: 'pasted-is-public', textContent: '將此篇章設為公開' })
            ]),
            el('div', { class: 'flex gap-4 mt-2' }, [
                el('button', { id: 'format-text-btn', class: 'w-1/3 btn-secondary py-3 text-base font-bold', textContent: '整理文本' }),
                el('button', { id: 'generate-questions-btn', class: 'w-2/3 btn-primary py-3 text-base font-bold', textContent: '生成試題' })
            ])
        ])
    ]);

    const createArticlePanel = el('div', { id: 'panel-create-article', class: 'hidden' }, [
        el('div', { class: 'flex border-b-2 border-gray-200 mb-4' }, [
            el('button', { id: 'tab-ai-generate', class: 'creation-tab font-bold py-2 px-4 text-sm rounded-t-lg active', textContent: 'AI 起草' }),
            el('button', { id: 'tab-paste-text', class: 'creation-tab font-bold py-2 px-4 text-sm rounded-t-lg', textContent: '貼入文章' })
        ]),
        aiGeneratePanel,
        pasteTextPanel
    ]);

    const analyzeArticlePanel = el('div', { id: 'panel-analyze-article', class: 'card' }, [
        el('div', { class: 'mb-4 flex flex-wrap gap-4 items-center' }, [
            el('input', { type: 'text', id: 'article-search-input', class: 'input-styled w-full md:w-auto flex-grow', placeholder: '🔍 搜尋篇章名號...' }),
            createFilterSelect('filter-tag-format', '所有形式', { '純文': '#純文', '圖表': '#圖表', '圖文': '#圖文' }),
            createFilterSelect('filter-tag-contentType', '所有內容', { '記敘': '#記敘', '抒情': '#抒情', '說明': '#說明', '議論': '#議論', '應用': '#應用' }),
            createFilterSelect('filter-tag-difficulty', '所有難度', { '簡單': '#簡單', '基礎': '#基礎', '普通': '#普通', '進階': '#進階', '困難': '#困難' }),
            createFilterSelect('filter-deadline-status', '所有期限', { 'active': '進行中', 'expired': '已逾期', 'none': '無期限' })
        ]),
        el('div', { id: 'bulk-actions-container', class: 'hidden mb-4 flex items-center gap-2' }, [
            el('span', { class: 'text-sm font-medium text-slate-600', textContent: '對選取項目進行：' }),
            el('button', { id: 'bulk-set-public-btn', class: 'btn-teal py-2 px-4 text-sm', textContent: '設為公開' }),
            el('button', { id: 'bulk-set-private-btn', class: 'btn-secondary py-2 px-4 text-sm', textContent: '設為私密' }),
            el('div', { class: 'h-4 border-l border-slate-300 mx-2' }), // Divider
            el('button', { id: 'bulk-delete-btn', class: 'btn-danger py-2 px-4 text-sm', textContent: '刪除' })
        ]),
        el('div', { class: 'overflow-x-auto rounded-lg border border-slate-200' }, [
            el('table', { class: 'min-w-full divide-y divide-slate-200' }, [
                el('thead', { class: 'bg-slate-50' }, [
                    el('tr', {}, [
                        el('th', { scope: 'col', class: 'relative px-6 py-4 text-left' }, [el('input', { type: 'checkbox', id: 'select-all-articles', class: 'w-[0.875rem] h-[0.875rem] rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50' })]),
                        el('th', { scope: 'col', class: 'px-6 py-4 text-left font-semibold text-slate-500', textContent: '名號' }),
                        el('th', { scope: 'col', class: 'px-6 py-4 text-left font-semibold text-slate-500', textContent: '形式' }),
                        el('th', { scope: 'col', class: 'px-6 py-4 text-left font-semibold text-slate-500', textContent: '內容' }),
                        el('th', { scope: 'col', class: 'px-6 py-4 text-left font-semibold text-slate-500', textContent: '難度' }),
                        el('th', { scope: 'col', class: 'relative px-6 py-4' }, [el('span', { class: 'sr-only', textContent: '行事' })])
                    ])
                ]),
                el('tbody', { id: 'article-list-body', class: 'bg-white divide-y divide-slate-200' })
            ])
        ]),
        el('div', { id: 'teacher-load-more-container', class: 'mt-4 flex justify-center hidden' }, [
            el('button', { id: 'load-more-teacher-articles-btn', class: 'btn-secondary py-2 px-6' }, ['載入更多'])
        ]),
        el('div', { id: 'analysis-panel', class: 'hidden mt-8 card' }, [
            el('h3', { id: 'analysis-title', class: 'text-xl font-bold text-gray-800 mb-4 font-rounded' }),
            el('button', {
                id: 'ai-analysis-btn',
                class: 'w-full btn-teal py-3 px-4 font-bold mb-6 flex items-center justify-center gap-2',
                textContent: '啟動 AI 分析全隊表現',
                onclick: async (e) => {
                    const articleId = e.currentTarget.dataset.articleId;
                    if (!articleId) return;
                    showLoading('正在分析全隊表現...');
                    const submissions = await loadSubmissionsByAssignment(articleId);
                    const selectedClass = appState.allClasses.find(c => c.id === appState.currentUser.selectedClassId);
                    const roster = selectedClass?.roster || [];
                    const resultsContainer = document.getElementById('results-table-container');
                    renderResultsTable(resultsContainer, submissions, roster);
                    hideLoading();
                }
            }),
            el('div', { id: 'results-table-container', class: 'overflow-x-auto' })
        ])
    ]);

    const mainCard = el('div', { class: 'card mb-8' }, [
        el('div', { class: 'flex border-b-2 border-gray-200 mb-4' }, [
            el('button', { id: 'tab-create-article', class: 'creation-tab font-bold py-2 px-6 rounded-t-lg', textContent: '新撰篇章' }),
            el('button', { id: 'tab-analyze-article', class: 'creation-tab font-bold py-2 px-6 rounded-t-lg active', textContent: '篇章書庫' })
        ]),
        createArticlePanel,
        analyzeArticlePanel
    ]);

    panel.appendChild(mainCard);
    fetchTeacherAssignmentsPage(true); // Initial fetch
}

export function updateTeacherLoadMoreButton() {
    const loadMoreContainer = document.getElementById('teacher-load-more-container');
    if (!loadMoreContainer) return;

    const state = appState.teacherArticleQueryState;
    const loadMoreBtn = loadMoreContainer.querySelector('#load-more-teacher-articles-btn');

    if (state.isLastPage) {
        loadMoreContainer.classList.add('hidden');
    } else {
        loadMoreContainer.classList.remove('hidden');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = state.isLoading;
            loadMoreBtn.textContent = state.isLoading ? '載入中...' : '載入更多';
        }
    }
}

export function renderTeacherArticleTable(assignments, isNewQuery) {
    const tableBody = document.getElementById('article-list-body');
    if (!tableBody) return;

    if (isNewQuery) {
        tableBody.innerHTML = '';
    }

    if (assignments.length === 0 && isNewQuery) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-500">沒有找到符合條件的篇章。</td></tr>`;
    } else if (assignments.length > 0) {
        const fragment = document.createDocumentFragment();
        assignments.forEach(assignment => {
            fragment.appendChild(createFullArticleTableRow(assignment));
        });
        tableBody.appendChild(fragment);
    }
}

export function createFullArticleTableRow(assignment) {
    const tags = assignment.tags || {};
    let deadlineText = '';
    if (assignment.deadline && typeof assignment.deadline.toDate === 'function') {
        const d = assignment.deadline.toDate();
        deadlineText = ` <span class="text-slate-500 font-normal">(${d.getMonth() + 1}/${d.getDate()})</span>`;
    }

    const isPublicBadge = `<span class="ml-2 text-xs font-bold px-2 py-1 rounded-full ${assignment.isPublic ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-600'}">${assignment.isPublic ? '公開' : '私密'}</span>`;

    const row = el('tr', { 'data-assignment-id': assignment.id, class: 'animate-fade-in' });
    row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <input type="checkbox" class="article-checkbox w-[0.875rem] h-[0.875rem] rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" value="${assignment.id}">
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <a href="#" class="article-title-link font-medium text-slate-900 hover:text-red-700" data-assignment-id="${assignment.id}">${escapeHtml(assignment.title)}</a>${isPublicBadge}${deadlineText}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span class="px-2 inline-flex leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                        ${escapeHtml(tags.format || 'N/A')}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span class="px-2 inline-flex leading-5 font-semibold rounded-full bg-rose-100 text-rose-800">
                        ${escapeHtml(tags.contentType || 'N/A')}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                     <span class="px-2 inline-flex leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">
                        ${escapeHtml(tags.difficulty || 'N/A')}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="edit-article-btn btn-secondary btn-sm" data-assignment-id="${assignment.id}">潤飾</button>
                     <button class="delete-article-btn btn-danger btn-sm ml-2" data-assignment-id="${assignment.id}">刪除</button>
                </td>
            `;
    return row;
}

export async function updateRosterDisplay(classId) {
    const rosterDisplay = document.getElementById('roster-display');
    if (!rosterDisplay || !classId) return;

    rosterDisplay.innerHTML = '<p class="text-slate-500">讀取中...</p>';

    try {
        const students = await loadStudentsForClass(classId);

        rosterDisplay.innerHTML = ''; // Clear loading message

        if (students === null) {
            rosterDisplay.innerHTML = '<p class="text-red-500">讀取學子名錄失敗。</p>';
            return;
        }

        if (students.length === 0) {
            rosterDisplay.appendChild(el('p', { class: 'text-slate-400', textContent: '這個學堂還沒有學子。' }));
        } else {
            const fragment = document.createDocumentFragment();
            // Sort students by seat number (as numbers) before rendering
            students.sort((a, b) => parseInt(a.seatNumber, 10) - parseInt(b.seatNumber, 10));
            students.forEach(student => {
                const studentRow = el('div', { class: 'flex items-center justify-between bg-slate-100 rounded-lg px-3 py-2 mr-2 mb-2' }, [
                    el('span', {
                        class: 'student-name-link text-sm font-semibold text-slate-700 cursor-pointer hover:text-red-700 hover:underline',
                        'data-student-id': student.id,
                        textContent: `${student.seatNumber}號 ${student.name}`
                    }),
                    el('div', { class: 'flex items-center gap-2' }, [
                        el('button', { 'data-class-id': classId, 'data-student-id': student.id, class: 'edit-student-btn text-xs font-bold text-gray-600 hover:text-gray-800 bg-gray-200 px-2 py-1 rounded-full', textContent: '修訂學籍' }),
                        el('button', { 'data-class-id': classId, 'data-student-id': student.id, class: 'delete-student-btn text-xs font-bold text-red-600 hover:text-red-800 bg-red-100 px-2 py-1 rounded-full', textContent: '除籍' }),
                        el('button', { 'data-class-id': classId, 'data-student-id': student.id, class: 'reset-password-btn text-xs font-bold text-orange-600 hover:text-orange-800 bg-orange-100 px-2 py-1 rounded-full', textContent: '重置密語' })
                    ])
                ]);
                fragment.appendChild(studentRow);
            });
            rosterDisplay.appendChild(fragment);
        }
    } catch (error) {
        console.error("Error updating roster display:", error);
        rosterDisplay.innerHTML = '<p class="text-red-500">讀取學子名錄失敗。</p>';
    }
}

export async function renderOverdueReport(classId) {
    const container = document.getElementById('overdue-report-container');
    if (!container || !classId) return;

    container.innerHTML = `<p class="text-slate-400 text-center">正在生成回報...</p>`;
    showLoading('正在計算逾期回報...');

    try {
        const students = await loadStudentsForClass(classId);
        if (students === null) {
            container.innerHTML = `<p class="text-red-500 text-center">無法載入學子名冊以生成報告。</p>`;
            return;
        }
        if (students.length === 0) {
            container.innerHTML = `<p class="text-slate-500 text-center">學堂尚無學子，無法生成報告。</p>`;
            return;
        }

        const now = new Date();
        // 使用快取的 assignments，避免每次重新查詢 Firestore
        const allAssignments = await getAssignments();
        const overdueAssignments = allAssignments.filter(a =>
            a.isPublic && a.deadline && a.deadline.toDate() < now
        );

        if (overdueAssignments.length === 0) {
            container.innerHTML = `<p class="text-slate-500 text-center">太棒了！目前沒有任何已過期的課業。</p>`;
            return;
        }

        const classSubmissionsQuery = query(
            collection(db, "submissions"),
            where('classId', '==', classId)
        );
        const classSubmissionsSnapshot = await getDocs(classSubmissionsQuery);
        const classSubmissions = classSubmissionsSnapshot.docs.map(doc => doc.data());

        const overdueByStudent = {};
        students.forEach(student => {
            const studentOverdueTasks = [];
            overdueAssignments.forEach(assignment => {
                const submission = classSubmissions.find(s => s.studentId === student.id && s.assignmentId === assignment.id);
                // 判定是否「已完成」：需要有提交且最高分 >= 60
                let isPassed = false;
                if (submission) {
                    let highestScore = submission.score || 0;
                    if (submission.attempts && submission.attempts.length > 0) {
                        highestScore = Math.max(...submission.attempts.map(a => a.score));
                    }
                    isPassed = highestScore >= 60;
                }
                if (!isPassed) {
                    const deadline = assignment.deadline.toDate();
                    const deadlineStr = `(${(deadline.getMonth() + 1)}/${deadline.getDate()})`;
                    studentOverdueTasks.push(`${assignment.title} <span class="text-xs text-red-700 font-medium">${deadlineStr}</span>`);
                }
            });
            if (studentOverdueTasks.length > 0) {
                overdueByStudent[student.id] = {
                    studentInfo: student,
                    tasks: studentOverdueTasks
                };
            }
        });

        const sortedOverdueStudents = Object.values(overdueByStudent).sort((a, b) => a.studentInfo.seatNumber - b.studentInfo.seatNumber);

        container.innerHTML = ''; // Clear loading message
        if (sortedOverdueStudents.length === 0) {
            container.appendChild(el('p', { class: 'text-slate-500 text-center', textContent: '太棒了！本學堂無人逾期。' }));
            return;
        }

        const list = el('ul', { class: 'space-y-3' });
        sortedOverdueStudents.forEach(data => {
            const student = data.studentInfo;
            const listItem = el('li', { class: 'text-sm' }, [
                el('strong', { class: 'font-semibold text-slate-800', textContent: `${student.seatNumber}號 ${student.name}：` }),
                el('span', { class: 'text-slate-600', innerHTML: data.tasks.join('、 ') })
            ]);
            list.appendChild(listItem);
        });
        container.appendChild(list);

    } catch (error) {
        console.error("Error generating overdue report:", error);
        container.innerHTML = `<p class="text-red-500 text-center">生成回報時發生錯誤。</p>`;
    } finally {
        hideLoading();
    }
}

export async function handleTeacherLogin() {
    const passwordInput = document.getElementById('password-input').value.trim();
    const errorEl = document.getElementById('password-error');
    if (errorEl) errorEl.textContent = '';

    try {
        const teacherUserRef = doc(db, "classes/teacher_class/students", "teacher_user");
        const teacherUserSnap = await getDoc(teacherUserRef);

        let passwordHashOnRecord;
        const teacherData = teacherUserSnap.exists() ? teacherUserSnap.data() : {};

        if (teacherUserSnap.exists() && teacherData.passwordHash) {
            passwordHashOnRecord = teacherData.passwordHash;
        } else {
            passwordHashOnRecord = TEACHER_PASSWORD_HASH; // Fallback to hardcoded hash
        }

        const enteredPasswordHash = await hashString(passwordInput);

        if (enteredPasswordHash === passwordHashOnRecord) {
            appState.currentUser = { type: 'teacher', name: '筱仙', studentId: 'teacher_user', classId: 'teacher_class', className: '教師講堂', ...teacherData };
            localStorage.setItem(`currentUser_${appId}`, JSON.stringify(appState.currentUser));

            await processUserLogin(teacherData, 'teacher_user', 'teacher_class');

            await loadStudentSubmissions(appState.currentUser.studentId);
            appState.currentView = 'teacher';
            showView('app');
            requestAnimationFrame(updateHeader);
            document.getElementById('teacher-view-btn').classList.remove('hidden');
            document.getElementById('view-tabs').classList.remove('hidden');
            closeModal();
        } else {
            if (errorEl) errorEl.textContent = '憑信錯誤。';
        }
    } catch (error) {
        console.error("Teacher login error:", error);
        if (errorEl) errorEl.textContent = '驗證時發生錯誤。';
    }
}

export function handleDeleteClass(classId) {
    if (!classId) { renderModal('message', { type: 'error', title: '操作錯誤', message: '請先選擇要解散的學堂。' }); return; }
    const selectedClass = appState.allClasses.find(c => c.id === classId);
    if (!selectedClass) { renderModal('message', { type: 'error', title: '操作錯誤', message: '找不到班級資料，請重新整理。' }); return; }
    renderModal('deleteClassConfirm', { classId, className: selectedClass.className });
}

export async function confirmDeleteClass(classId) {
    const selectedClass = appState.allClasses.find(c => c.id === classId);
    const inputName = document.getElementById('delete-class-confirm-input').value;
    const errorEl = document.getElementById('delete-class-confirm-error');

    if (inputName !== selectedClass.className) {
        errorEl.textContent = '學堂名號輸入有誤。';
        return;
    }

    closeModal();
    showLoading('正在解散學堂...');
    try {
        const batch = writeBatch(db);
        batch.delete(doc(db, "classes", classId));

        const submissionsQuery = query(collection(db, "submissions"), where("classId", "==", classId));
        const submissionsSnapshot = await getDocs(submissionsQuery);
        submissionsSnapshot.forEach(d => batch.delete(d.ref));

        await batch.commit();
        renderModal('message', { type: 'success', title: '操作成功', message: `學堂「${selectedClass.className}」已成功解散。` });
    } catch (e) {
        console.error("刪除班級失敗:", e);
        renderModal('message', { type: 'error', title: '解散失敗', message: '操作失敗，請檢查主控台錯誤訊息。' });
    } finally {
        hideLoading();
    }
}

export async function handleAddStudent(classId) {
    const seatNumberInput = document.getElementById('new-student-seat');
    const nameInput = document.getElementById('new-student-name');
    const seatNumber = seatNumberInput.value.trim();
    const name = nameInput.value.trim();
    if (!classId || !seatNumber || !name) { renderModal('message', { type: 'error', title: '登錄失敗', message: '請填寫所有欄位！' }); return; }

    const studentsRef = collection(db, `classes/${classId}/students`);
    const seatQuery = query(studentsRef, where("seatNumber", "==", parseInt(seatNumber)), limit(1));
    const seatSnapshot = await getDocs(seatQuery);
    if (!seatSnapshot.empty) { renderModal('message', { type: 'error', title: '登錄失敗', message: '該座號已存在。' }); return; }

    const selectedClass = appState.allClasses.find(c => c.id === classId);
    const defaultPassword = generateDefaultPassword(selectedClass.className, seatNumber);
    const studentId = `${classId}_${seatNumber}`;
    const newStudent = { name, seatNumber: parseInt(seatNumber), studentId, passwordHash: await hashString(defaultPassword) };

    try {
        await setDoc(doc(studentsRef, studentId), newStudent);
        seatNumberInput.value = ''; nameInput.value = '';
        renderModal('message', { type: 'success', title: '登錄成功', message: `學子「${name}」已成功登錄！` });
        updateRosterDisplay(classId); // Refresh roster
    } catch (e) { console.error("新增學生失敗:", e); renderModal('message', { type: 'error', title: '登錄失敗', message: '操作失敗，請稍後再試。' }); }
}

export async function handleBulkImport(classId) {
    const importText = document.getElementById('bulk-import-textarea').value.trim();
    if (!classId || !importText) { renderModal('message', { type: 'error', title: '延攬失敗', message: '請選擇學堂並貼上名錄。' }); return; }

    const selectedClass = appState.allClasses.find(c => c.id === classId);
    const studentsRef = collection(db, `classes/${classId}/students`);
    const existingStudentsSnap = await getDocs(studentsRef);
    const existingSeats = new Set(existingStudentsSnap.docs.map(d => d.data().seatNumber));

    const lines = importText.split('\n').filter(line => line.trim() !== '');
    const batch = writeBatch(db);
    let newStudentCount = 0;

    for (const [i, line] of lines.entries()) {
        const parts = line.split(/[,，]/);
        if (parts.length !== 2) { renderModal('message', { type: 'error', title: '格式錯誤', message: `格式錯誤於第 ${i + 1} 行: "${line}"` }); return; }
        const [seatStr, name] = parts.map(p => p.trim());
        const seatNumber = parseInt(seatStr);
        if (isNaN(seatNumber) || !name) { renderModal('message', { type: 'error', title: '格式錯誤', message: `格式錯誤於第 ${i + 1} 行: "${line}"` }); return; }
        if (existingSeats.has(seatNumber)) { continue; /* Skip existing student */ }

        const defaultPassword = generateDefaultPassword(selectedClass.className, seatNumber);
        const studentId = `${classId}_${seatNumber}`;
        const newStudent = { name, seatNumber, studentId, passwordHash: await hashString(defaultPassword) };

        batch.set(doc(studentsRef, studentId), newStudent);
        existingSeats.add(seatNumber);
        newStudentCount++;
    }

    if (newStudentCount === 0) { renderModal('message', { type: 'info', title: '提示', message: '沒有可延攬的新學子（可能座號都已存在）。' }); return; }

    try {
        await batch.commit();
        renderModal('message', { type: 'success', title: '延攬成功', message: `成功延攬 ${newStudentCount} 位新學子！` });
        updateRosterDisplay(classId); // Refresh roster
    } catch (e) { console.error("批量匯入失敗:", e); renderModal('message', { type: 'error', title: '延攬失敗', message: '操作失敗，請稍後再試。' }); }
}

export async function handleEditStudent(classId, studentId) {
    try {
        const studentDocRef = doc(db, `classes/${classId}/students`, studentId);
        const studentDoc = await getDoc(studentDocRef);
        if (studentDoc.exists()) {
            renderModal('editStudent', { student: studentDoc.data() });
            const confirmBtn = document.getElementById('confirm-edit-student-btn');
            confirmBtn.dataset.classId = classId;
            confirmBtn.dataset.studentId = studentId;
        }
    } catch (e) { console.error("Error fetching student for edit:", e); }
}

export async function handleSaveStudentEdit() {
    const confirmBtn = document.getElementById('confirm-edit-student-btn');
    const { classId, studentId } = confirmBtn.dataset;
    const newSeat = parseInt(document.getElementById('edit-student-seat').value);
    const newName = document.getElementById('edit-student-name').value.trim();
    const errorEl = document.getElementById('edit-student-error');

    if (!newName || isNaN(newSeat)) { errorEl.textContent = '座號與姓名不可為空。'; return; }

    const studentsRef = collection(db, `classes/${classId}/students`);
    const seatQuery = query(studentsRef, where("seatNumber", "==", newSeat), limit(1));
    const seatSnapshot = await getDocs(seatQuery);
    if (!seatSnapshot.empty && seatSnapshot.docs[0].id !== studentId) {
        errorEl.textContent = '該座號已被其他學子使用。';
        return;
    }

    try {
        const studentDocRef = doc(studentsRef, studentId);
        await updateDoc(studentDocRef, { name: newName, seatNumber: newSeat });
        closeModal();
        renderModal('message', { type: 'success', title: '更新成功', message: '學籍資料已更新！' });
        updateRosterDisplay(classId); // Refresh roster
    } catch (e) {
        console.error("更新學生失敗:", e);
        errorEl.textContent = '更新失敗，請稍後再試。';
    }
}

export async function handleDeleteStudent(classId, studentId) {
    try {
        const studentDoc = await getDoc(doc(db, `classes/${classId}/students`, studentId));
        const studentName = studentDoc.exists() ? studentDoc.data().name : '該位學子';

        renderModal('deleteStudentConfirm', {
            studentName: studentName,
            classId: classId,
            studentId: studentId
        });
    } catch (error) {
        console.error("Error preparing student deletion:", error);
        renderModal('message', { title: '錯誤', message: '準備刪除作業時發生錯誤。' });
    }
}

export async function confirmDeleteStudent() {
    const confirmBtn = document.getElementById('confirm-delete-student-btn');
    const { classId, studentId } = confirmBtn.dataset;

    closeModal();
    showLoading('正在刪除學子及其記錄...');

    try {
        const batch = writeBatch(db);

        // 1. Delete the student document itself
        const studentDocRef = doc(db, `classes/${classId}/students`, studentId);
        batch.delete(studentDocRef);

        // 2. Find and delete all submissions by this student
        const submissionsQuery = query(collection(db, "submissions"), where("studentId", "==", studentId));
        const submissionsSnapshot = await getDocs(submissionsQuery);
        submissionsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 3. Find and delete all achievements by this student
        const achievementsQuery = query(collection(db, "student_achievements"), where("studentId", "==", studentId));
        const achievementsSnapshot = await getDocs(achievementsQuery);
        achievementsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 4. Commit all batched writes
        await batch.commit();

        renderModal('message', { type: 'success', title: '除籍成功', message: '學子已成功除籍。' });
        updateRosterDisplay(classId); // Refresh the roster view

    } catch (e) {
        console.error("刪除學生失敗:", e);
        renderModal('message', { type: 'error', title: '刪除失敗', message: '操作失敗，請檢查主控台錯誤訊息。' });
    } finally {
        hideLoading();
    }
}

export async function handleEditArticle(e) {
    const articleId = e.target.closest('[data-assignment-id]')?.dataset.assignmentId;
    if (!articleId) {
        console.error("handleEditArticle: Could not find articleId from event target.");
        return;
    }

    // First, try to find it in any of the loaded states for performance
    let article = appState.teacherArticleQueryState.articles.find(a => a.id === articleId)
        || appState.assignments.find(a => a.id === articleId)
        || (appState.allTeacherArticles || []).find(a => a.id === articleId);

    if (article) {
        console.log('Rendering editArticle modal with assignment:', article);
        console.log('isPublic value:', article.isPublic);
        renderModal('editArticle', { assignment: article });
    } else {
        // If not found, fetch it directly from Firestore as a robust fallback
        showLoading('正在讀取篇章資料...');
        try {
            const docRef = doc(db, "assignments", articleId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                article = { id: docSnap.id, ...docSnap.data() };
                renderModal('editArticle', { assignment: article });
            } else {
                renderModal('message', { type: 'error', title: '錯誤', message: '找不到該篇章的資料。' });
            }
        } catch (err) {
            console.error("Error fetching article directly:", err);
            renderModal('message', { type: 'error', title: '錯誤', message: '讀取篇章資料時發生錯誤。' });
        } finally {
            hideLoading();
        }
    }
}

export async function bulkUpdatePublicStatus(isPublic) {
    const selectedCheckboxes = document.querySelectorAll('.article-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        renderModal('message', { type: 'info', title: '提示', message: '請先選取要操作的文章。' });
        return;
    }

    const articleIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    const statusText = isPublic ? '公開' : '私密';

    renderModal('confirm', {
        title: '確認批次更新',
        message: `確定要將 ${articleIds.length} 篇文章設為${statusText}嗎？`,
        onConfirm: async () => {
            showLoading('批次更新中...');

            try {
                const batch = writeBatch(db);

                articleIds.forEach(articleId => {
                    const articleRef = doc(db, "assignments", articleId);
                    batch.update(articleRef, { isPublic: isPublic });
                });

                await batch.commit();
                renderModal('message', { type: 'success', title: '更新成功', message: `成功將 ${articleIds.length} 篇文章設為${statusText}。` });
                await fetchTeacherAssignmentsPage(true); // Refresh list
            } catch (error) {
                console.error(`批次更新文章狀態失敗:`, error);
                renderModal('message', { type: 'error', title: '批次更新失敗', message: '批次更新失敗，請稍後再試。' });
            } finally {
                hideLoading();
                // Reset UI
                const bulkContainer = document.getElementById('bulk-actions-container');
                if (bulkContainer) bulkContainer.classList.add('hidden');
                const selectAll = document.getElementById('select-all-articles');
                if (selectAll) selectAll.checked = false;
                document.querySelectorAll('.article-checkbox').forEach(cb => cb.checked = false);
            }
        }
    });
}

export async function handleDeleteArticle(e) {
    const articleId = e.target.dataset.assignmentId;
    if (!articleId) { renderModal('message', { type: 'error', title: '操作錯誤', message: '找不到篇章 ID。' }); return; }
    const article = appState.assignments.find(a => a.id === articleId);

    renderModal('confirm', {
        title: '確認刪除篇章',
        message: `您確定要刪除篇章「${article.title}」嗎？此舉將一併移除所有學子的相關挑戰記錄，且無法復原。`,
        onConfirm: async () => {
            showLoading('正在刪除篇章及其所有挑戰記錄...');
            try {
                const batch = writeBatch(db);
                batch.delete(doc(db, `assignments`, articleId));
                const submissionsQuery = query(collection(db, "submissions"), where("assignmentId", "==", articleId));
                const submissionsSnapshot = await getDocs(submissionsQuery);
                submissionsSnapshot.forEach(d => batch.delete(d.ref));
                await batch.commit();
                appState.assignments = appState.assignments.filter(a => a.id !== articleId);
                // Instead of re-rendering the whole table, just remove the element from the DOM
                const articleElement = document.querySelector(`[data-assignment-id="${articleId}"]`);
                if (articleElement) {
                    articleElement.remove();
                }

                // Hide the analysis panel if it's visible
                const analysisPanel = document.getElementById('analysis-panel');
                if (analysisPanel) {
                    analysisPanel.classList.add('hidden');
                }
                renderModal('message', { type: 'success', title: '刪除成功', message: `篇章「${article.title}」已刪除。` });
            } catch (e) {
                console.error("刪除文章失敗:", e);
                renderModal('message', { type: 'error', title: '刪除失敗', message: '操作失敗，請稍後再試。' });
            } finally {
                hideLoading();
            }
        }
    });
}

export async function handleBulkDelete() {
    const selectedIds = Array.from(document.querySelectorAll('.article-checkbox:checked')).map(cb => cb.value);
    if (selectedIds.length === 0) {
        renderModal('message', { type: 'info', title: '提示', message: '請至少選取一個要刪除的篇章。' });
        return;
    }

    renderModal('confirm', {
        title: '確認批次刪除',
        message: `您確定要刪除選取的 ${selectedIds.length} 個篇章嗎？此舉將一併移除所有相關的學子作答記錄，且無法復原。`,
        onConfirm: async () => {
            showLoading(`正在刪除 ${selectedIds.length} 個篇章...`);
            try {
                const batch = writeBatch(db);
                for (const articleId of selectedIds) {
                    batch.delete(doc(db, `assignments`, articleId));
                    const submissionsQuery = query(collection(db, "submissions"), where("assignmentId", "==", articleId));
                    const submissionsSnapshot = await getDocs(submissionsQuery);
                    submissionsSnapshot.forEach(d => batch.delete(d.ref));
                }
                await batch.commit();
                appState.assignments = appState.assignments.filter(a => !selectedIds.includes(a.id));
                renderTeacherArticleTable(appState.assignments, true);
                document.getElementById('analysis-panel').classList.add('hidden');
                document.getElementById('select-all-articles').checked = false;
                document.getElementById('bulk-actions-container').classList.add('hidden');
                renderModal('message', { type: 'success', title: '批次刪除成功', message: `已成功刪除 ${selectedIds.length} 個篇章。` });
            } catch (e) {
                console.error("批次刪除文章失敗:", e);
                renderModal('message', { type: 'error', title: '批次刪除失敗', message: '操作失敗，請檢查主控台錯誤訊息。' });
            } finally {
                hideLoading();
            }
        }
    });
}

export function getRandomOption(selectId) {
    const select = document.getElementById(selectId);
    const options = Array.from(select.options).slice(1); // Exclude "AI 自動判斷"
    return options[Math.floor(Math.random() * options.length)].value;
}

export function getDifficultyInstructions(difficulty) {
    switch (difficulty) {
        case '簡單':
            return `*   **文章風格**: 詞彙具體，以常用字為主（符合台灣教育部頒布之常用字標準）。句式簡短，多為單句或簡單複句。主題貼近日常生活經驗。篇幅約 400-600 字。\n*   **試題風格**: 題目多為「擷取與檢索」層次，答案可直接在文章中找到。選項與原文用字高度相似。`;
        case '基礎':
            return `*   **文章風格**: 詞彙淺白易懂，句式以簡單複句為主。主題明確，結構為總分總。篇幅約 600-700 字。\n*   **試題風格**: 題目以「擷取與檢索」和淺層的「統整與解釋」為主，需要對段落進行簡單歸納。`;
        case '普通':
            return `*   **文章風格**: **以「台灣國中教育會考國文科」的平均難度為基準**。詞彙量適中，包含少量成語或較正式的書面語。句式長短錯落，開始出現較複雜的從屬句。主題可能涉及社會、自然、人文等領域。篇幅約 600-800 字。\n*   **試題風格**: 題目均衡分佈於 PISA 三層次，特別著重「統整與解釋」，需要理解段落主旨、文意轉折。`;
        case '進階':
            return `*   **文章風格**: 詞彙量豐富，包含較多抽象詞彙、成語及修辭技巧。句式複雜，多長句和多層次的複句。主題可能具有思辨性或專業性。篇幅約 800-1000 字。\n*   **試題風格**: 題目以「統整與解釋」和「省思與評鑑」為主，需要進行跨段落的訊息整合、推論作者觀點或評論文章內容。`;
        case '困難':
            return `*   **文章風格**: 詞彙精深，可能包含少量文言詞彙或專業術語。句式精鍊且高度複雜，可能使用非線性敘事或象徵手法。主題抽象，需要讀者具備相應的背景知識。篇幅約 1000-1200 字。\n*   **試題風格**: 題目以「省思與評鑑」為主，要求批判性思考，如評鑑論點的說服力、分析寫作手法的效果，或結合自身經驗進行評價。`;
        default:
            return `*   **文章風格**: 以「台灣國中教育會考國文科」的平均難度為基準。詞彙量適中，句式長短錯落。篇幅約 600-800 字。\n*   **試題風格**: 題目均衡分佈於 PISA 三層次。`;
    }
}

export async function generateAssignment() {
    const topic = document.getElementById('topic-input').value.trim();
    const deadline = document.getElementById('deadline-input').value;
    if (!topic) { renderModal('message', { type: 'error', title: '生成失敗', message: '請輸入篇章主題！' }); return; }

    const tagFormat = document.getElementById('tag-format-input').value || getRandomOption('tag-format-input');
    const tagContentType = document.getElementById('tag-contentType-input').value || getRandomOption('tag-contentType-input');
    const tagDifficulty = document.getElementById('tag-difficulty-input').value || getRandomOption('tag-difficulty-input');

    const difficultyInstruction = getDifficultyInstructions(tagDifficulty);

    const contentTypeInstructions = {
        '記敘': '**寫作手法提醒：請務必使用記敘文體，包含明確的人物、時間、地點和事件經過，著重於故事的發展與情節的描述，避免使用過於客觀或分析性的說明語氣。**',
        '議論': '**寫作手法提醒：請務必使用議論文體，提出明確的論點，並使用例證、引證或數據來支持你的主張，結構上應包含引論、本論、結論。**',
        '抒情': '**寫作手法提醒：請務必使用抒情文體，透過細膩的描寫與譬喻、轉化等修辭手法，表達豐富的情感與想像，著重於意境的營造。**'
    };
    const styleInstruction = contentTypeInstructions[tagContentType] || '';

    let articleInstruction;
    const mermaidInstruction = `\n    * **圖表運用指南**：請優先考慮使用 **Mermaid.js 語法** 來建立視覺化圖表，以更生動地呈現資訊。
        * **圖表類型**：請根據內容選擇最合適的圖表，例如用 \`xychart-beta\` 呈現數據、用 \`flowchart\` 展示流程、用 \`pie\` 顯示比例等。
        * **語法規則**：圖表語法需以 \`\`\`mermaid 開頭，以 \`\`\` 結尾。
        * **換行技巧**：在 \`xychart-beta\` 中，如果 X 軸的標籤文字過長，請在字串內使用 "<br>" 標籤來手動換行。
        * **備用方案**：如果內容不適合複雜圖表，也可以使用 GFM (GitHub Flavored Markdown) 格式的表格。`;

    if (tagFormat === '圖表') {
        articleInstruction = `**請以一個主要的 Mermaid 圖表或 Markdown 表格作為文章核心**。所有文字內容應是針對此圖表的簡潔說明，重點在於測驗學生詮釋圖表資訊的能力。${mermaidInstruction}`;
    } else if (tagFormat === '圖文') {
        articleInstruction = `撰寫一篇優質連續文本文章，內容需清晰、有深度、層次分明，且**務必分段**。**請務必在文章內容中，插入一個以上與主題相關、能輔助說明的 Mermaid 圖表或 Markdown 表格**，用以測驗圖文整合能力。${mermaidInstruction}`;
    } else { // 純文
        articleInstruction = `撰寫一篇優質文章，內容需清晰、有深度、層次分明，且**務必分段**。`;
    }

    showLoading(`AI 書僮正在設計篇章...`);

    let questionLevelInstruction = '題目層次分配如下：第 1 題：**擷取與檢索**。第 2、3 題：**統整與解釋**。第 4、5 題：**省思與評鑑**。';
    const suitableContentTypes = new Set(['記敘', '抒情', '議論']);
    if (suitableContentTypes.has(tagContentType) && Math.random() < 0.4) { // 40% 機率考寫作手法
        const techniqueQuestionPosition = Math.random() < 0.5 ? 4 : 5; // 隨機選第4或第5題
        if (techniqueQuestionPosition === 4) {
            questionLevelInstruction = '題目層次分配如下：第 1 題：**擷取與檢索**。第 2、3 題：**統整與解釋**。第 4 題：**寫作手法分析** (請針對本文使用的一種主要或特殊寫作手法進行提問)。第 5 題：**省思與評鑑**。';
        } else {
            questionLevelInstruction = '題目層次分配如下：第 1 題：**擷取與檢索**。第 2、3 題：**統整與解釋**。第 4 題：**省思與評鑑**。第 5 題：**寫作手法分析** (請針對本文使用的一種主要或特殊寫作手法進行提問)。';
        }
    }

    const prompt = `你是一位專為台灣國中生出題的資深國文科老師，請設計一份素養導向的閱讀測驗。所有文本與試題的難度應以「普通」難度作為「國中教育會考」的基準，再根據使用者指定的難度標籤，適度調整文章長度、詞彙深度、句式複雜度與題目鑑別度。
主題：「${topic}」
請遵循以下專業要求：
1.  **篇章撰寫**：
    * **標題設計**：根據主題「${topic}」，發想一個 **能引發學生好奇心並反映文章主旨** 的標題。請參考以下風格：
        - 使用疑問句引發思考（如：「沉默，真的是金嗎？」）
        - 使用對比製造張力（如：「最遠的距離，最近的心」）
        - 使用隱喻增添韻味（如：「一座會呼吸的城市」）
        - **絕不可**使用誇張、聳動或內容農場式風格
	* **所有連續文本文字段落（包含第一段）的開頭都必須加上兩個全形空格「　　」來進行縮排。如果是詩歌體則不用。**
	 * **連續文本文字段落間請務必空一行。**
    * ${styleInstruction}
    * **難度指引**:
${difficultyInstruction}
    * ${articleInstruction}
    * **絕不使用圖片或圖片語法**。
2.  **試煉設計**：
    * 根據篇章，設計 5 道符合 PISA 閱讀素養三層次的單選題。
    * **試題必須是素養導向的**，旨在考驗學子的歸納、分析、批判與應用能力，而非僅是記憶。
    * **試題必須是客觀題，答案能直接或間接從文本中找到，絕不可出現『你認為』、『你覺得』等開放式問句。**
    * **選項設計要求（極重要）**：
        - 錯誤選項必須反映學生常見的迷思概念（如：只看關鍵詞忽略上下文、混淆因果與相關、過度推論、斷章取義等）
        - 錯誤選項不可有明顯語法或邏輯漏洞，必須看似合理
        - 每題四個選項長度應相近，避免「最長選項是答案」的規律
        - 正確答案在四個選項中的位置必須隨機分布（0, 1, 2, 3）
    * **答題解析要求**：每題的 explanation 必須包含：(1) 明確說明正確答案的原因並引用原文佐證 (2) 逐一解釋其他三個選項為何錯誤
    * ${questionLevelInstruction}
3.  **標籤要求**：
    * **形式**: 請生成「${tagFormat}」形式的內容。
    * **內容**: 請生成「${tagContentType}」類型的內容。
    * **難度**: 請嚴格遵循上方的「難度指引」來生成「${tagDifficulty}」難度的內容，並將此難度作為標籤。
4.  **產出格式**：請嚴格按照指定的 JSON 格式輸出，不要包含 JSON 格式以外的任何文字。`;
    const schema = { type: "OBJECT", properties: { title: { type: "STRING" }, article: { type: "STRING" }, questions: { type: "ARRAY", items: { type: "OBJECT", properties: { questionText: { type: "STRING" }, options: { type: "ARRAY", items: { type: "STRING" } }, correctAnswerIndex: { type: "NUMBER" }, explanation: { type: "STRING" } }, required: ["questionText", "options", "correctAnswerIndex", "explanation"] } }, tags: { type: "OBJECT", properties: { format: { type: "STRING" }, contentType: { type: "STRING" }, difficulty: { type: "STRING" } }, required: ["format", "contentType", "difficulty"] } }, required: ["title", "article", "questions", "tags"] };
    try {
        if (!appState.geminiApiKey) throw new Error("AI API 金鑰未設定。");
        const apiKey = appState.geminiApiKey;
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", responseSchema: schema } };
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${appState.geminiModel}:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`API 請求失敗`);
        const result = await response.json();
        if (result.candidates?.length > 0) {
            const content = JSON.parse(result.candidates[0].content.parts[0].text);

            showLoading('AI 書僮正在生成深度解析...');
            const analysis = await callFullGeminiAnalysis(content.article);

            const newAssignment = { ...content, analysis: analysis, createdAt: new Date(), isPublic: document.getElementById('ai-is-public').checked };
            if (deadline) newAssignment.deadline = Timestamp.fromDate(new Date(deadline + "T23:59:59"));

            await addDoc(collection(db, `assignments`), newAssignment);
            await getAssignments(true); // Force refresh cache
            document.getElementById('topic-input').value = '';
            document.getElementById('deadline-input').value = '';
            // Also refresh teacher view if active
            if (appState.currentView === 'teacher') {
                fetchTeacherAssignmentsPage(true);
            }
        } else { throw new Error("API 未返回有效內容。"); }
    } catch (error) { console.error("生成文章失敗:", error); renderModal('message', { type: 'error', title: '生成失敗', message: '操作失敗，請稍後再試。' }); }
    finally { hideLoading(); }
}

export async function callGeminiAPI(article) {
    if (!appState.geminiApiKey) {
        throw new Error("AI API 金鑰未設定。");
    }
    const apiKey = appState.geminiApiKey;
    const prompt = `請針對以下文章進行深度解析，並嚴格依照以下 JSON 格式回傳：
{
  "mindmap": "（請在此處生成 Mermaid 的 markdown 格式心智圖，總結文章的重點）",
  "explanation": "（請在此處生成文章的深度解析，分析其主旨、結構、風格）",
  "thinking_questions": [
    "（請在此處生成第一個延伸思考問題）",
    "（請在此處生成第二個延伸思考問題）",
    "（請在此處生成第三個延伸思考問題）"
  ]
}

文章內容如下：
${article}`;
    const payload = {
        contents: [{
            role: "user",
            parts: [{
                text: prompt
            }]
        }]
    };
    let response;
    for (let i = 0; i < 3; i++) {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${appState.geminiModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            break;
        }
        if (response.status === 503 && i < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        } else {
            break;
        }
    }

    if (!response.ok) {
        throw new Error(`API 請求失敗`);
    }
    const result = await response.json();
    if (result.candidates?.length > 0 && result.candidates[0].content.parts?.length > 0) {
        const text = result.candidates[0].content.parts[0].text;
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '');
        return JSON.parse(cleanedText);
    } else {
        console.error("API response is missing expected structure:", result);
        throw new Error("API 未返回有效內容或內容結構不符。");
    }
}

export async function handleGenerateQuestionsFromPasted() {
    const title = document.getElementById('pasted-title-input').value.trim();
    const article = document.getElementById('pasted-article-textarea').value.trim();
    const deadline = document.getElementById('pasted-deadline-input').value;
    if (!title || !article) { renderModal('message', { type: 'error', title: '生成失敗', message: '請輸入標題和文章內容！' }); return; }

    const tagFormat = document.getElementById('pasted-tag-format-input').value;
    const tagContentType = document.getElementById('pasted-tag-contentType-input').value;
    const tagDifficulty = document.getElementById('pasted-tag-difficulty-input').value;
    let tagInstruction;
    if (tagFormat || tagContentType || tagDifficulty) {
        tagInstruction = "請參考以下指定的標籤來判斷文章屬性，若有衝突以文章內容為準。";
        if (tagFormat) tagInstruction += ` 形式參考：「${tagFormat}」。`;
        if (tagContentType) tagInstruction += ` 內容參考：「${tagContentType}」。`;
        if (tagDifficulty) tagInstruction += ` 難度參考：「${tagDifficulty}」。`;
    } else {
        tagInstruction = `請你根據提供的文章內容，從「形式」、「內容」、「難度」三個類別中，各選擇一個最適合的標籤。**絕不可以創造選項之外的新標籤**。`;
    }

    showLoading(`AI 正在分析文本並生成試題...`);
    const prompt = `你是一位學養深厚的書院夫子。請根據以下提供的篇章，為其設計 5 道符合 PISA 閱讀素養的單選試題，並判斷其標籤。
請遵循以下專業要求：
1.  **試題設計**：
    * **試題必須是素養導向的**，旨在考驗學子的歸納、分析、批判與應用能力。
    * **試題必須是客觀題，答案能直接或間接從文本中找到，絕不可出現『你認為』、『你覺得』等開放式問句。**
    * 試題層次分配如下：第 1 題：**擷取與檢索**。第 2、3 題：**統整與解釋**。第 4、5 題：**省思與評鑑**。
    * **選項設計要求（極重要）**：
        - 錯誤選項必須反映學生常見的迷思概念（如：只看關鍵詞忽略上下文、混淆因果與相關、過度推論、斷章取義等）
        - 錯誤選項不可有明顯語法或邏輯漏洞，必須看似合理
        - 每題四個選項長度應相近，避免「最長選項是答案」的規律
    * **答題解析要求**：每題的 explanation 必須包含：(1) 明確說明正確答案的原因並引用原文佐證 (2) 逐一解釋其他三個選項為何錯誤
2.  **JSON 結構說明 (極度重要)**：
    * **\`options\`**：這是一個包含四個字串的陣列，代表四個選項。
    * **\`correctAnswerIndex\`**：這是一個**數字**，代表正確答案在 \`options\` 陣列中的**索引 (index)**。索引從 0 開始計算。
    * **範例**：如果 \`options\` 是 \`["貓", "狗", "鳥", "魚"]\`，而正確答案是 "鳥"，那麼 \`correctAnswerIndex\` **必須**是 \`2\`。
    * **隨機性要求**：請務必確保正確答案在 \`options\` 陣列中的位置是隨機的，因此 \`correctAnswerIndex\` 的值 (0, 1, 2, 3) 也必須是隨機出現的。
3.  **標籤要求**：
    * ${tagInstruction}
    * **形式選項與解讀**: 「純文」(連續文本)、「圖表」(以圖表為主，文字為輔)、「圖文」(以連續文本為主，圖表為輔)。
    * **內容選項**: 「記敘」、「抒情」、「說明」、「議論」、「應用」。
    * **難度選項與解讀**: 「簡單」、「基礎」、「普通」、「進階」、「困難」。**特別注意：如果篇章包含文言文，其難度至少應從「進階」起跳。**
4.  **產出格式**：嚴格按照指定的 JSON 格式輸出，僅包含 questions 和 tags 兩個 key。
---
**篇章內容如下**：\`\`\`${article}\`\`\``;
    const schema = { type: "OBJECT", properties: { questions: { type: "ARRAY", items: { type: "OBJECT", properties: { questionText: { type: "STRING" }, options: { type: "ARRAY", items: { type: "STRING" } }, correctAnswerIndex: { type: "NUMBER" }, explanation: { type: "STRING" } }, required: ["questionText", "options", "correctAnswerIndex", "explanation"] } }, tags: { type: "OBJECT", properties: { format: { type: "STRING" }, contentType: { type: "STRING" }, difficulty: { type: "STRING" } }, required: ["format", "contentType", "difficulty"] } }, required: ["questions", "tags"] };
    try {
        if (!appState.geminiApiKey) throw new Error("AI API 金鑰未設定。");
        const apiKey = appState.geminiApiKey;
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", responseSchema: schema } };

        let response;
        for (let i = 0; i < 3; i++) {
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${appState.geminiModel}:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (response.ok) {
                break;
            }
            if (response.status === 503 && i < 2) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            } else {
                break;
            }
        }

        if (!response.ok) throw new Error(`API 請求失敗`);
        const result = await response.json();
        if (result.candidates?.length > 0) {
            const content = JSON.parse(result.candidates[0].content.parts[0].text);

            showLoading('AI 書僮正在生成深度解析...');
            const analysis = await callFullGeminiAnalysis(article);

            const newAssignment = { title, article, ...content, analysis: analysis, createdAt: new Date(), isPublic: document.getElementById('pasted-is-public').checked };
            if (deadline) newAssignment.deadline = Timestamp.fromDate(new Date(deadline + "T23:59:59"));
            await addDoc(collection(db, `assignments`), newAssignment);
            await getAssignments(true); // Force refresh cache
            document.getElementById('pasted-title-input').value = '';
            document.getElementById('pasted-article-textarea').value = '';
            document.getElementById('pasted-deadline-input').value = '';
            renderModal('message', { type: 'success', title: '生成成功', message: '試題已成功生成並儲存！' });
            if (appState.currentView === 'teacher') {
                fetchTeacherAssignmentsPage(true);
            }
        } else { throw new Error("API 未返回有效內容。"); }
    } catch (error) { console.error("生成試題失敗:", error); renderModal('message', { type: 'error', title: '生成失敗', message: '操作失敗，請稍後再試。' }); }
    finally { hideLoading(); }
}

export async function handleAiAnalysis(articleId) {
    if (!articleId) {
        renderModal('message', { type: 'error', title: '錯誤', message: '缺少文章 ID，無法進行分析。' });
        return;
    }
    const article = appState.currentAssignment; // Always use the currently displayed article
    const selectedClassId = document.getElementById('class-selector').value;
    if (!selectedClassId) { renderModal('message', { type: 'info', title: '提示', message: '請先選擇一個學堂以進行分析。' }); return; }
    const selectedClass = appState.allClasses.find(c => c.id === selectedClassId);
    const submissions = appState.allSubmissions.filter(s => s.assignmentId === articleId && s.classId === selectedClassId);
    if (submissions.length < 1) { renderModal('message', { type: 'info', title: '提示', message: '該學堂至少需要1位學子的挑戰記錄才能進行有效分析。' }); return; }
    showLoading(`AI 書僮正在分析學堂數據...`);
    const analysisData = article.questions.map((q, q_idx) => {
        const answerCounts = q.options.map(() => 0);
        let correctCount = 0;
        submissions.forEach(s => {
            const answerIdx = s.answers[q_idx];
            if (answerIdx !== null && answerIdx < answerCounts.length) answerCounts[answerIdx]++;
            if (answerIdx === q.correctAnswerIndex) correctCount++;
        });
        return { question: q.questionText, options: q.options, correctAnswer: q.options[q.correctAnswerIndex], totalAnswers: submissions.length, correctCount, answerDistribution: answerCounts };
    });
    const teacherName = appState.currentUser.name || '老師';
    const today = new Date();
    const reportDate = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    const prompt = `身為一位洞察敏銳的書院夫子，請根據以下這份閱讀試煉的作答數據，為${teacherName}夫子提供一份專業、深入的教學策勵。
---
**課業基本資料**
- **策勵對象**: ${teacherName}夫子
- **分析者**: 書院教學輔佐
- **報告日期**: ${reportDate}
- **試煉篇章**: 《${article.title}》
- **受試學堂**: ${selectedClass.className}
- **應試人數**: ${submissions.length} 人
---
**學子作答數據**
\`\`\`json
${JSON.stringify(analysisData, null, 2)}
\`\`\`
---
**策勵撰寫要求**
1.  **引言**: 簡要說明本次試煉的整體表現。
2.  **逐題分析**: 深入探討高誘答率的錯誤選項，分析學子可能的學習盲點。
3.  **綜合評估與教學建議**：總結學子在 PISA 三層次上的整體表現，並提出 2-3 點具體、可行的教學方向。
4.  **格式**: 請使用 Markdown 格式，讓報告清晰易讀，並帶有鼓勵與專業的語氣。`;
    try {
        if (!appState.geminiApiKey) throw new Error("AI API 金鑰未設定。");
        const apiKey = appState.geminiApiKey;
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`API 請求失敗`);
        const result = await response.json();
        if (result.candidates?.length > 0) {
            const analysisText = result.candidates[0].content.parts[0].text;
            renderModal('aiAnalysis', { analysisText });
        } else { throw new Error("API 未返回有效內容。"); }
    } catch (error) { console.error("AI 分析失敗:", error); renderModal('message', { type: 'error', title: '分析失敗', message: 'AI 分析失敗，請稍後再試。' }); }
    finally { hideLoading(); }
}

export async function fetchTeacherAssignmentsPage(isNewQuery = false) {
    const state = appState.teacherArticleQueryState;
    if (state.isLoading) return;
    if (!isNewQuery && state.isLastPage) return;

    state.isLoading = true;
    updateTeacherLoadMoreButton();

    try {
        if (isNewQuery) {
            state.articles = [];
            state.isLastPage = false;
            const assignmentsQuery = query(collection(db, "assignments"), orderBy("createdAt", "desc"));
            const documentSnapshots = await getDocs(assignmentsQuery);
            appState.allTeacherArticles = documentSnapshots.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        }

        let filteredArticles = [...appState.allTeacherArticles];
        const filters = state.filters;

        if (filters.format) {
            filteredArticles = filteredArticles.filter(a => a.tags?.format === filters.format);
        }
        if (filters.contentType) {
            filteredArticles = filteredArticles.filter(a => a.tags?.contentType === filters.contentType);
        }
        if (filters.difficulty) {
            filteredArticles = filteredArticles.filter(a => a.tags?.difficulty === filters.difficulty);
        }
        if (filters.searchTerm) {
            filteredArticles = filteredArticles.filter(a => a.title && a.title.toLowerCase().includes(filters.searchTerm.toLowerCase()));
        }
        if (filters.deadlineStatus) {
            const now = new Date();
            filteredArticles = filteredArticles.filter(a => {
                if (!a.deadline || typeof a.deadline.toDate !== 'function') {
                    return filters.deadlineStatus === 'none';
                }
                const deadline = a.deadline.toDate();
                const isExpired = deadline <= now;
                if (filters.deadlineStatus === 'active') return !isExpired;
                if (filters.deadlineStatus === 'expired') return isExpired;
                if (filters.deadlineStatus === 'none') return false;
                return true;
            });
        }

        const PAGE_SIZE = 15;
        const startIndex = state.articles.length;
        const endIndex = startIndex + PAGE_SIZE;
        const newAssignments = filteredArticles.slice(startIndex, endIndex);

        if (isNewQuery) {
            state.articles = newAssignments;
        } else {
            state.articles.push(...newAssignments);
        }

        state.isLastPage = state.articles.length >= filteredArticles.length;

        renderTeacherArticleTable(newAssignments, isNewQuery);

    } catch (error) {
        console.error("Error fetching teacher assignments:", error);
    } finally {
        state.isLoading = false;
        updateTeacherLoadMoreButton();
    }
}

export async function updateAssignedArticlesList() {
    if (!appState.currentUser?.studentId) {
        renderAssignmentsList([]);
        return;
    }

    try {
        const allAssignments = await getAssignments();
        const userSubmissions = appState.allSubmissions.filter(s => s.studentId === appState.currentUser.studentId);
        // Only consider "passed" (highest score >= 60) as truly completed
        const passedAssignmentIds = new Set(userSubmissions.filter(s => {
            let highestScore = s.score || 0;
            if (s.attempts && s.attempts.length > 0) {
                highestScore = Math.max(...s.attempts.map(a => a.score));
            }
            return highestScore >= 60;
        }).map(s => s.assignmentId));

        const isStudentUser = appState.currentUser?.type === 'student';
        let assignmentsToRender = allAssignments.filter(a => {
            // For student users, hide private articles. Teachers can see all.
            if (isStudentUser && a.isPublic !== true) {
                return false;
            }
            return a.deadline && !passedAssignmentIds.has(a.id);
        });
        assignmentsToRender.sort((a, b) => a.deadline.toMillis() - b.deadline.toMillis());

        renderAssignmentsList(assignmentsToRender);

    } catch (error) {
        console.error("Error updating assigned articles list:", error);
        renderAssignmentsList([]);
    }
}

export async function renderArticleAnalysisModal(assignmentId) {
    if (!assignmentId) return;

    let article = appState.assignments.find(a => a.id === assignmentId);

    if (!article) {
        console.log(`Article ${assignmentId} not in appState, fetching from DB...`);
        try {
            const articleRef = doc(db, "assignments", assignmentId);
            const articleSnap = await getDoc(articleRef);
            if (articleSnap.exists()) {
                article = { id: articleSnap.id, ...articleSnap.data() };
            } else {
                console.error(`Article with ID ${assignmentId} not found in database.`);
                renderModal('message', { type: 'error', title: '錯誤', message: '在資料庫中找不到指定的文章。' });
                return;
            }
        } catch (error) {
            console.error("Error fetching article from DB:", error);
            renderModal('message', { type: 'error', title: '錯誤', message: '讀取文章資料時發生錯誤。' });
            return;
        }
    }

    // CRITICAL FIX: Always set the found/fetched article as the current one.
    appState.currentAssignment = article;
    console.log(`Set current assignment to: ${article.id}`);

    const selectedClassId = document.getElementById('class-selector')?.value;
    if (!selectedClassId) {
        renderModal('message', { type: 'info', title: '提示', message: '請先從上方的下拉選單選擇一個學堂，才能查看分析報告。' });
        return;
    }

    showLoading('正在載入分析報告...');
    try {
        // **FIX**: Force-load submissions for the selected class and assignment to ensure data is fresh.
        const submissionsQuery = query(
            collection(db, "submissions"),
            where("classId", "==", selectedClassId),
            where("assignmentId", "==", assignmentId)
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);
        const newSubmissions = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Merge new submissions into the global state, avoiding duplicates.
        const existingSubmissionIds = new Set(appState.allSubmissions.map(s => s.id));
        newSubmissions.forEach(sub => {
            if (!existingSubmissionIds.has(sub.id)) {
                appState.allSubmissions.push(sub);
            }
        });

        const students = await loadStudentsForClass(selectedClassId);
        if (students === null) { // Check for null in case of error
            renderModal('message', { type: 'error', title: '錯誤', message: '載入學生資料失敗。' });
            return;
        }
        if (students.length === 0) {
            renderModal('message', { type: 'info', title: '提示', message: '此學堂尚無學子名冊。' });
            return;
        }

        const tableHeader = `<tr class="bg-slate-100"><th class="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">座號</th><th class="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">姓名</th><th class="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">狀態</th><th class="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">分數</th><th class="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">作答時間</th><th class="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">行事</th></tr>`;
        const tableBody = students.sort((a, b) => a.seatNumber - b.seatNumber).map(student => {
            const submission = appState.allSubmissions.find(s => s.assignmentId === assignmentId && s.studentId === student.id);
            let status, score, detailBtn, duration;
            if (submission) {
                const submissionTime = formatSubmissionTime(submission.submittedAt);
                // 教師端看學生第一次的分數做為正式成績
                const firstScore = submission.attempts && submission.attempts.length > 0 ? submission.attempts[0].score : submission.score;

                // 狀態顯示：老師希望看到的是學生最後是否完成挑戰（也就是目前的判定方法）
                let highestScore = submission.score;
                if (submission.attempts && submission.attempts.length > 0) {
                    highestScore = Math.max(...submission.attempts.map(a => a.score));
                }
                const isPassed = highestScore >= 60;

                if (isPassed) {
                    status = submission.isOverdue ? `<span class="font-semibold text-orange-500">逾期完成</span><span class="text-xs text-slate-500 ml-2">${submissionTime}</span>` : `<span class="font-semibold text-green-600">已完成</span><span class="text-xs text-slate-500 ml-2">${submissionTime}</span>`;
                } else if (!isPassed && submission.attempts && submission.attempts.length > 0) {
                    status = `<span class="font-semibold text-red-500">未完（挑戰 ${submission.attempts.length} 次）</span>`;
                } else {
                    status = `<span class="font-semibold text-red-500">未完</span><span class="text-xs text-slate-500 ml-2">${submissionTime}</span>`;
                }

                score = `<span class="font-bold">${firstScore}%</span>`;
                duration = formatTime(submission.durationSeconds || 0); // TODO: 也許需要對齊第一次的作答時間，為了相容舊資料先保留

                if (submission.attempts && submission.attempts.length > 0) {
                    duration = formatTime(submission.attempts[0].durationSeconds || submission.durationSeconds || 0);
                }

                detailBtn = `<button data-assignment-id="${assignmentId}" data-student-id="${student.id}" class="view-submission-review-btn text-red-700 hover:text-red-900 font-semibold">查看詳情</button>`;

                // Add a warning for suspected guessing (使用第一次成績來判斷)
                if ((submission.attempts && submission.attempts.length > 0 ? submission.attempts[0].durationSeconds : submission.durationSeconds) < 60 && firstScore < 60) {
                    status += ` <span class="text-red-500" title="作答時間過短且分數較低，可能為猜測作答。">⚠️</span>`;
                }
            } else {
                status = `<span class="font-semibold text-red-500">未應試</span>`;
                score = '-';
                duration = '-';
                detailBtn = '';
            }
            return `<tr><td class="px-6 py-4">${student.seatNumber}</td><td class="px-6 py-4">${student.name}</td><td class="px-6 py-4">${status}</td><td class="px-6 py-4">${score}</td><td class="px-6 py-4">${duration}</td><td class="px-6 py-4">${detailBtn}</td></tr>`;
        }).join('');

        const tableHtml = `<table class="min-w-full bg-white border border-slate-200 rounded-lg"><thead>${tableHeader}</thead><tbody class="divide-y divide-slate-200">${tableBody}</tbody></table>`;

        renderModal('articleAnalysis', {
            title: `〈${escapeHtml(article.title)}〉 分析報告`,
            contentHtml: tableHtml,
            assignmentId: assignmentId
        });
    } catch (error) {
        console.error("渲染課業分析報告時發生錯誤:", error);
        renderModal('message', { type: 'error', title: '錯誤', message: '載入分析報告失敗。' });
    } finally {
        hideLoading();
    }
}

export function openEditModal(assignment) {
    renderModal('editArticle', { assignment });
}

export async function handleSaveEdit(e) {
    const assignmentId = e.target.dataset.assignmentId;
    if (!assignmentId) return;

    const modal = dom.modalContainer.querySelector('.modal-instance');
    if (!modal) return;

    const errorEl = modal.querySelector('#edit-article-error');
    if (errorEl) errorEl.textContent = '';

    // Read all data from the DOM first before showing the loader
    const title = modal.querySelector('#edit-title').value;
    const article = modal.querySelector('#edit-article').value;
    const deadlineValue = modal.querySelector('#edit-deadline').value;
    const tags = {
        format: modal.querySelector('#edit-tag-format').value,
        contentType: modal.querySelector('#edit-tag-contentType').value,
        difficulty: modal.querySelector('#edit-tag-difficulty').value
    };

    let allQuestionsValid = true;
    const questionsData = [];
    const questionDivs = modal.querySelectorAll('#edit-questions-container > div[data-question-index]');

    for (const qDiv of questionDivs) {
        const index = qDiv.dataset.questionIndex;
        const checkedRadio = qDiv.querySelector(`input[name="edit-correct-${index}"]:checked`);

        if (!checkedRadio) {
            if (errorEl) errorEl.textContent = `錯誤：第 ${parseInt(index) + 1} 題尚未設定正確答案。`;
            allQuestionsValid = false;
            break;
        }

        const question = {
            questionText: qDiv.querySelector('.edit-question-text').value,
            options: Array.from(qDiv.querySelectorAll('.edit-option')).map(opt => opt.value),
            correctAnswerIndex: parseInt(checkedRadio.value),
            explanation: qDiv.querySelector('.edit-explanation').value,
        };
        questionsData.push(question);
    }

    if (!allQuestionsValid) {
        return;
    }

    showLoading('正在儲存變更...');

    const updatedData = {
        title: title,
        article: article,
        questions: questionsData,
        tags: tags,
        analysis: {
            mindmap: modal.querySelector('#edit-analysis-mindmap')?.value || "",
            explanation: modal.querySelector('#edit-analysis-explanation')?.value || "",
            thinking_questions: modal.querySelector('#edit-analysis-thinking-questions')?.value || ""
        },
        isPublic: modal.querySelector('#edit-is-public').checked
    };
    if (deadlineValue) {
        updatedData.deadline = Timestamp.fromDate(new Date(deadlineValue + "T23:59:59"));
    } else {
        updatedData.deadline = deleteField();
    }

    try {
        console.log("Attempting to save data:", JSON.stringify(updatedData, null, 2));
        await updateDoc(doc(db, `assignments`, assignmentId), updatedData);

        // 更新本地 allAssignments 陣列
        if (updatedData.deadline && typeof updatedData.deadline.isEqual === 'function') {
            // This is a sentinel, don't merge it into the local state literally.
            // Instead, remove the property from the local object.
            const localUpdatedData = { ...updatedData };
            delete localUpdatedData.deadline;

            const studentIndex = appState.assignments.findIndex(a => a.id === assignmentId);
            if (studentIndex !== -1) {
                appState.assignments[studentIndex] = { ...appState.assignments[studentIndex], ...localUpdatedData };
                delete appState.assignments[studentIndex].deadline;
            }

            const teacherIndex = appState.teacherArticleQueryState.articles.findIndex(a => a.id === assignmentId);
            if (teacherIndex !== -1) {
                appState.teacherArticleQueryState.articles[teacherIndex] = { ...appState.teacherArticleQueryState.articles[teacherIndex], ...localUpdatedData };
                delete appState.teacherArticleQueryState.articles[teacherIndex].deadline;
            }
        } else {
            const studentIndex = appState.assignments.findIndex(a => a.id === assignmentId);
            if (studentIndex !== -1) {
                appState.assignments[studentIndex] = { ...appState.assignments[studentIndex], ...updatedData };
            }

            const teacherIndex = appState.teacherArticleQueryState.articles.findIndex(a => a.id === assignmentId);
            if (teacherIndex !== -1) {
                appState.teacherArticleQueryState.articles[teacherIndex] = { ...appState.teacherArticleQueryState.articles[teacherIndex], ...updatedData };
            }
        }
        // FIX: Also update the teacher's article list state
        const teacherIndex = appState.teacherArticleQueryState.articles.findIndex(a => a.id === assignmentId);
        if (teacherIndex !== -1) {
            appState.teacherArticleQueryState.articles[teacherIndex] = { ...appState.teacherArticleQueryState.articles[teacherIndex], ...updatedData };
        }

        // INVALITDATE CACHE
        appState.cache.assignments = null;
        appState.cache.lastFetch = 0;

        hideLoading();
        closeModal();
        // FIX: Re-render the teacher's article table with the updated data
        fetchAssignmentsPage(true); // Ensure student side cache is updated if switching views
        renderTeacherArticleTable(appState.teacherArticleQueryState.articles, true);
        renderModal('message', { type: 'success', title: '修訂成功', message: '篇章內容已成功修訂！' });
    } catch (e) {
        const errorEl = modal.querySelector('#edit-article-error');
        hideLoading(); // 在 catch 中也要隱藏 loading
        console.error("Error saving article:", e);
        console.log("Data that failed to save:", JSON.stringify(updatedData, null, 2));
        if (errorEl) errorEl.textContent = '修訂失敗，請按 F12 打開開發者工具，查看 Console 中的詳細錯誤訊息。';
    }
}




export async function displaySubmissionReview(assignmentId, studentId) {
    let assignment = appState.currentAssignment?.id === assignmentId ? appState.currentAssignment : null;

    if (!assignment) {
        assignment = appState.assignments.find(a => a.id === assignmentId) ||
            appState.teacherArticleQueryState.articles.find(a => a.id === assignmentId) ||
            (appState.allTeacherArticles || []).find(a => a.id === assignmentId);
    }

    if (!assignment) {
        // If still not found, fetch from DB
        showLoading('正在讀取課業資料...');
        try {
            const docRef = doc(db, "assignments", assignmentId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                assignment = { id: docSnap.id, ...docSnap.data() };
            }
        } catch (e) {
            console.error("Error fetching assignment for review:", e);
        } finally {
            hideLoading();
        }
    }


    const submission = appState.allSubmissions.find(s => s.assignmentId === assignmentId && s.studentId === studentId);

    if (!submission || !assignment) { renderModal('message', { type: 'error', title: '錯誤', message: '找不到作答記錄或課業資料。' }); return; }

    renderModal('studentDetail');
    setTimeout(() => {
        let userName = submission?.name || '使用者';
        document.getElementById('student-detail-title').textContent = `${userName}《${assignment.title}》作答詳情`;

        // 準備歷次挑戰的 HTML 結構
        let attemptsHtml = '';
        const attempts = submission.attempts || [submission]; // 兼容舊資料，將單一紀錄包裝成陣列

        if (attempts.length > 1) {
            attemptsHtml = `<div class="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h3 class="font-bold text-yellow-800 mb-2">作答歷程 (共挑戰 ${attempts.length} 次)</h3>
                <ul class="list-disc list-inside text-sm text-yellow-900 space-y-1">
                    ${attempts.map((att, idx) => `<li>第 ${idx + 1} 次挑戰：得分 <strong>${att.score}</strong> 分 (耗時 ${formatTime(att.durationSeconds || 0)})</li>`).join('')}
                </ul>
            </div>`;
        }

        // 以最後一次 (最新) 的作答記錄來顯示各題答題狀況
        const latestAttemptAnswers = attempts[attempts.length - 1].answers;

        const questionsHtml = assignment.questions.map((q, i) => {
            const userAnswerIndex = latestAttemptAnswers[i];
            const correctAnswerIndex = q.correctAnswerIndex;
            const isCorrect = userAnswerIndex === correctAnswerIndex;
            return `<div class="p-4 rounded-lg mb-3 ${isCorrect ? 'bg-green-100' : 'bg-red-100'}"><p class="font-semibold text-gray-800">第 ${i + 1} 題: ${q.questionText}</p><p class="mt-2 text-sm">你的選擇: <span class="font-medium">${userAnswerIndex !== null ? q.options[userAnswerIndex] : '未作答'}</span></p><p class="mt-1 text-sm">正確答案: <span class="font-medium">${q.options[correctAnswerIndex]}</span></p><div class="mt-3 pt-3 border-t border-gray-200"><p class="font-semibold text-red-800">【淺解】</p><p class="text-gray-600 text-sm mt-1">${q.explanation || '暫無淺解。'}</p></div></div>`;
        }).join('');

        document.getElementById('student-detail-content').innerHTML = attemptsHtml + questionsHtml;
    }, 0);
}

export async function handleStudentAiAnalysis(studentId) {
    // Explicitly fetch all submissions for this student to ensure we have the complete history
    // and not just what's loaded in the local cache (which might be paginated or incomplete).
    let studentSubmissions = [];
    try {
        const q = query(collection(db, "submissions"), where("studentId", "==", studentId));
        const snapshot = await getDocs(q);
        studentSubmissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching student submissions for AI analysis:", error);
        renderModal('message', { type: 'error', title: '錯誤', message: '無法讀取完整作答記錄。' });
        return;
    }

    if (studentSubmissions.length < 1) { renderModal('message', { type: 'info', title: '提示', message: '該學子至少需要一筆課業記錄才能進行分析。' }); return; }
    showLoading('AI 書僮正在分析學習數據...');
    const avgScore = studentSubmissions.reduce((sum, s) => sum + s.score, 0) / studentSubmissions.length;

    // 為了準確計算完成率，需要讀取所有作業，而不是依賴可能不完整的 appState
    const allAssignmentsSnapshot = await getDocs(collection(db, "assignments"));
    const allAssignments = allAssignmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const now = new Date();
    const dueAssignments = allAssignments.filter(a => a.deadline && a.deadline.toDate() < now);
    const completedDueAssignmentIds = new Set(studentSubmissions.filter(s => dueAssignments.some(a => a.id === s.assignmentId)).map(s => s.assignmentId));
    const completionRate = dueAssignments.length > 0 ? (completedDueAssignmentIds.size / dueAssignments.length) * 100 : 100; // If no assignments are due, completion is 100%

    const pisaStats = { level1: { total: 0, correct: 0 }, level2: { total: 0, correct: 0 }, level3: { total: 0, correct: 0 } };
    studentSubmissions.forEach(sub => {
        const assignment = allAssignments.find(a => a.id === sub.assignmentId);
        if (assignment) {
            assignment.questions.forEach((q, index) => {
                const isCorrect = sub.answers[index] === q.correctAnswerIndex;
                if (index === 0) { pisaStats.level1.total++; if (isCorrect) pisaStats.level1.correct++; }
                else if (index === 1 || index === 2) { pisaStats.level2.total++; if (isCorrect) pisaStats.level2.correct++; }
                else if (index === 3 || index === 4) { pisaStats.level3.total++; if (isCorrect) pisaStats.level3.correct++; }
            });
        }
    });
    const pisa1_accuracy = pisaStats.level1.total > 0 ? (pisaStats.level1.correct / pisaStats.level1.total) * 100 : -1;
    const pisa2_accuracy = pisaStats.level2.total > 0 ? (pisaStats.level2.correct / pisaStats.level2.total) * 100 : -1;
    const pisa3_accuracy = pisaStats.level3.total > 0 ? (pisaStats.level3.correct / pisaStats.level3.total) * 100 : -1;
    const prompt = `身為一位循循善誘的書院夫子，請根據學子的閱讀試煉數據，提供一份**簡潔、易懂、具體**的個人策勵。
請注意：
1.  **全文不超過 250 字**。
2.  語氣要親切、鼓勵，適合學子閱讀。
3.  直接點出可以精進的部分，並提供一個具體的練習方向。
4.  請用 Markdown 格式化你的回覆，可以使用粗體字來強調重點。
### 學子課業數據
- **平均得分**：${avgScore.toFixed(1)}分
- **課業完成率**：${completionRate.toFixed(0)}%
- **PISA 層次答對率**：
  - **擷取與檢索**：${pisa1_accuracy === -1 ? '無數據' : pisa1_accuracy.toFixed(0) + '%'}
  - **統整與解釋**：${pisa2_accuracy === -1 ? '無數據' : pisa2_accuracy.toFixed(0) + '%'}
  - **省思與評鑑**：${pisa3_accuracy === -1 ? '無數據' : pisa3_accuracy.toFixed(0) + '%'}
`;
    try {
        if (!appState.geminiApiKey) throw new Error("AI API 金鑰未設定。");
        const apiKey = appState.geminiApiKey;
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`API 請求失敗`);
        const result = await response.json();
        if (result.candidates?.length > 0) {
            const analysisText = result.candidates[0].content.parts[0].text;
            renderModal('aiStudentSuggestion', { suggestionText: analysisText });
        } else { throw new Error("API 未返回有效分析。"); }
    } catch (error) { console.error("AI 學生分析失敗:", error); renderModal('message', { type: 'error', title: '分析失敗', message: 'AI 分析失敗，請稍後再試。' }); }
    finally { hideLoading(); }
}




export async function handleRegenerateQuestions(assignmentId, questionIndex = null) {
    const articleText = document.getElementById('edit-article').value;
    if (!articleText) { renderModal('message', { type: 'error', title: '操作錯誤', message: '文章內容不可為空。' }); return; }
    const isSingle = questionIndex !== null;
    showLoading(isSingle ? `正在重新生成第 ${parseInt(questionIndex) + 1} 題...` : '正在重新生成所有試題...');
    const pisaLevels = ["擷取與檢索", "統整與解釋", "統整與解釋", "省思與評鑑", "省思與評鑑"];
    const prompt = `你是一位學養深厚的書院夫子，請根據以下文稿，為門下學子重新設計一份高品質的素養導向閱讀試煉。\n文稿："""${articleText}"""\n請遵循以下專業要求：\n1.  **試題設計**：${isSingle ? `請只設計 1 道單選題，且試題必須符合 PISA 閱讀素養的「${pisaLevels[questionIndex]}」層次。` : `請設計 5 道單選題，並依序符合 PISA 閱讀素養的三個層次：第1題(擷取與檢索)、第2-3題(統整與解釋)、第4-5題(省思與評鑑)。`}\n2. **產出格式**：每題都需要包含題幹（questionText）、4 個選項（options）、正確答案索引值（correctAnswerIndex, 0-3）、以及**詳盡的淺解**（explanation）。請嚴格按照指定的 JSON 格式輸出，你的回覆必須是一個 JSON 物件，其 key 為 "${isSingle ? 'question' : 'questions'}"。`;
    const singleQuestionSchema = { type: "OBJECT", properties: { questionText: { type: "STRING" }, options: { type: "ARRAY", items: { type: "STRING" } }, correctAnswerIndex: { type: "NUMBER" }, explanation: { type: "STRING" } }, required: ["questionText", "options", "correctAnswerIndex", "explanation"] };
    const multipleQuestionsSchema = { type: "ARRAY", items: singleQuestionSchema };
    const finalSchema = { type: "OBJECT", properties: { [isSingle ? "question" : "questions"]: isSingle ? singleQuestionSchema : multipleQuestionsSchema }, required: [isSingle ? "question" : "questions"] };
    try {
        if (!appState.geminiApiKey) throw new Error("AI API 金鑰未設定。");
        const apiKey = appState.geminiApiKey;
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", responseSchema: finalSchema } };
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`API 請求失敗: ${response.statusText}`);
        const result = await response.json();
        if (result.candidates?.length > 0) {
            const content = JSON.parse(result.candidates[0].content.parts[0].text);
            if (isSingle) {
                const newQuestion = content.question;
                const qDiv = document.querySelector(`#edit-questions-container > div[data-question-index="${questionIndex}"]`);
                if (qDiv) {
                    qDiv.querySelector('.edit-question-text').value = newQuestion.questionText;
                    const optionInputs = qDiv.querySelectorAll('.edit-option');
                    newQuestion.options.forEach((opt, i) => optionInputs[i].value = opt);
                    qDiv.querySelector(`input[name="edit-correct-${questionIndex}"][value="${newQuestion.correctAnswerIndex}"]`).checked = true;
                    qDiv.querySelector('.edit-explanation').value = newQuestion.explanation;
                }
            } else {
                const newQuestions = content.questions;
                const container = document.getElementById('edit-questions-container');
                if (container) {
                    container.innerHTML = newQuestions.map((q, index) => `<div class="p-4 bg-white rounded-lg border" data-question-index="${index}"><div class="flex justify-between items-center mb-2"><label class="font-semibold">第 ${index + 1} 題</label><button data-question-index="${index}" class="regenerate-question-btn btn-secondary py-1 px-3 text-xs">重新出題</button></div><textarea class="edit-question-text w-full input-styled mt-1" rows="2">${escapeHtml(q.questionText)}</textarea><div class="mt-2 space-y-2">${q.options.map((opt, optIndex) => `<div class="flex items-center gap-2"><input type="radio" name="edit-correct-${index}" value="${optIndex}" ${q.correctAnswerIndex === optIndex ? 'checked' : ''}><input type="text" class="edit-option w-full input-styled" value="${escapeHtml(opt)}"></div>`).join('')}</div><label class="font-semibold mt-2 block">詳解</label><textarea class="edit-explanation w-full input-styled mt-1" rows="2">${escapeHtml(q.explanation)}</textarea></div>`).join('');
                    // Event delegation handles .regenerate-question-btn clicks via attachModalEventListeners
                }
            }
        } else { throw new Error("API 未返回有效內容。"); }
    } catch (error) { console.error("重新生成試題失敗:", error); renderModal('message', { type: 'error', title: '生成失敗', message: '操作失敗，請稍後再試。' }); }
    finally { hideLoading(); }
}

export async function handleFormatText() {
    const button = document.getElementById('format-text-btn');
    const textarea = document.getElementById('pasted-article-textarea');
    if (!button || !textarea) return;

    const rawText = textarea.value;
    if (!rawText.trim()) {
        renderModal('message', { title: '提示', message: '請先在文本框中輸入內容。' });
        return;
    }

    const originalButtonText = button.textContent;
    button.disabled = true;
    button.innerHTML = '<div class="loader-sm"></div> 整理中';

    try {
        if (!appState.geminiApiKey) throw new Error("AI API 金鑰未設定。");

        const prompt = `你是一位專業且細心的中文文本編輯。你的唯一任務是根據以下規則，清理並優化使用者提供的文本，不做任何內容上的增刪或修改。

# 編輯規則 (必須嚴格遵守):
1.  **段落排版**: 在每一個自然段落的開頭，加上兩個全形空格 "　　" 作為縮排。段落之間空一行。
2.  **標點符號標準化**: 將文本中所有的半形標點符號轉換為對應的全形版本。對照表如下：
    *   \`,\` (逗號) -> \`，\`
    *   \`.\` (句號) -> \`。\`
    *   \`? \` (問號) -> \`？\`
    *   \`!\` (驚嘆號) -> \`！\`
    *   \`:\` (冒號) -> \`：\`
    *   \`;\` (分號) -> \`；\`
    *   \`"\` (引號) -> \`「」\` (請使用標準中文引號)
    *   \`'\` (單引號) -> \`『』\` (請用作書名號或在引號內的引號)
3.  **移除亂碼**: 辨識並徹底移除文本中可能因複製貼上而產生的、無意義的亂碼、數字標示或非預期字元 (例如 Mojibake、控制字元等)。
4.  **保留換行**: 完全保留原文的換行結構。如果原文有多個空行，也請保留。

# 輸出要求:
*   **絕對不要**回覆任何除了整理後文本以外的內容。
*   **不要**有任何開頭的問候語或結尾的說明。
*   你的回覆**必須**是純文字 (plain text)。

# 需要整理的文本如下：
"""
${rawText}
"""`;

        const apiKey = appState.geminiApiKey;
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

        if (!response.ok) {
            throw new Error(`API 請求失敗 (${response.status})`);
        }

        const result = await response.json();
        if (result.candidates && result.candidates.length > 0) {
            const formattedText = result.candidates[0].content.parts[0].text;
            textarea.value = formattedText;
        } else {
            throw new Error("API 未返回有效內容。");
        }

    } catch (error) {
        console.error("文本整理失敗:", error);
        renderModal('message', { type: 'error', title: '整理失敗', message: '操作失敗，請檢查主控台錯誤訊息。' });
    } finally {
        button.disabled = false;
        button.textContent = originalButtonText;
    }
}

export function handleEditClassName(classId) {
    if (!classId) return;
    const selectedClass = appState.allClasses.find(c => c.id === classId);
    if (!selectedClass) return;
    renderModal('editClassName', { classId, className: selectedClass.className });
}

export async function handleConfirmEditClassName(classId) {
    const newClassName = document.getElementById('edit-class-name-input').value.trim();
    const errorEl = document.getElementById('edit-class-name-error');
    const originalClass = appState.allClasses.find(c => c.id === classId);
    if (!newClassName) { errorEl.textContent = '名號不可為空。'; return; }
    if (newClassName === originalClass.className) { closeModal(); return; }
    showLoading('正在更新名稱...');
    try {
        await updateDoc(doc(db, "classes", classId), { className: newClassName });
        hideLoading();
        renderModal('message', { type: 'success', title: '更新成功', message: '學堂名號已更新！' });
    } catch (e) { hideLoading(); console.error("更新名稱失敗:", e); errorEl.textContent = '更新失敗。'; }
}

export async function handleResetPassword(classId, studentId) {
    const studentDocRef = doc(db, `classes/${classId}/students`, studentId);
    const studentDoc = await getDoc(studentDocRef);
    if (!studentDoc.exists()) { renderModal('message', { type: 'error', title: '錯誤', message: '找不到學生資料。' }); return; }

    const student = studentDoc.data();
    const selectedClass = appState.allClasses.find(c => c.id === classId);

    renderModal('confirm', {
        title: '確認重設密語',
        message: `您確定要將學子「${student.name}」的密語重設為預設值嗎？`,
        onConfirm: async () => {
            showLoading('正在重設密語...');
            try {
                const defaultPassword = generateDefaultPassword(selectedClass.className, student.seatNumber);
                const newPasswordHash = await hashString(defaultPassword);
                await updateDoc(studentDocRef, { passwordHash: newPasswordHash });
                hideLoading();
                renderModal('message', { type: 'success', title: '重設成功', message: `學子「${student.name}」的密語已重設。` });
            } catch (e) {
                hideLoading();
                console.error("重設密碼失敗:", e);
                renderModal('message', { type: 'error', title: '重設失敗', message: '操作失敗，請稍後再試。' });
            }
        }
    });
}

export function setupTeacherEventListeners() {
    if (appState.isEventListenersInitialized) return;

    const mainAppView = dom.mainAppView;

    // Centralized click handler using event delegation
    mainAppView.addEventListener('click', (e) => {
        const target = e.target;
        const closest = (selector) => target.closest(selector);

        // --- Teacher View Tab Switching ---
        const teacherTabBtn = closest('.teacher-tab-btn');
        if (teacherTabBtn) {
            const tabName = teacherTabBtn.dataset.tab;
            switchTeacherTab(tabName);
            return;
        }

        // --- Global Class Selector Actions ---
        switch (target.id) {
            case 'teacher-analysis-btn':
                displayStudentAnalysis('teacher_user');
                return;
            case 'save-api-key-btn':
                handleSaveApiKey();
                return;
            case 'format-text-btn':
                handleFormatText();
                return;
            case 'add-class-btn':
                renderModal('prompt', {
                    title: '新設學堂',
                    message: '請為新學堂命名：',
                    onConfirm: async (className) => {
                        if (!className) {
                            const errorEl = document.getElementById('prompt-error');
                            if (errorEl) errorEl.textContent = '名號不可為空！';
                            return;
                        }
                        closeModal();
                        showLoading('正在建立學堂...');
                        try {
                            await addDoc(collection(db, "classes"), { className }); // Roster is no longer stored in the class document
                            hideLoading();
                            renderModal('message', { type: 'success', title: '新設成功', message: `學堂「${className}」已成功開設！` });
                        } catch (e) {
                            hideLoading();
                            console.error("新增班級失敗:", e);
                            renderModal('message', { type: 'error', title: '新設失敗', message: '操作失敗，請稍後再試。' });
                        }
                    }
                });
                return; // Use return to avoid falling through
            case 'edit-class-name-btn':
                if (target.dataset.classId) handleEditClassName(target.dataset.classId);
                return;
            case 'delete-class-btn':
                if (target.dataset.classId) handleDeleteClass(target.dataset.classId);
                return;
        }

        // --- Achievement Panel Actions ---
        if (closest('#tab-panel-achievement-management')) {
            const addBtn = closest('#add-achievement-btn');
            if (addBtn) {
                renderModal('achievementForm', {});
                return;
            }

            const editBtn = closest('.edit-achievement-btn');
            if (editBtn) {
                const achievementId = editBtn.dataset.id;
                handleEditAchievement(achievementId);
                return;
            }

            const deleteBtn = closest('.delete-achievement-btn');
            if (deleteBtn) {
                const achievementId = deleteBtn.dataset.id;
                handleDeleteAchievement(achievementId);
                return;
            }
        }

        // --- Class Roster Panel Actions (Specific to the panel) ---
        if (closest('#tab-panel-class-overview')) {
            const nameLink = closest('.student-name-link');
            if (nameLink) {
                const studentId = nameLink.dataset.studentId;
                // The classId is now on the panel container
                const classId = closest('#class-management-content')?.dataset.classId;
                if (studentId && classId) {
                    displayStudentAnalysis(studentId, classId);
                } else {
                    console.error('Could not determine studentId or classId for analysis.');
                }
                return;
            }

            const rosterButton = closest('button');
            if (rosterButton) {
                const { classId, studentId } = rosterButton.dataset;
                if (rosterButton.classList.contains('edit-student-btn')) { if (classId && studentId) handleEditStudent(classId, studentId); }
                else if (rosterButton.classList.contains('delete-student-btn')) { if (classId && studentId) handleDeleteStudent(classId, studentId); }
                else if (rosterButton.classList.contains('reset-password-btn')) { if (classId && studentId) handleResetPassword(classId, studentId); }
                else if (rosterButton.id === 'add-student-btn') { if (classId) handleAddStudent(classId); }
                else if (rosterButton.id === 'bulk-import-btn') { if (classId) handleBulkImport(classId); }
                else if (rosterButton.id === 'generate-overdue-report-btn') { if (classId) renderOverdueReport(classId); }
            }
        }

        // --- Article Library Actions ---
        const editBtn = closest('.edit-article-btn');
        if (editBtn) {
            handleEditArticle(e);
            return;
        }

        const deleteBtn = closest('.delete-article-btn');
        if (deleteBtn) {
            handleDeleteArticle(e);
            return;
        }

        const titleLink = closest('.article-title-link');
        if (titleLink) {
            e.preventDefault();
            const articleId = titleLink.dataset.assignmentId;
            // This logic was confirmed to be for the teacher view.
            // The student view logic is handled by the 'start-quiz-btn'.
            renderArticleAnalysisModal(articleId);
            return;
        }

        // Other buttons by ID
        switch (target.id) {
            case 'bulk-delete-btn':
                handleBulkDelete();
                break;
            case 'bulk-set-public-btn':
                bulkUpdatePublicStatus(true);
                break;
            case 'bulk-set-private-btn':
                bulkUpdatePublicStatus(false);
                break;
            case 'generate-btn':
                generateAssignment();
                break;
            case 'generate-questions-btn':
                handleGenerateQuestionsFromPasted();
                break;
            case 'ai-analysis-btn': // The one in the teacher panel
                const articleId = document.getElementById('analysis-panel')?.dataset.articleId;
                if (articleId) handleAiAnalysis(articleId);
                else renderModal('message', { type: 'info', title: '提示', message: '請先選擇一篇文章' });
                break;
            case 'tab-create-article':
                document.getElementById('tab-create-article').classList.add('active');
                document.getElementById('tab-analyze-article').classList.remove('active');
                document.getElementById('panel-create-article').classList.remove('hidden');
                document.getElementById('panel-analyze-article').classList.add('hidden');
                break;
            case 'tab-analyze-article':
                document.getElementById('tab-analyze-article').classList.add('active');
                document.getElementById('tab-create-article').classList.remove('active');
                document.getElementById('panel-analyze-article').classList.remove('hidden');
                document.getElementById('panel-create-article').classList.add('hidden');
                break;
            case 'tab-ai-generate':
                document.getElementById('tab-ai-generate').classList.add('active');
                document.getElementById('tab-paste-text').classList.remove('active');
                document.getElementById('panel-ai-generate').classList.remove('hidden');
                document.getElementById('panel-paste-text').classList.add('hidden');
                break;
            case 'tab-paste-text':
                document.getElementById('tab-paste-text').classList.add('active');
                document.getElementById('tab-ai-generate').classList.remove('active');
                document.getElementById('panel-paste-text').classList.remove('hidden');
                document.getElementById('panel-ai-generate').classList.add('hidden');
                break;
        }
    });

    // Centralized input handler
    mainAppView.addEventListener('input', (e) => {
        if (e.target.id === 'article-search-input') {
            applyArticleFilters();
        }
    });

    // Centralized change handler
    mainAppView.addEventListener('change', (e) => {
        const target = e.target;
        const targetId = target.id;

        if (targetId === 'class-selector') {
            const newClassId = target.value;
            const activeTab = document.querySelector('.teacher-tab-btn.active')?.dataset.tab;
            if (activeTab === 'class-overview') {
                renderClassManagement(newClassId);
            } else if (activeTab === 'article-library') {
                updateArticleLibraryPanel(newClassId);
            }
        } else if (targetId === 'select-all-articles' || target.classList.contains('article-checkbox')) {
            if (targetId === 'select-all-articles') {
                document.querySelectorAll('.article-checkbox').forEach(checkbox => {
                    checkbox.checked = target.checked;
                });
            } else {
                const selectAllCheckbox = document.getElementById('select-all-articles');
                if (!target.checked) {
                    if (selectAllCheckbox) selectAllCheckbox.checked = false;
                } else {
                    const allChecked = Array.from(document.querySelectorAll('.article-checkbox')).every(cb => cb.checked);
                    if (selectAllCheckbox) selectAllCheckbox.checked = allChecked;
                }
            }
            updateBulkActionsVisibility();
        } else if (['filter-tag-format', 'filter-tag-contentType', 'filter-tag-difficulty', 'filter-deadline-status'].includes(targetId)) {
            const filterKey = targetId.replace('filter-tag-', '').replace('filter-', '');
            appState.teacherArticleQueryState.filters[filterKey] = e.target.value;
            fetchTeacherAssignmentsPage(true);
        }
    });

    appState.isEventListenersInitialized = true;
}

export function switchTeacherTab(tabName, classId = null, articleId = null) {
    const panels = ['class-overview', 'article-library', 'achievement-management', 'system-settings'];

    panels.forEach(panel => {
        const panelEl = document.getElementById(`tab-panel-${panel}`);
        const tabEl = document.querySelector(`.teacher-tab-btn[data-tab="${panel}"]`);
        if (panelEl) panelEl.classList.add('hidden');
        if (tabEl) tabEl.classList.remove('active');
    });

    const activePanel = document.getElementById(`tab-panel-${tabName}`);
    const activeTab = document.querySelector(`.teacher-tab-btn[data-tab="${tabName}"]`);

    if (activePanel) activePanel.classList.remove('hidden');
    if (activeTab) activeTab.classList.add('active');

    switch (tabName) {
        case 'class-overview':
            const selectedClassId = classId || document.getElementById('class-selector')?.value;
            renderClassManagement(selectedClassId);
            break;
        case 'article-library':
            updateArticleLibraryPanel(classId, articleId);
            break;
        case 'achievement-management':
            renderAchievementManagement();
            break;
        case 'system-settings':
            renderSystemSettings();
            break;
    }
}

export function updateBulkActionsVisibility() {
    const anyChecked = document.querySelectorAll('.article-checkbox:checked').length > 0;
    const bulkActionsContainer = document.getElementById('bulk-actions-container');
    if (bulkActionsContainer) {
        bulkActionsContainer.classList.toggle('hidden', !anyChecked);
    }
}

export async function renderAchievementManagement() {
    const panel = document.getElementById('achievement-management-content');
    if (!panel) return;

    panel.innerHTML = ''; // Clear previous content
    const container = el('div', { class: 'p-1' }); // Adjusted padding
    panel.appendChild(container);

    const header = el('div', { class: 'flex justify-between items-center mb-6' }, [
        el('h2', { class: 'text-2xl font-bold text-gray-800 font-rounded', textContent: '成就管理' }),
        el('button', { id: 'add-achievement-btn', class: 'btn-primary py-2 px-4', textContent: '新增成就' })
    ]);
    container.appendChild(header);

    const listContainer = el('div', { id: 'achievement-list-container', class: 'space-y-4' });
    container.appendChild(listContainer);

    listContainer.innerHTML = '<p>正在讀取成就設定...</p>';

    try {
        const achievementsQuery = query(collection(db, "achievements"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(achievementsQuery);

        listContainer.innerHTML = ''; // Clear loading message

        if (querySnapshot.empty) {
            listContainer.appendChild(el('p', { class: 'text-gray-500' }, ['尚未建立任何成就。點擊「新增成就」來建立第一個。']));
            return;
        }

        querySnapshot.forEach(doc => {
            const ach = { id: doc.id, ...doc.data() };
            const card = el('div', { class: 'card flex items-center justify-between p-4' }, [
                el('div', { class: 'flex items-center gap-4 flex-grow' }, [
                    el('div', { class: 'text-3xl w-12 text-center', innerHTML: ach.icon || '🏆' }),
                    el('div', { class: 'flex-grow' }, [
                        el('h3', { class: 'font-bold text-lg flex items-center flex-wrap' }, [
                            el('span', { textContent: ach.name }),
                            el('span', { class: `ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${ach.isEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`, textContent: ach.isEnabled ? '啟用中' : '已停用' }),
                            ach.isHidden ? el('span', { class: 'ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800', textContent: '隱藏' }) : null
                        ]),
                        el('p', { class: 'text-sm text-gray-600', textContent: ach.description }),
                        el('div', { class: 'text-xs text-gray-500 mt-1 flex flex-wrap gap-1' },
                            (ach.conditions && ach.conditions.length > 0)
                                ? ach.conditions.map(c => el('code', { class: 'bg-gray-100 px-1 rounded' }, [`${getConditionTypeName(c.type)}${c.value !== undefined ? ': ' + c.value : ''}`]))
                                : [
                                    el('code', { class: 'bg-gray-100 px-1 rounded', textContent: `類型: ${ach.type || 'N/A'}` }),
                                    el('code', { class: 'bg-gray-100 px-1 rounded', textContent: `條件值: ${ach.value || 'N/A'}` })
                                ]
                        )
                    ])
                ]),
                el('div', { class: 'flex gap-2 flex-shrink-0 ml-4' }, [
                    el('button', { 'data-id': ach.id, class: 'edit-achievement-btn btn-secondary py-2 px-4 text-sm', textContent: '編輯' }),
                    el('button', { 'data-id': ach.id, class: 'delete-achievement-btn btn-danger py-2 px-4 text-sm', textContent: '刪除' })
                ])
            ]);
            listContainer.appendChild(card);
        });

    } catch (error) {
        console.error("Error rendering achievement management:", error);
        listContainer.innerHTML = '<p class="text-red-500">讀取成就設定失敗。</p>';
    }
}

export async function handleSaveAchievement(achievementId) {
    const name = document.getElementById('ach-name').value.trim();
    const description = document.getElementById('ach-description').value.trim();
    const icon = document.getElementById('ach-icon').value.trim();
    const isEnabled = document.getElementById('ach-isEnabled').checked;
    const isHidden = document.getElementById('ach-isHidden').checked;
    const isRepeatable = document.getElementById('ach-isRepeatable').checked;
    const errorEl = document.getElementById('ach-form-error');
    errorEl.textContent = '';

    // --- New: Collect conditions from dynamic form ---
    const conditions = [];
    const conditionBlocks = document.querySelectorAll('.condition-block');
    let formIsValid = true;

    const typesWithoutValue = ['weekly_progress'];

    for (let i = 0; i < conditionBlocks.length; i++) {
        const block = conditionBlocks[i];
        const type = block.querySelector('.ach-condition-type').value;
        const value = block.querySelector('.ach-condition-value').value;

        if (!type) {
            errorEl.textContent = `第 ${i + 1} 個條件的類型必須選擇。`;
            formIsValid = false;
            break;
        }

        // If the type does not require a value, we can skip the value checks
        if (typesWithoutValue.includes(type)) {
            conditions.push({ type });
            continue;
        }

        // For all other types, value is required and must be a number
        if (value === '') {
            errorEl.textContent = `第 ${i + 1} 個條件的值必須填寫。`;
            formIsValid = false;
            break;
        }
        const valueAsNumber = parseInt(value, 10);
        if (isNaN(valueAsNumber)) {
            errorEl.textContent = `第 ${i + 1} 個條件的值必須是數字。`;
            formIsValid = false;
            break;
        }
        conditions.push({ type, value: valueAsNumber });
    }

    if (!formIsValid) return;

    if (!name || !description) {
        errorEl.textContent = '請填寫成就名稱和描述。';
        return;
    }
    if (conditions.length === 0) {
        errorEl.textContent = '請至少新增一個成就條件。';
        return;
    }

    showLoading('儲存中...');

    try {
        const achievementData = {
            name,
            description,
            icon,
            conditions, // New conditions array
            isEnabled,
            isHidden,
            isRepeatable
        };

        if (achievementId) {
            // Editing existing: add fields to remove old structure
            const updateData = {
                ...achievementData,
                updatedAt: Timestamp.now(),
                type: deleteField(),
                value: deleteField()
            };
            const docRef = doc(db, 'achievements', achievementId);
            await updateDoc(docRef, updateData);
        } else {
            // Creating new
            const createData = {
                ...achievementData,
                createdAt: Timestamp.now()
            };
            await addDoc(collection(db, 'achievements'), createData);
        }

        hideLoading();
        closeModal();
        renderAchievementManagement(); // Refresh the list
        renderModal('message', { type: 'success', title: '儲存成功', message: `成就「${name}」已成功儲存。` });

    } catch (error) {
        hideLoading();
        console.error("儲存成就失敗:", error);
        errorEl.textContent = '儲存失敗，請稍後再試。';
    }
}

export async function handleEditAchievement(achievementId) {
    if (!achievementId) return;
    showLoading('正在讀取成就資料...');
    try {
        const docRef = doc(db, `achievements`, achievementId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const achievementData = { id: docSnap.id, ...docSnap.data() };
            hideLoading();
            renderModal('achievementForm', { achievement: achievementData });
        } else {
            hideLoading();
            renderModal('message', { type: 'error', title: '錯誤', message: '找不到指定的成就資料。' });
        }
    } catch (error) {
        hideLoading();
        console.error("讀取成就失敗:", error);
        renderModal('message', { type: 'error', title: '讀取失敗', message: '無法讀取成就資料，請稍後再試。' });
    }
}

export async function handleDeleteAchievement(achievementId) {
    if (!achievementId) return;

    try {
        const docRef = doc(db, `achievements`, achievementId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const achievementName = docSnap.data().name || '該成就';
            renderModal('confirm', {
                title: '確認刪除成就',
                message: `您確定要永久刪除「${escapeHtml(achievementName)}」嗎？此操作無法復原。`,
                onConfirm: () => confirmDeleteAchievement(achievementId)
            });
        } else {
            renderModal('message', { type: 'error', title: '錯誤', message: '找不到指定的成就資料。' });
        }
    } catch (error) {
        console.error("讀取成就名稱失敗:", error);
        renderModal('message', { type: 'error', title: '操作失敗', message: '無法讀取成就資料，請稍後再試。' });
    }
}

export async function confirmDeleteAchievement(achievementId) {
    closeModal(); // Close the confirmation modal
    showLoading('正在刪除成就...');
    try {
        const docRef = doc(db, `achievements`, achievementId);
        await deleteDoc(docRef);
        hideLoading();
        renderModal('message', { type: 'success', title: '刪除成功', message: '成就已成功刪除。' });
        renderAchievementManagement(); // Refresh the list
    } catch (error) {
        hideLoading();
        console.error("刪除成就失敗:", error);
        renderModal('message', { type: 'error', title: '刪除失敗', message: '操作失敗，請稍後再試。' });
    }
}







export async function renderSystemSettings() {
    const container = document.getElementById('teacher-main-content');
    let panel = document.getElementById('tab-panel-system-settings');

    if (!panel) {
        panel = el('div', { id: 'tab-panel-system-settings' });
        container.appendChild(panel);
    }

    // Fetch the current settings to display
    const settingsDoc = await getDoc(doc(db, "settings", "api_keys"));
    const currentSettings = settingsDoc.exists() ? settingsDoc.data() : {};
    const currentApiKey = currentSettings.gemini || "";
    const currentModel = currentSettings.model || DEFAULT_GEMINI_MODEL;
    const currentTeacherModel = currentSettings.teacherModel || currentModel;

    const settingsHtml = el('div', { class: 'card max-w-2xl mx-auto' }, [
        el('h2', { class: 'text-2xl font-bold mb-6 text-gray-800 font-rounded', textContent: '系統設定' }),
        el('div', { class: 'space-y-6' }, [
            el('div', {}, [
                el('label', { for: 'gemini-api-key-input', class: 'font-bold text-sm text-gray-600', textContent: 'Gemini API 金鑰' }),
                el('input', { type: 'text', id: 'gemini-api-key-input', class: 'w-full form-element-ink mt-1', value: currentApiKey, placeholder: '請在此貼上您的 Gemini API 金鑰' }),
                el('p', { class: 'text-xs text-gray-500 mt-2', textContent: '此金鑰將被安全地儲存在您的 Firestore 資料庫中。' })
            ]),
            el('div', {}, [
                el('label', { for: 'gemini-model-input', class: 'font-bold text-sm text-gray-600', textContent: '前台 AI 模型（學生端）' }),
                el('input', { type: 'text', id: 'gemini-model-input', class: 'w-full form-element-ink mt-1', value: currentModel, placeholder: '例如：gemini-2.5-flash' }),
                el('p', { class: 'text-xs text-gray-500 mt-2', textContent: '學生端互動式學習、心智圖對話所使用的模型。' })
            ]),
            el('div', {}, [
                el('label', { for: 'gemini-teacher-model-input', class: 'font-bold text-sm text-gray-600', textContent: '後台 AI 模型（教師端）' }),
                el('input', { type: 'text', id: 'gemini-teacher-model-input', class: 'w-full form-element-ink mt-1', value: currentTeacherModel, placeholder: '例如：gemini-2.5-pro' }),
                el('p', { class: 'text-xs text-gray-500 mt-2', textContent: '教師端文章生成、解析分析、成就發想所使用的模型。' })
            ])
        ]),
        el('p', { id: 'settings-feedback', class: 'text-sm h-4 mt-4' }),
        el('div', { class: 'flex justify-end mt-6' }, [
            el('button', { id: 'save-api-key-btn', class: 'btn-primary py-2 px-6 font-bold', textContent: '儲存設定' })
        ])
    ]);

    panel.innerHTML = '';
    panel.appendChild(settingsHtml);
}

export async function handleSaveApiKey() {
    const keyInput = document.getElementById('gemini-api-key-input');
    const modelInput = document.getElementById('gemini-model-input');
    const teacherModelInput = document.getElementById('gemini-teacher-model-input');
    const feedbackEl = document.getElementById('settings-feedback');

    const newApiKey = keyInput.value.trim();
    const newModel = modelInput.value.trim();
    const newTeacherModel = teacherModelInput.value.trim();

    if (!newApiKey || !newModel || !newTeacherModel) {
        feedbackEl.textContent = '金鑰和模型名稱皆不可為空。';
        feedbackEl.className = 'text-red-500 text-sm h-4 mt-4';
        return;
    }

    showLoading('儲存中...');
    try {
        const docRef = doc(db, "settings", "api_keys");
        await setDoc(docRef, { gemini: newApiKey, model: newModel, teacherModel: newTeacherModel }, { merge: true });

        // Update the state immediately
        appState.geminiApiKey = newApiKey;
        appState.geminiModel = newModel;
        appState.teacherGeminiModel = newTeacherModel;

        feedbackEl.textContent = '設定已成功儲存！';
        feedbackEl.className = 'text-green-600 text-sm h-4 mt-4';

    } catch (error) {
        console.error("Error saving API key:", error);
        feedbackEl.textContent = `儲存失敗: ${error.message}`;
        feedbackEl.className = 'text-red-500 text-sm h-4 mt-4';
    } finally {
        hideLoading();
    }
}


// Expose to window for UI event handlers
window.renderTeacherUI = renderTeacherUI;
window.renderClassManagement = renderClassManagement;
window.updateArticleLibraryPanel = updateArticleLibraryPanel;
window.updateTeacherLoadMoreButton = updateTeacherLoadMoreButton;
window.renderTeacherArticleTable = renderTeacherArticleTable;
window.createFullArticleTableRow = createFullArticleTableRow;
window.updateRosterDisplay = updateRosterDisplay;
window.renderOverdueReport = renderOverdueReport;
window.handleTeacherLogin = handleTeacherLogin;
window.handleDeleteClass = handleDeleteClass;
window.confirmDeleteClass = confirmDeleteClass;
window.handleAddStudent = handleAddStudent;
window.handleBulkImport = handleBulkImport;
window.handleEditStudent = handleEditStudent;
window.handleSaveStudentEdit = handleSaveStudentEdit;
window.handleDeleteStudent = handleDeleteStudent;
window.confirmDeleteStudent = confirmDeleteStudent;
window.handleEditArticle = handleEditArticle;
window.bulkUpdatePublicStatus = bulkUpdatePublicStatus;
window.handleDeleteArticle = handleDeleteArticle;
window.handleBulkDelete = handleBulkDelete;
window.getRandomOption = getRandomOption;
window.getDifficultyInstructions = getDifficultyInstructions;
window.generateAssignment = generateAssignment;
window.callGeminiAPI = callGeminiAPI;
window.handleGenerateQuestionsFromPasted = handleGenerateQuestionsFromPasted;
window.handleAiAnalysis = handleAiAnalysis;
window.fetchTeacherAssignmentsPage = fetchTeacherAssignmentsPage;
window.updateAssignedArticlesList = updateAssignedArticlesList;
window.renderArticleAnalysisModal = renderArticleAnalysisModal;
window.openEditModal = openEditModal;
window.handleSaveEdit = handleSaveEdit;
window.handleAnalysisAI = handleAnalysisAI;
window.displaySubmissionReview = displaySubmissionReview;
window.handleStudentAiAnalysis = handleStudentAiAnalysis;
window.handleAiRewrite = handleAiRewrite;
window.handleRegenerateQuestions = handleRegenerateQuestions;
window.handleFormatText = handleFormatText;
window.handleEditClassName = handleEditClassName;
window.handleConfirmEditClassName = handleConfirmEditClassName;
window.handleResetPassword = handleResetPassword;
window.setupTeacherEventListeners = setupTeacherEventListeners;
window.switchTeacherTab = switchTeacherTab;
window.updateBulkActionsVisibility = updateBulkActionsVisibility;
window.renderAchievementManagement = renderAchievementManagement;
window.handleSaveAchievement = handleSaveAchievement;
window.handleEditAchievement = handleEditAchievement;
window.handleDeleteAchievement = handleDeleteAchievement;
window.confirmDeleteAchievement = confirmDeleteAchievement;
window.handleAiGenerateAchievement = handleAiGenerateAchievement;
window.callAchievementAI = callAchievementAI;
window.renderSystemSettings = renderSystemSettings;
window.handleSaveApiKey = handleSaveApiKey;