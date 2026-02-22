import { appState, dom } from './state.js';
import { markdownToHtml } from './utils.js';
import { renderModal, showLoading, hideLoading } from './ui.js';
import { db } from './state.js';
import { updateDoc, doc, Timestamp, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

export async function callGenerativeAI(prompt) {
    if (!appState.geminiApiKey) {
        renderModal('message', { type: 'error', title: '設定錯誤', message: '尚未設定 Gemini API 金鑰，請夫子至「系統設定」頁面設定。' });
        throw new Error("Gemini API key is not set.");
    }
    // 後台生成文章使用教師端設定的模型
    const modelToUse = appState.teacherGeminiModel || appState.geminiModel;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${appState.geminiApiKey}`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.5,
            topK: 1,
            topP: 1,
            maxOutputTokens: 8192,
        },
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ]
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 秒超時

    let response;
    try {
        response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("Gemini API Error:", errorBody);
            throw new Error(`API request failed with status ${response.status}`);
        }
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error("Gemini API Timeout");
            throw new Error('AI 書僮思考太久了，請稍後再試！ (Timeout)');
        }
        throw error;
    }

    const body = await response.json();
    if (body.candidates && body.candidates.length > 0 && body.candidates[0].content && body.candidates[0].content.parts && body.candidates[0].content.parts.length > 0) {
        if (body.candidates[0].finishReason && body.candidates[0].finishReason !== "STOP") {
            console.warn(`Gemini API response finished with reason: ${body.candidates[0].finishReason}. Full response:`, body);
        }
        return body.candidates[0].content.parts[0].text;
    } else {
        let errorMessage = "Invalid or empty 'candidates' in response from Gemini API.";
        if (body.promptFeedback) {
            errorMessage = `Prompt was blocked. Reason: ${body.promptFeedback.blockReason}.`;
            console.error("Gemini API Prompt Feedback:", body.promptFeedback);
        }
        console.error("Full API response:", body);
        throw new Error(errorMessage);
    }
}

export async function callFullGeminiAnalysis(articleText) {
    const prompt = `
              你是一位專業的國文老師，擅長針對文章進行深入分析。請為以下文章提供三項資訊：

              文章內容：
              """
              ${articleText}
              """

              請嚴格按照以下 JSON 格式回傳，不要有任何其他的文字或解釋：
              {
                "mindmap": "一個 Mermaid.js 的 mindmap格式的心智圖。請確保語法絕對正確，擷取文章重點即可，節點不要過多，節點文字六字以內，第一層儘量不超過5個節點，第一層標上數字順序（如:①開頭），避免使用任何特殊字元或引號。語法生成從mindmap開始，不用生成mermaid",
                "explanation": "一篇 300 字左右的短文，對象是國中生，深入解析這篇文章的主旨、結構、寫作技巧與文化寓意。請以純文字格式撰寫，段落之間用換行分隔，重點處使用 Markdown 的 **粗體** 語法強調。不要長篇大論，要簡明易讀。",
                "thinking_questions": "一個 Markdown 格式的無序清單，提供三個與文章主題相關、能引導學生進行深度探究的思考題。問題應連結學生的生活經驗或引發思辨，且不應提供標準答案。不要長篇大論，要簡明易讀。例如：\\n* 根據文章，作者認為「勇敢」的定義是什麼？你生活中有沒有類似的經驗，讓你對「勇敢」有不同的看法？\\n* 文章中的主角做了一個困難的決定，如果換作是你，你會怎麼選擇？為什麼？"
              }
            `;

    const rawText = await callGenerativeAI(prompt);
    if (!rawText) return null;

    try {
        const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleanedText);
    } catch (e) {
        console.error("Failed to parse JSON from callGeminiAPI response:", e);
        console.error("Raw text received from AI:", rawText);
        throw new Error("AI did not return valid JSON.");
    }
}

export async function handleAnalysisAI(e) {
    const button = e.target.closest('.edit-analysis-ai-btn');
    const modal = button.closest('.modal-instance');
    const articleText = modal.querySelector('#edit-article').value;

    const target = button.dataset.target;
    const action = button.dataset.action;

    const textareas = {
        mindmap: modal.querySelector('#edit-analysis-mindmap'),
        explanation: modal.querySelector('#edit-analysis-explanation'),
        thinking_questions: modal.querySelector('#edit-analysis-thinking-questions')
    };
    const targetTextarea = textareas[target];

    if (!articleText) {
        renderModal('message', { type: 'error', title: '錯誤', message: '必須先有文章內容才能生成解析。' });
        return;
    }
    if (!targetTextarea) return;

    const originalContent = targetTextarea.value;

    if (action === 'refine') {
        const refinePrompt = await renderModal('aiAnalysisRefine', {});
        if (refinePrompt === null) return; // User cancelled

        showLoading('AI 書僮正在潤飾中...');
        try {
            const newContent = await callSingleGeminiAnalysis(articleText, target, 'refine', originalContent, refinePrompt);
            if (newContent) {
                targetTextarea.value = newContent;
            } else {
                throw new Error("AI 未能回傳有效內容。");
            }
        } catch (error) {
            console.error(`AI analysis error for ${target}:`, error);
            renderModal('message', { type: 'error', title: 'AI 操作失敗', message: `AI 書僮處理時發生錯誤：${error.message}` });
        } finally {
            hideLoading();
        }
    } else { // regenerate
        showLoading('AI 書僮正在生成中...');
        try {
            const newContent = await callSingleGeminiAnalysis(articleText, target, 'regenerate', originalContent);
            if (newContent) {
                targetTextarea.value = newContent;
            } else {
                throw new Error("AI 未能回傳有效內容。");
            }
        } catch (error) {
            console.error(`AI analysis error for ${target}:`, error);
            renderModal('message', { type: 'error', title: 'AI 操作失敗', message: `AI 書僮處理時發生錯誤：${error.message}` });
        } finally {
            hideLoading();
        }
    }
}

export async function handleAiRewrite() {
    const command = document.getElementById('ai-rewrite-command').value;
    const articleText = document.getElementById('edit-article')?.value;

    if (!command || !articleText) {
        renderModal('message', { type: 'error', title: '操作錯誤', message: '請確保編輯區有文章內容，並已輸入改寫指令。' });
        return;
    }

    showLoading('AI 書僮正在改寫文章...');

    const prompt = `請根據以下指令，潤飾這篇文稿。\n請嚴格遵守以下格式要求：\n1.  **輸出格式**：請只輸出潤飾後的文稿全文，不要包含任何額外的說明或標題。\n2.  **段落縮排**：所有文字段落（包含第一段）的開頭都必須加上兩個全形空格「　　」來進行縮排。\n\n指令："""${command}"""\n原文："""${articleText}"""`;

    try {
        if (!appState.geminiApiKey) throw new Error("AI API 金鑰未設定。");
        const apiKey = appState.geminiApiKey;
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

        if (!response.ok) {
            throw new Error(`API 請求失敗: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (result.candidates?.length > 0 && result.candidates[0].content.parts[0].text) {
            const newArticle = result.candidates[0].content.parts[0].text;
            const editArticleEl = document.getElementById('edit-article');
            if (editArticleEl) {
                editArticleEl.value = newArticle;
            }
            closeTopModal();
        } else {
            throw new Error("API 未返回有效內容或內容為空。");
        }
    } catch (error) {
        console.error("AI Rewrite Error:", error);
        renderModal('message', { type: 'error', title: '潤飾失敗', message: `操作失敗，請稍後再試。(${error.message})` });
    } finally {
        hideLoading();
    }
}

