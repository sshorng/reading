import { appState, dom, TEACHER_PASSWORD_HASH } from './state.js';
import { el, escapeHtml, normalizeClassName, markdownToHtml } from './utils.js';

export function closeModal() {
    const lastModal = dom.modalContainer.lastElementChild;
    if (lastModal) {
        // P2-2: 透過 AbortController 自動移除事件監聽器，防止記憶體洩漏
        if (lastModal._abortController) {
            lastModal._abortController.abort();
        }
        lastModal.remove();
    }
}

export const modalHtmlGenerators = {
    _base: (content, zIndex = 50) => `<div class="modal-instance fixed inset-0 modal-backdrop flex items-center justify-center z-[${zIndex}] p-4">${content}</div>`,

    password(data) {
        return new Promise(resolve => {
            const content = `<div class="card w-full max-w-sm"><h2 class="text-xl font-bold mb-4 text-center font-rounded">夫子講堂</h2><input type="password" id="password-input" class="w-full form-element-ink mb-4" placeholder="請輸入憑信"><button id="password-submit-btn" class="w-full btn-primary py-2 font-bold">進入</button><p id="password-error" class="text-red-500 text-sm mt-2 text-center h-4"></p><button id="close-password-modal-btn" class="w-full mt-2 text-gray-500 hover:text-gray-700">返回</button></div>`;
            resolve(this._base(content));
        });
    },

    result(data) {
        return new Promise(resolve => {
            const isPassed = data.score >= 60;
            const scoreFeedback = isPassed
                ? (data.score >= 90 ? "評價：甲上！" : data.score >= 70 ? "評價：甲！" : "評價：乙。")
                : "尚未達到過關基準 (60分)，請再次挑戰！";
            const scoreColor = data.score >= 90 ? 'text-green-600' : data.score >= 70 ? 'text-amber-600' : 'text-red-600';
            const titleText = isPassed ? "課業完成" : "挑戰未達標";
            const titleColor = isPassed ? "text-amber-600" : "text-red-600";

            const reviewItems = data.assignment.questions.map((q, i) => {
                const isCorrect = data.userAnswers[i] === q.correctAnswerIndex;
                const children = [
                    el('p', { class: 'font-semibold text-gray-800', textContent: `第 ${i + 1} 題: ${q.questionText}` }),
                    el('p', { class: 'mt-2 text-sm' }, [
                        '您的作答: ',
                        el('span', { class: 'font-medium', textContent: data.userAnswers[i] !== null ? q.options[data.userAnswers[i]] : '未作答' })
                    ])
                ];

                if (isPassed) {
                    children.push(
                        el('p', { class: 'mt-1 text-sm' }, [
                            '正解: ',
                            el('span', { class: 'font-medium', textContent: q.options[q.correctAnswerIndex] })
                        ]),
                        el('div', { class: 'mt-3 pt-3 border-t border-gray-200' }, [
                            el('p', { class: 'font-semibold text-red-800', textContent: '【淺解】' }),
                            el('p', { class: 'text-gray-600 text-sm mt-1', textContent: q.explanation || '暫無淺解。' })
                        ])
                    );
                } else {
                    children.push(
                        el('p', { class: 'mt-2 text-sm font-medium ' + (isCorrect ? 'text-green-600' : 'text-red-600') },
                            isCorrect ? '✔️ 答對了！' : '❌ 答錯了，請再想想！'
                        )
                    );
                }

                return el('div', { class: `p-4 rounded-lg mb-3 ${isCorrect ? 'bg-green-50' : 'bg-red-50'}` }, children);
            });

            const content = el('div', { class: 'card max-w-2xl w-full' }, [
                el('h2', { class: `text-2xl font-bold mb-2 text-center ${titleColor} font-rounded`, textContent: titleText }),
                el('p', { class: `text-5xl font-bold my-4 text-center ${scoreColor}`, textContent: data.score }),
                el('p', { class: `font-bold mb-6 text-center ${titleColor}`, textContent: scoreFeedback }),
                el('div', { class: 'text-left mb-6 max-h-[50vh] overflow-y-auto p-4 bg-gray-50 rounded-lg' }, reviewItems),
                el('div', { class: 'flex gap-4 mt-6' }, [
                    el('button', { id: 'close-result-modal', class: 'w-full btn-secondary py-2 font-bold', textContent: '關閉' })
                ])
            ]);

            const base = this._base('', 50); // Create base structure with a placeholder
            const baseElement = document.createElement('div');
            baseElement.innerHTML = base;
            baseElement.querySelector('.modal-backdrop').appendChild(content);
            resolve(baseElement.innerHTML);
        });
    },

    aiAnalysis(data) {
        return new Promise(resolve => {
            const content = `<div class="card max-w-3xl w-full"><h2 class="text-2xl font-bold mb-4 text-teal-700 flex items-center gap-2 font-rounded">AI 書僮點評</h2><div class="prose-custom max-h-[70vh] overflow-y-auto text-left p-4 bg-gray-50 rounded-lg">${markdownToHtml(data.analysisText)}</div><button id="close-ai-analysis-modal" class="mt-6 w-full btn-primary py-2 font-bold">展卷</button></div>`;
            resolve(this._base(content));
        });
    },

    editArticle(data) {
        return new Promise(resolve => {
            const assignment = data.assignment;
            const deadline = assignment.deadline ? assignment.deadline.toDate().toISOString().split('T')[0] : '';
            const tags = assignment.tags || {};

            const createSelect = (id, options, label) => {
                return el('div', {}, [
                    el('label', { class: 'text-sm font-medium text-gray-600', textContent: label }),
                    el('select', { id, class: 'w-full form-element-ink mt-1 text-sm' },
                        options.map(opt => el('option', { value: opt, textContent: `#${opt}` }))
                    )
                ]);
            };

            const questionElementsHtml = assignment.questions.map((q, index) => {
                const optionsHtml = q.options.map((opt, optIndex) => {
                    const isChecked = parseInt(q.correctAnswerIndex, 10) === optIndex;
                    return `<div class="flex items-center gap-2">
                                        <input type="radio" name="edit-correct-${index}" value="${optIndex}" ${isChecked ? 'checked' : ''}>
                                        <input type="text" class="edit-option w-full form-element-ink" value="${escapeHtml(opt)}">
                                    </div>`;
                }).join('');

                return `<div class="p-4 bg-gray-50 rounded-lg border" data-question-index="${index}">
                                    <div class="flex justify-between items-center mb-2">
                                        <label class="font-semibold">第 ${index + 1} 題</label>
                                        <button data-question-index="${index}" class="regenerate-question-btn btn-secondary py-1 px-3 text-xs">重新出題</button>
                                    </div>
                                    <textarea class="edit-question-text w-full form-element-ink mt-1" rows="2">${escapeHtml(q.questionText)}</textarea>
                                    <div class="mt-2 space-y-2">${optionsHtml}</div>
                                    <label class="font-semibold mt-2 block">淺解</label>
                                    <textarea class="edit-explanation w-full form-element-ink mt-1" rows="2">${escapeHtml(q.explanation)}</textarea>
                                </div>`;
            }).join('');

            const modalContent = el('div', { class: 'card max-w-4xl w-full' }, [
                el('h2', { class: 'text-2xl font-bold mb-4 text-gray-800 font-rounded', textContent: '潤飾篇章' }),
                el('div', { class: 'max-h-[80vh] overflow-y-auto custom-scrollbar pr-4' }, [
                    el('div', { class: 'space-y-4' }, [
                        el('div', { class: 'flex justify-between items-center' }, [
                            el('h3', { class: 'font-bold', textContent: '篇章內容' }),
                            el('button', { id: 'edit-ai-assistant-btn', class: 'btn-teal py-2 px-4 text-sm', textContent: 'AI 書僮' })
                        ]),
                        el('div', {}, [
                            el('label', { class: 'font-bold', textContent: '標題' }),
                            el('input', { type: 'text', id: 'edit-title', class: 'w-full form-element-ink mt-1', value: assignment.title })
                        ]),
                        el('div', {}, [
                            el('label', { class: 'font-bold', textContent: '期限' }),
                            el('input', { type: 'date', id: 'edit-deadline', class: 'w-full form-element-ink mt-1', value: deadline })
                        ]),
                        el('div', { class: 'form-check items-center flex gap-2 my-3' }, [
                            el('input', {
                                class: 'form-check-input w-5 h-5',
                                type: 'checkbox',
                                id: 'edit-is-public',
                                // checked: !!assignment.isPublic,
                                onclick: () => console.log('Checkbox clicked, new state:', document.getElementById('edit-is-public').checked)
                            }),
                            el('label', {
                                class: 'form-check-label font-bold',
                                htmlFor: 'edit-is-public',
                                textContent: '將此篇章設為公開（學生可見）'
                            })
                        ]),
                        el('textarea', { id: 'edit-article', rows: '10', class: 'w-full form-element-ink mt-1', textContent: assignment.article }),

                        // AI Analysis Fields
                        el('div', { class: 'pt-4 border-t mt-4' }, [el('h3', { class: 'font-bold', textContent: 'AI 深度解析 (可選)' })]),
                        el('div', { class: 'space-y-3 mt-2' }, [
                            el('div', {}, [
                                el('div', { class: 'flex justify-between items-center' }, [
                                    el('label', { class: 'font-semibold text-sm', textContent: '心智圖 (Mermaid 語法)' }),
                                    el('div', { class: 'flex gap-2' }, [
                                        el('button', { class: 'edit-analysis-ai-btn btn-secondary py-1 px-2 text-xs', 'data-action': 'refine', 'data-target': 'mindmap', textContent: 'AI 潤飾' }),
                                        el('button', { class: 'edit-analysis-ai-btn btn-secondary py-1 px-2 text-xs', 'data-action': 'regenerate', 'data-target': 'mindmap', textContent: '重新生成' })
                                    ])
                                ]),
                                el('textarea', { id: 'edit-analysis-mindmap', rows: '6', class: 'w-full form-element-ink mt-1 font-mono text-xs', textContent: (assignment.analysis && assignment.analysis.mindmap) || '' })
                            ]),
                            el('div', {}, [
                                el('div', { class: 'flex justify-between items-center' }, [
                                    el('label', { class: 'font-semibold text-sm', textContent: '文章解析' }),
                                    el('div', { class: 'flex gap-2' }, [
                                        el('button', { class: 'edit-analysis-ai-btn btn-secondary py-1 px-2 text-xs', 'data-action': 'refine', 'data-target': 'explanation', textContent: 'AI 潤飾' }),
                                        el('button', { class: 'edit-analysis-ai-btn btn-secondary py-1 px-2 text-xs', 'data-action': 'regenerate', 'data-target': 'explanation', textContent: '重新生成' })
                                    ])
                                ]),
                                el('textarea', { id: 'edit-analysis-explanation', rows: '6', class: 'w-full form-element-ink mt-1', textContent: (assignment.analysis && assignment.analysis.explanation) || '' })
                            ]),
                            el('div', {}, [
                                el('div', { class: 'flex justify-between items-center' }, [
                                    el('label', { class: 'font-semibold text-sm', textContent: '延伸思考 (Markdown 格式)' }),
                                    el('div', { class: 'flex gap-2' }, [
                                        el('button', { class: 'edit-analysis-ai-btn btn-secondary py-1 px-2 text-xs', 'data-action': 'refine', 'data-target': 'thinking_questions', textContent: 'AI 潤飾' }),
                                        el('button', { class: 'edit-analysis-ai-btn btn-secondary py-1 px-2 text-xs', 'data-action': 'regenerate', 'data-target': 'thinking_questions', textContent: '重新生成' })
                                    ])
                                ]),
                                el('textarea', { id: 'edit-analysis-thinking-questions', rows: '4', class: 'w-full form-element-ink mt-1', textContent: (assignment.analysis && assignment.analysis.thinking_questions) || '' })
                            ])
                        ]),

                        el('div', { class: 'pt-4 border-t' }, [el('h3', { class: 'font-bold', textContent: '分類' })]),
                        el('div', { class: 'grid grid-cols-1 md:grid-cols-3 gap-4' }, [
                            createSelect('edit-tag-format', ['純文', '圖表', '圖文'], '形式'),
                            createSelect('edit-tag-contentType', ['記敘', '抒情', '說明', '議論', '應用'], '內容'),
                            createSelect('edit-tag-difficulty', ['簡單', '基礎', '普通', '進階', '困難'], '難度')
                        ]),
                        el('div', { class: 'flex justify-between items-center pt-4 border-t' }, [
                            el('h3', { class: 'font-bold', textContent: '試煉題目' }),
                            el('button', { id: 'regenerate-all-questions-btn', class: 'btn-secondary py-2 px-4 text-sm', textContent: '全部重新命題' })
                        ]),
                        el('div', { id: 'edit-questions-container', class: 'space-y-4' }, (container) => { container.innerHTML = questionElementsHtml; })
                    ])
                ]),
                el('div', { class: 'mt-6 flex flex-col items-end gap-2' }, [
                    el('p', { id: 'edit-article-error', class: 'text-red-500 text-sm h-4' }),
                    el('div', { class: 'flex gap-4' }, [
                        el('button', { id: 'close-edit-modal-btn', class: 'btn-secondary py-2 px-5 font-bold', textContent: '返回' }),
                        el('button', { id: 'save-edit-btn', 'data-assignment-id': assignment.id, class: 'btn-primary py-2 px-5 font-bold', textContent: '儲存修訂' })
                    ])
                ])
            ]);

            setTimeout(() => {
                document.getElementById('edit-tag-format').value = tags.format || '純文';
                document.getElementById('edit-tag-contentType').value = tags.contentType || '記敘';
                document.getElementById('edit-tag-difficulty').value = tags.difficulty || '普通';
            }, 0);

            const base = this._base('', 50); // Create base structure with a placeholder
            const baseElement = document.createElement('div');
            baseElement.innerHTML = base;
            baseElement.querySelector('.modal-backdrop').appendChild(modalContent);
            resolve(baseElement.innerHTML);
            setTimeout(() => {
                const checkbox = document.getElementById('edit-is-public');
                if (checkbox) {
                    checkbox.checked = !!assignment.isPublic;
                }
            }, 0);
        });
    },

    aiAnalysisRefine(data) {
        return new Promise(resolve => {
            const content = `<div class="card w-full max-w-lg"><h2 class="text-xl font-bold mb-4 text-center font-rounded">AI 潤飾指令</h2><p class="text-sm text-gray-600 mb-4">請輸入您的潤飾要求，例如：「請讓語氣更活潑」、「增加一個關於家庭的比喻」。</p><textarea id="ai-analysis-refine-prompt" class="w-full form-element-ink mb-4" rows="3" placeholder="請輸入指令..."></textarea><div class="flex justify-end gap-4"><button id="cancel-ai-analysis-refine-btn" class="btn-secondary py-2 px-5 font-bold">返回</button><button id="confirm-ai-analysis-refine-btn" class="btn-primary py-2 px-5 font-bold">開始潤飾</button></div></div>`;
            resolve(this._base(content, 60));
        });
    },

    aiRewrite(data) {
        return new Promise(resolve => {
            const content = `<div class="card w-full max-w-lg"><h2 class="text-xl font-bold mb-4 text-center font-rounded">AI 書僮</h2><p class="text-sm text-gray-600 mb-4">請輸入潤飾指令，例如：「請將此文潤飾得更為典雅」、「將此文縮減至三百字」。AI 將會改寫**編輯區中的文章內容**。</p><textarea id="ai-rewrite-command" class="w-full form-element-ink mb-4" rows="3" placeholder="請輸入指令..."></textarea><div class="flex justify-end gap-4"><button id="close-ai-rewrite-modal-btn" class="btn-secondary py-2 px-5 font-bold">返回</button><button id="confirm-ai-rewrite-btn" class="btn-primary py-2 px-5 font-bold">開始潤飾</button></div></div>`;
            resolve(this._base(content, 60));
        });
    },

    articleAnalysis(data) {
        return new Promise(resolve => {
            const content = `<div class="card max-w-4xl w-full"><h2 class="text-2xl font-bold mb-6 text-gray-800 font-rounded">${data.title}</h2><div id="article-analysis-content" class="max-h-[70vh] overflow-y-auto custom-scrollbar pr-4">${data.contentHtml}</div><div class="mt-6 flex justify-end items-center gap-4"><button id="analyze-with-ai-btn" data-assignment-id="${data.assignmentId}" class="btn-teal py-2 px-4">AI 點評全學堂表現</button><button id="close-article-analysis-modal" class="btn-secondary py-2 px-5 font-bold">關閉</button></div></div>`;
            resolve(this._base(content));
        });
    },

    studentAnalysis(data) {
        return new Promise(resolve => {
            const content = `<div class="card max-w-2xl w-full"><h2 id="student-analysis-title" class="text-2xl font-bold mb-6 text-gray-800 font-rounded">個人課業</h2><div id="student-analysis-content" class="max-h-[70vh] overflow-y-auto custom-scrollbar pr-4"></div><button id="close-student-analysis-modal" class="mt-6 w-full btn-secondary py-2 font-bold">關閉</button></div>`;
            resolve(this._base(content));
        });
    },

    studentDetail(data) {
        return new Promise(resolve => {
            const content = `<div class="card max-w-2xl w-full"><h2 id="student-detail-title" class="text-2xl font-bold mb-4 text-gray-800 font-rounded">作答詳情</h2><div id="student-detail-content" class="max-h-[70vh] overflow-y-auto custom-scrollbar pr-4 bg-gray-50 p-4 rounded-lg"></div><button id="close-student-detail-modal" class="mt-6 w-full btn-secondary py-2 font-bold">關閉</button></div>`;
            resolve(this._base(content));
        });
    },

    deleteClassConfirm(data) {
        return new Promise(resolve => {
            const content = `<div class="card w-full max-w-md"><h2 class="text-xl font-bold mb-4 text-red-600">確認解散學堂</h2><p class="text-gray-600 mb-4">這將會永久解散「<strong id="delete-class-name-confirm">${data.className}</strong>」及其所有學子的學習記錄。此舉無法復原。</p><label class="font-bold text-sm">請輸入學堂名稱以確認：</label><input type="text" id="delete-class-confirm-input" class="w-full form-element-ink mt-1 mb-4"><p id="delete-class-confirm-error" class="text-red-500 text-sm h-4 mb-2"></p><div class="flex justify-end gap-4"><button id="cancel-delete-class-btn" class="btn-secondary py-2 px-5 font-bold">返回</button><button id="confirm-delete-class-btn" data-class-id="${data.classId}" class="btn-danger py-2 px-5 font-bold">確認解散</button></div></div>`;
            resolve(this._base(content));
        });
    },

    editClassName(data) {
        return new Promise(resolve => {
            const content = `<div class="card w-full max-w-md"><h2 class="text-xl font-bold mb-4">修訂學堂名號</h2><input type="text" id="edit-class-name-input" class="w-full form-element-ink mb-4" value="${escapeHtml(data.className)}"><p id="edit-class-name-error" class="text-red-500 text-sm h-4 mb-2"></p><div class="flex justify-end gap-4"><button id="cancel-edit-class-name-btn" class="btn-secondary py-2 px-5 font-bold">返回</button><button id="confirm-edit-class-name-btn" data-class-id="${data.classId}" class="btn-primary py-2 px-5 font-bold">存檔</button></div></div>`;
            resolve(this._base(content));
        });
    },

    changePassword(data) {
        return new Promise(resolve => {
            const content = `<div class="card w-full max-w-md"><h2 class="text-xl font-bold mb-4">修改憑信</h2><div class="space-y-4"><div><label class="font-bold text-sm">舊密語</label><input type="password" id="current-password" class="w-full form-element-ink mt-1"></div><div><label class="font-bold text-sm">新密語</label><input type="password" id="new-password" class="w-full form-element-ink mt-1"></div><div><label class="font-bold text-sm">確認新密語</label><input type="password" id="confirm-new-password" class="w-full form-element-ink mt-1"></div></div><p id="change-password-error" class="text-red-500 text-sm h-4 mt-4"></p><div class="flex justify-end gap-4 mt-6"><button id="cancel-change-password-btn" class="btn-secondary py-2 px-5 font-bold">返回</button><button id="confirm-change-password-btn" class="btn-primary py-2 px-5 font-bold">確認修訂</button></div></div>`;
            resolve(this._base(content));
        });
    },

    aiStudentSuggestion(data) {
        return new Promise(resolve => {
            const content = `<div class="card max-w-2xl w-full"><h2 class="text-2xl font-bold mb-4 text-teal-700 flex items-center gap-2 font-rounded">AI 個人化策勵</h2><div id="ai-student-suggestion-content" class="prose-custom max-h-[70vh] overflow-y-auto text-left p-4 bg-gray-50 rounded-lg">${markdownToHtml(data.suggestionText)}</div><button id="close-ai-suggestion-modal" class="mt-6 w-full btn-primary py-2 font-bold">展卷</button></div>`;
            resolve(this._base(content));
        });
    },

    editStudent(data) {
        return new Promise(resolve => {
            const student = data.student;
            const content = `<div class="card w-full max-w-md"><h2 class="text-xl font-bold mb-4">修訂學籍</h2><div class="space-y-4"><div><label class="font-bold text-sm">座號</label><input type="number" id="edit-student-seat" class="w-full form-element-ink mt-1" value="${student.seatNumber}"></div><div><label class="font-bold text-sm">姓名</label><input type="text" id="edit-student-name" class="w-full form-element-ink mt-1" value="${escapeHtml(student.name)}"></div></div><p id="edit-student-error" class="text-red-500 text-sm h-4 mt-4"></p><div class="flex justify-end gap-4 mt-6"><button id="cancel-edit-student-btn" class="btn-secondary py-2 px-5 font-bold">返回</button><button id="confirm-edit-student-btn" class="btn-primary py-2 px-5 font-bold">存檔</button></div></div>`;
            resolve(this._base(content));
        });
    },

    deleteStudentConfirm(data) {
        return new Promise(resolve => {
            const content = `<div class="card w-full max-w-md"><h2 class="text-xl font-bold mb-4 text-red-600">確認除籍</h2><p class="text-gray-600 mb-4">您確定要將「<strong>${escapeHtml(data.studentName)}</strong>」除籍嗎？此舉將一併移除該位學子的所有課業記錄，且無法復原。</p><div class="flex justify-end gap-4"><button id="cancel-delete-student-btn" class="btn-secondary py-2 px-5 font-bold">返回</button><button id="confirm-delete-student-btn" data-class-id="${data.classId}" data-student-id="${data.studentId}" class="btn-danger py-2 px-5 font-bold">確認除籍</button></div></div>`;
            resolve(this._base(content));
        });
    },

    message(data) {
        return new Promise(resolve => {
            const content = `<div class="card w-full max-w-md"><h2 class="text-xl font-bold mb-2">${data.title}</h2><p class="text-slate-600 mb-4">${data.message}</p><button id="close-message-modal-btn" class="w-full btn-primary py-2 font-bold">關閉</button></div>`;
            resolve(this._base(content));
        });
    },

    prompt(data) {
        return new Promise(resolve => {
            const content = `<div class="card w-full max-w-md"><h2 class="text-xl font-bold mb-4">${data.title}</h2><p class="text-slate-600 mb-4">${data.message}</p><input type="text" id="prompt-input" class="w-full form-element-ink mt-1 mb-4"><p id="prompt-error" class="text-red-500 text-sm h-4 mb-2"></p><div class="flex justify-end gap-4"><button id="cancel-prompt-btn" class="btn-secondary py-2 px-5 font-bold">返回</button><button id="confirm-prompt-btn" class="btn-danger py-2 px-5 font-bold">確認</button></div></div>`;
            resolve(this._base(content));
        });
    },

    confirm(data) {
        return new Promise(resolve => {
            const content = `<div class="card w-full max-w-md"><h2 class="text-xl font-bold mb-4">${data.title}</h2><p class="text-slate-600 mb-6">${data.message}</p><div class="flex justify-end gap-4"><button id="cancel-confirm-btn" class="btn-secondary py-2 px-5 font-bold">返回</button><button id="confirm-confirm-btn" class="btn-danger py-2 px-5 font-bold">確認</button></div></div>`;
            resolve(this._base(content));
        });
    },

    achievementUnlocked(data) {
        return new Promise(resolve => {
            const { icon, title, description, count } = data;
            const titleSuffix = count && count > 1 ? ` <span class="text-lg text-amber-600 font-bold">x ${count}</span>` : '';
            const mainTitle = count && count > 1 ? "成就升級！" : "成就解鎖！";

            const content = `<div class="card w-full max-w-sm text-center p-8"><h2 class="text-2xl font-bold mb-2 text-amber-500 font-rounded">${mainTitle}</h2><div class="text-6xl my-4">${icon}</div><h3 class="text-xl font-semibold">${title}${titleSuffix}</h3><p class="text-gray-500 mt-1">${description}</p><button id="close-achievement-modal-btn" class="mt-6 w-full btn-primary py-2 font-bold">太棒了！</button></div>`;
            resolve(this._base(content, 70)); // Higher z-index to appear on top
        });
    },

    achievementsList(data) {
        return new Promise(resolve => {
            const { allAchievements, unlockedAchievements, studentData, studentSubmissions, categoryOrder } = data;

            // Helper: Calculate current progress for a condition
            function getProgress(condition) {
                if (!condition || !condition.type) return { current: 0, target: 0, percent: 0 };
                const target = parseInt(condition.value, 10) || 0;
                let current = 0;

                switch (condition.type) {
                    case 'submission_count':
                        current = studentSubmissions?.length || 0;
                        break;
                    case 'login_streak':
                        current = studentData?.loginStreak || 0;
                        break;
                    case 'high_score_streak':
                        current = studentData?.highScoreStreak || 0;
                        break;
                    case 'completion_streak':
                        current = studentData?.completionStreak || 0;
                        break;
                    case 'average_score':
                        if (studentSubmissions && studentSubmissions.length > 0) {
                            current = Math.round(studentSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / studentSubmissions.length);
                        }
                        break;
                    case 'genre_explorer':
                        const tagCounts = studentData?.tagReadCounts || {};
                        current = Object.keys(tagCounts).filter(key => key.startsWith('contentType_')).length;
                        break;
                    case 'weekly_progress':
                        return { current: null, target: null, percent: null, text: '自動判定' };
                    default:
                        if (condition.type && condition.type.startsWith('read_tag_')) {
                            const key = condition.type.replace('read_tag_', '');
                            current = (studentData?.tagReadCounts || {})[key] || 0;
                        }
                        break;
                }

                const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
                return { current, target, percent };
            }

            // Helper: Get category for an achievement
            function getCategory(condition) {
                if (!condition) return 'other';
                for (const cat of categoryOrder) {
                    if (cat.types.includes(condition.type)) return cat.key;
                }
                return 'other';
            }

            // Group achievements by category
            const grouped = {};
            categoryOrder.forEach(cat => grouped[cat.key] = []);
            grouped['other'] = [];

            allAchievements.forEach(ach => {
                const catKey = getCategory(ach.condition);
                if (!grouped[catKey]) grouped[catKey] = [];
                grouped[catKey].push(ach);
            });

            // Sort each category: by type first, then by value (ascending)
            Object.keys(grouped).forEach(key => {
                grouped[key].sort((a, b) => {
                    const typeA = a.condition?.type || '';
                    const typeB = b.condition?.type || '';
                    if (typeA !== typeB) return typeA.localeCompare(typeB);
                    const valA = parseInt(a.condition?.value, 10) || 0;
                    const valB = parseInt(b.condition?.value, 10) || 0;
                    return valA - valB;
                });
            });

            // Build achievement items
            const sections = [];

            categoryOrder.forEach(cat => {
                const items = grouped[cat.key];
                if (items.length === 0) return;

                const sectionItems = items.map(ach => {
                    const unlockedRecord = unlockedAchievements.find(u => u.achievementId === ach.id);
                    const isUnlocked = !!unlockedRecord;
                    const progress = getProgress(ach.condition);

                    // Title with count badge
                    const titleEl = el('h3', { class: 'font-bold text-base' }, [ach.title]);
                    if (isUnlocked && unlockedRecord.count > 1) {
                        titleEl.appendChild(el('span', {
                            class: 'ml-2 text-amber-600 font-bold text-sm',
                            textContent: `×${unlockedRecord.count}`
                        }));
                    }

                    // Progress bar or stamp
                    let progressEl = null;
                    if (isUnlocked) {
                        // Show stamp for unlocked achievements
                        progressEl = el('div', { class: 'achievement-stamp' }, [
                            el('span', { class: 'stamp-text', textContent: '達成' })
                        ]);
                    } else if (progress.text) {
                        // Special text like "自動判定"
                        progressEl = el('div', { class: 'text-xs text-gray-500 mt-1', textContent: progress.text });
                    } else if (progress.target > 0) {
                        // Progress bar for locked achievements
                        progressEl = el('div', { class: 'mt-2' }, [
                            el('div', { class: 'flex justify-between text-xs text-gray-500 mb-1' }, [
                                el('span', { textContent: `${progress.current} / ${progress.target}` }),
                                el('span', { textContent: `${progress.percent}%` })
                            ]),
                            el('div', { class: 'h-2 bg-gray-200 rounded-full overflow-hidden' }, [
                                el('div', {
                                    class: 'h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-300',
                                    style: `width: ${progress.percent}%`
                                })
                            ])
                        ]);
                    }

                    return el('div', {
                        class: `p-3 border rounded-lg flex items-start gap-3 transition-all relative overflow-hidden ${isUnlocked ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`
                    }, [
                        el('div', { class: `text-4xl flex-shrink-0 ${isUnlocked ? '' : 'filter grayscale opacity-50'}`, textContent: ach.icon }),
                        el('div', { class: 'flex-grow min-w-0' }, [
                            titleEl,
                            el('p', { class: 'text-xs text-gray-600 mt-0.5', textContent: ach.description }),
                            progressEl
                        ].filter(Boolean))
                    ]);
                });

                sections.push(
                    el('div', { class: 'mb-4' }, [
                        el('h3', { class: 'text-sm font-bold text-gray-700 mb-2 pb-1 border-b border-gray-200', textContent: cat.name }),
                        el('div', { class: 'space-y-2' }, sectionItems)
                    ])
                );
            });

            // Build modal content
            const unlockedCount = unlockedAchievements.length;
            const totalCount = allAchievements.length;

            const content = el('div', { class: 'card max-w-2xl w-full' }, [
                el('div', { class: 'flex justify-between items-center mb-4' }, [
                    el('h2', { class: 'text-2xl font-bold text-gray-800 font-rounded', textContent: '我的成就' }),
                    el('span', { class: 'text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full', textContent: `${unlockedCount} / ${totalCount}` })
                ]),
                el('div', { class: 'max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar' }, sections),
                el('button', { id: 'close-achievements-list-modal', class: 'mt-4 w-full btn-secondary py-2 font-bold', textContent: '關閉' })
            ]);

            const base = this._base('', 50);
            const baseElement = document.createElement('div');
            baseElement.innerHTML = base;
            baseElement.querySelector('.modal-backdrop').appendChild(content);
            resolve(baseElement.innerHTML);
        });
    },
}