export async function handleAiGenerateAchievement() {
    const errorEl = document.getElementById('ach-form-error');
    if (errorEl) errorEl.textContent = '';

    // 1. 獲取類型與中文名稱的對照表
    const conditionOptions = modalHtmlGenerators.achievementForm.conditionOptions;
    if (!conditionOptions) {
        if (errorEl) errorEl.textContent = '錯誤：找不到條件選項。';
        return;
    }
    const typeToNameMap = new Map();
    conditionOptions.forEach(group => {
        group.options.forEach(opt => {
            typeToNameMap.set(opt.value, opt.text);
        });
    });

    // 2. 收集現有表單數據，並附上中文類型名稱
    const conditions = [];
    document.querySelectorAll('.condition-block').forEach(block => {
        const type = block.querySelector('.ach-condition-type').value;
        const value = block.querySelector('.ach-condition-value').value;
        conditions.push({
            type: type || "",
            typeName: type ? typeToNameMap.get(type) || "" : "", // 新增的欄位
            value: value || ""
        });
    });

    const currentAchievement = {
        name: document.getElementById('ach-name').value || "",
        description: document.getElementById('ach-description').value || "",
        icon: document.getElementById('ach-icon').value || "",
        conditions: conditions
    };

    // 3. 建立更具主題風格、包含更多上下文的 prompt
    const prompt = `
你是一位學識淵博、想像力豐富的書院總教習。你的任務是為一個線上學習平台的成就系統，設計充滿創意與文藝氣息的獎勵。

# 核心原則
- **主題**：靈感必須源於中國古典文學、歷史典故、文人雅趣（如琴棋書畫、山水遊歷、品茗論道）或神話傳說。
- **風格**：擺脫呆板的四字成語。追求更有畫面感、更獨特的稱號。可以是一個詩句、一個稱謂、或是一個典故的精煉。
- **創意**：名稱和圖示都必須有巧思，避免陳腔濫調。

# 輸出格式
你必須嚴格回傳一個 JSON 物件，不包含任何 JSON 以外的文字。JSON 結構如下：
{
  "name": "string",
  "description": "string",
  "icon": "string",
  "reasoning": "string",
  "conditions": [ { "type": "string", "value": "number" } ]
}

# 欄位詳細說明
1.  **name (成就稱號)**：
    *   **要求**：一個富有創意和文學氣息的稱號，**長度不限**。
    *   **範例**：「筆落驚風雨」、「腹有詩書氣自華」、「行萬里路者」、「一葦渡江」。

2.  **description (描述)**：
    *   **要求**：用典雅的文字描述此成就，並在結尾用括號註明清楚的達成條件。
    *   **範例**：「下筆如有神助，文思泉湧，令人驚嘆。（完成 10 篇『議論』文章。）」

3.  **icon (圖示)**：
    *   **要求**：從下方的「靈感圖示庫」中，挑選一個最能對應成就意象的 emoji。**不要重複使用已有的圖示**，除非意境高度契合。
    *   **靈感圖示庫**: 📜✒️🏮🏔️🍵🏞️🐉鳳舟劍琴棋書畫🌊🔥⭐🌙☀️🌱🌳💎🗝️🗺️🧭⛩️

4.  **reasoning (設計理念)**：
    *   **要求**：**(此欄位為必要)** 簡要說明你為何如此命名，以及圖示選擇的理由。這能展現你的巧思。
    *   **範例**：「『筆落驚風雨』取自杜甫詩句，比喻文采出眾；圖示選用『✒️』，象徵創作的筆。」

5.  **conditions (條件列表)**：
    *   **要求**：這是成就的觸發條件，也是你創意的核心依據。
    *   如果輸入的 \`conditions\` 陣列為空，請為其新增一個合理的條件。
    *   如果 \`conditions\` 中的物件有空值，請為其設定合理的 \`type\` 和 \`value\`。
    *   **可用的 type**：'submission_count', 'login_streak', 'high_score_streak', 'average_score', 'genre_explorer', 'read_tag_contentType_記敘', 'read_tag_difficulty_困難' 等。

# 你的任務
根據下方提供的 JSON 資料，補完所有值為空字串("")的欄位，並回傳一個完整的 JSON 物件。

**目前的成就資料 (請參考 'typeName' 欄位發想):**
${JSON.stringify(currentAchievement, null, 2)}
`;

    await callAchievementAI(prompt);
}