// P2-1: 改為正規 async function，避免 new Promise(async) 反模式
export async function renderModal(type, data = {}) {
    const generator = modalHtmlGenerators[type];
    if (!generator) {
        console.error(`Modal type "${type}" not found.`);
        throw new Error(`Modal type "${type}" not found.`);
    }

    try {
        showLoading('載入中...');
        const modalHtml = await generator.call(modalHtmlGenerators, data);

        if (!modalHtml) {
            hideLoading();
            return null;
        }

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = modalHtml;
        const modalElement = tempDiv.firstElementChild;
        dom.modalContainer.appendChild(modalElement);

        // Handle prompt-like modals that need to return a value
        if (type === 'aiAnalysisRefine') {
            return new Promise((resolve) => {
                const confirmBtn = modalElement.querySelector('#confirm-ai-analysis-refine-btn');
                const cancelBtn = modalElement.querySelector('#cancel-ai-analysis-refine-btn');
                const input = modalElement.querySelector('#ai-analysis-refine-prompt');

                const close = (value) => {
                    if (modalElement._abortController) modalElement._abortController.abort();
                    modalElement.remove();
                    resolve(value);
                };

                confirmBtn.onclick = () => close(input.value);
                cancelBtn.onclick = () => close(null);
            });
        } else {
            // For other modals, attach standard listeners
            attachModalEventListeners(type, data);
            return undefined;
        }
    } catch (error) {
        console.error(`Error rendering modal "${type}":`, error);
        renderModal('message', { title: '錯誤', message: '無法載入視窗內容。' });
        throw error;
    } finally {
        hideLoading();
    }
}

export function attachModalEventListeners(type, data = {}) {
    const modalInstance = dom.modalContainer.lastElementChild;
    if (!modalInstance) return;

    // P2-2: 使用 AbortController 管理事件生命週期
    const controller = new AbortController();
    modalInstance._abortController = controller;

    const clickHandler = (e) => {
        const target = e.target;
        const targetId = target.id;
        const targetClassList = target.classList;

        // General close actions for all modals
        if (target === modalInstance || targetId?.includes('close-') || targetId?.includes('cancel-')) {
            if (targetId === 'close-result-modal') {
                // 清除所有 modal 時，逐一 abort 所有 controller
                Array.from(dom.modalContainer.children).forEach(child => {
                    if (child._abortController) child._abortController.abort();
                });
                dom.modalContainer.innerHTML = '';
                if (appState.currentAssignment) {
                    if (typeof window.displayAssignment === 'function') window.displayAssignment(appState.currentAssignment);
                } else {
                    if (typeof window.showArticleGrid === 'function') window.showArticleGrid();
                }
            } else {
                closeModal(); // Close only the top modal
            }
            return;
        }

        // Specific button actions within the modal
        switch (targetId) {
            case 'password-submit-btn': if (typeof window.handleTeacherLogin === 'function') window.handleTeacherLogin(e); break;
            case 'view-analysis-btn':
                const assignment = data.assignment;
                if (assignment) {
                    if (typeof window.displayAnalysis === 'function') window.displayAnalysis(assignment);
                } else {
                    console.error("No assignment data available for analysis.");
                }
                break;
            case 'save-edit-btn': if (typeof window.handleSaveEdit === 'function') window.handleSaveEdit(e); break;
            case 'edit-ai-assistant-btn':
                const articleText = document.getElementById('edit-article').value;
                renderModal('aiRewrite', { articleText });
                break;
            case 'confirm-ai-rewrite-btn': if (typeof window.handleAiRewrite === 'function') window.handleAiRewrite(); break;
            case 'regenerate-all-questions-btn':
                if (typeof window.handleRegenerateQuestions === 'function') window.handleRegenerateQuestions(target.closest('.card').querySelector('#save-edit-btn').dataset.assignmentId);
                break;
            case 'confirm-delete-class-btn': if (typeof window.confirmDeleteClass === 'function') window.confirmDeleteClass(target.dataset.classId); break;
            case 'confirm-edit-class-name-btn': if (typeof window.handleConfirmEditClassName === 'function') window.handleConfirmEditClassName(target.dataset.classId); break;
            case 'confirm-change-password-btn': if (typeof window.handleChangePassword === 'function') window.handleChangePassword(); break;
            case 'confirm-delete-student-btn': if (typeof window.confirmDeleteStudent === 'function') window.confirmDeleteStudent(); break;
            case 'confirm-edit-student-btn': if (typeof window.handleSaveStudentEdit === 'function') window.handleSaveStudentEdit(); break;
            case 'analyze-with-ai-btn': if (typeof window.handleAiAnalysis === 'function') window.handleAiAnalysis(target.dataset.assignmentId); break;
            case 'save-ach-form-btn': if (typeof window.handleSaveAchievement === 'function') window.handleSaveAchievement(target.dataset.id); break;
            case 'ai-generate-achievement-btn': if (typeof window.handleAiGenerateAchievement === 'function') window.handleAiGenerateAchievement(); break;
            case 'confirm-prompt-btn':
                if (data.onConfirm) {
                    const input = document.getElementById('prompt-input');
                    if (input) data.onConfirm(input.value.trim());
                }
                break;
            case 'confirm-confirm-btn':
                closeModal();
                if (data.onConfirm) data.onConfirm();
                break;
        }

        const regenBtn = target.closest('.regenerate-question-btn');
        if (regenBtn) {
            const questionIndex = parseInt(regenBtn.dataset.questionIndex, 10);
            const assignmentId = regenBtn.closest('.card').querySelector('#save-edit-btn').dataset.assignmentId;
            if (typeof window.handleRegenerateQuestions === 'function') window.handleRegenerateQuestions(assignmentId, questionIndex);
        }
        const reviewBtn = target.closest('.view-submission-review-btn');
        if (reviewBtn) {
            const { assignmentId, studentId } = reviewBtn.dataset;
            if (typeof window.displaySubmissionReview === 'function') window.displaySubmissionReview(assignmentId, studentId);
        }
    };

    // 使用 signal 綁定事件，closeModal 時自動解除
    modalInstance.addEventListener('click', clickHandler, { signal: controller.signal });
}

export function showLoading(message) {
    const overlay = document.getElementById('loading-overlay');
    const messageEl = document.getElementById('loading-message');
    if (overlay && messageEl) {
        messageEl.textContent = message;
        overlay.classList.remove('hidden');
    }
}

export function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