export async function callAchievementAI(prompt) {
    const aiButton = document.getElementById('ai-generate-achievement-btn');
    const errorEl = document.getElementById('ach-form-error');
    if (!aiButton || !errorEl) return;

    // 使用 config.js 中的變數
    if (!appState.geminiApiKey) {
        errorEl.textContent = '錯誤：找不到或尚未設定您的 AI API 金鑰，請至「系統設定」頁面設定。';
        return;
    }

    const originalText = aiButton.textContent;
    aiButton.disabled = true;
    aiButton.innerHTML = '<div class="loader-sm"></div> 發想中...';
    errorEl.textContent = '';

    try {
        // 成就生成屬於後台功能，使用教師端模型
        const modelToUse = appState.teacherGeminiModel || appState.geminiModel;
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${appState.geminiApiKey}`;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 1024,
                    responseMimeType: "application/json",
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("AI API Error Body:", errorBody);
            throw new Error(`請求失敗(${response.status})。 ${errorBody}`);
        }

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            console.error("AI Response Blocked or Empty:", data);
            const blockReason = data.promptFeedback?.blockReason || '未知原因';
            throw new Error(`AI 回應被阻擋。原因: ${blockReason}`);
        }

        let idea;
        const part = data.candidates[0]?.content?.parts?.[0];

        if (part && part.text) {
            const jsonString = part.text.trim();
            idea = JSON.parse(jsonString);
        } else {
            console.error("Unexpected AI Response Structure:", data);
            throw new Error("AI 回應格式不正確 (缺少 text 內容)。");
        }

        // --- New: Smartly populate the form, including dynamic conditions ---

        // Populate basic fields
        const nameInput = document.getElementById('ach-name');
        if (nameInput && !nameInput.value && idea.name) nameInput.value = idea.name;

        const descriptionInput = document.getElementById('ach-description');
        if (descriptionInput && !descriptionInput.value && idea.description) descriptionInput.value = idea.description;

        const iconInput = document.getElementById('ach-icon');
        if (iconInput && !iconInput.value && idea.icon) iconInput.value = idea.icon;

        // Populate conditions
        const conditionsContainer = document.getElementById('conditions-container');
        if (conditionsContainer && idea.conditions && Array.isArray(idea.conditions)) {
            conditionsContainer.innerHTML = ''; // Clear existing conditions

            // IMPORTANT: We must use the same options as the form generator
            const conditionOptions = modalHtmlGenerators.achievementForm.conditionOptions;
            if (!conditionOptions) {
                throw new Error("conditionOptions not found. Ensure achievementForm modal has been initialized.");
            }

            idea.conditions.forEach(cond => {
                // This logic is now aligned with `renderConditionBlock` from the form generator
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

                const typeSelect = conditionDiv.querySelector('.ach-condition-type');
                const valueInput = conditionDiv.querySelector('.ach-condition-value');
                const typesWithoutValue = ['weekly_progress'];

                if (cond.type) {
                    typeSelect.value = cond.type;
                }

                // Only set value if the type is not one that should be valueless
                if (cond.value && !typesWithoutValue.includes(cond.type)) {
                    valueInput.value = cond.value;
                }

                // Set initial visibility based on the type
                if (typesWithoutValue.includes(cond.type)) {
                    valueInput.style.display = 'none';
                    valueInput.value = ''; // Ensure value is cleared
                } else {
                    valueInput.style.display = '';
                }

                conditionsContainer.appendChild(conditionDiv);
            });
        }

    } catch (error) {
        console.error("Error generating achievement idea:", error);
        if (error instanceof SyntaxError) {
            errorEl.textContent = 'AI 發想失敗：AI 未能回傳有效的 JSON 格式。';
        } else {
            errorEl.textContent = `AI 發想失敗：${error.message}`;
        }
    } finally {
        aiButton.disabled = false;
        aiButton.innerHTML = originalText;
    }
}

export async function callSingleGeminiAnalysis(articleText, target, action, originalContent = '', refinePrompt = '') {
    const targets = {
        mindmap: "一個 Mermaid.js 的 mindmap格式的心智圖。請確保語法絕對正確，擷取文章重點即可，節點不要過多，節點文字六字以內，第一層儘量不超過5個節點，第一層標上數字順序（如:①開頭），避免使用任何特殊字元或引號。語法生成從mindmap開始，不用生成mermaid",
        explanation: "一篇 300 字左右的短文，對象是國中生，深入解析這篇文章的主旨、結構、寫作技巧與文化寓意。請以純文字格式撰寫，段落之間用換行分隔，重點處使用 Markdown 的 **粗體** 語法強調。不要長篇大論，要簡明易讀。",
        thinking_questions: "一個 Markdown 格式的無序清單，提供三個與文章主題相關、能引導學生進行深度探究的思考題。問題應連結學生的生活經驗或引發思辨，且不應提供標準答案。不要長篇大論，要簡明易讀"
    };

    let actionInstruction;
    if (action === 'refine') {
        actionInstruction = `請根據以下使用者提供的版本進行潤飾。潤飾指令為：「${refinePrompt}」。\n原版本：\n"""\n${originalContent}\n"""`;
    } else { // regenerate
        actionInstruction = `請完全重新生成此內容。`;
    }

    const prompt = `
              你是一位專業的國文老師，擅長針對文章進行深入分析。請為以下文章提供指定的單一資訊。
              文章內容：
              """
              ${articleText}
              """
              
              請求的資訊類型：${targets[target]}

              操作指令：${actionInstruction}

              請直接回傳該項資訊的純文字內容，不要包含任何 JSON 格式或其他的標記。
            `;

    const rawContent = await callGenerativeAI(prompt);
    if (target === 'mindmap') {
        return rawContent.replace(/```mermaid/g, "").replace(/```/g, "").trim();
    }
    return rawContent;
}

window.handleAiRewrite = handleAiRewrite;
window.handleAiGenerateAchievement = handleAiGenerateAchievement;
