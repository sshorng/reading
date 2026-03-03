import { useAuthStore } from '../stores/auth';

/**
 * 核心 AI 調用函數
 */
export async function callGenerativeAI(prompt, modelOverride = null, schema = null, type = 'teacher') {
    const authStore = useAuthStore();

    // 確保配置已載入
    if (!authStore.configLoaded) {
        await authStore.fetchSystemConfig();
    }

    let apiKey = '';
    if (type === 'teacher') {
        apiKey = authStore.teacherApiKey || authStore.geminiApiKey; // Fallback to old key if exists
        if (!apiKey) throw new Error("尚未設定「教師端」Gemini API 金鑰，請至設定頁面填寫。");
    } else {
        apiKey = authStore.studentApiKey;
        if (!apiKey) throw new Error("尚未設定「學生端」Gemini API 金鑰，請請老師至設定頁面填寫。");
    }

    const defaultModel = type === 'student' ? (authStore.studentGeminiModel || 'gemini-2.5-flash-lite') : (authStore.teacherGeminiModel || 'gemini-3-flash-preview');
    let modelName = modelOverride || defaultModel;

    // 確保模型名稱路徑正確，避免 404
    if (!modelName.startsWith('models/')) {
        modelName = `models/${modelName}`;
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;

    const generationConfig = {
        temperature: 0.5,
        topK: 1,
        topP: 1,
        maxOutputTokens: 8192,
    };

    if (schema) {
        generationConfig.responseMimeType = "application/json";
        generationConfig.responseSchema = schema;
    }

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ]
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("[AI API] Call Failed", {
                url: API_URL.split('key=')[0] + 'key=HIDDEN',
                status: response.status,
                error: errorBody
            });
            throw new Error(`AI API 請求失敗 (${response.status}) ${errorBody.error?.message || ''}`);
        }

        const body = await response.json();
        if (body.candidates?.[0]?.content?.parts?.[0]?.text) {
            return body.candidates[0].content.parts[0].text;
        } else {
            throw new Error("AI 未能回傳有效內容。");
        }
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('AI 書僮思考太久了，請稍後再試！ (Timeout)');
        }
        throw error;
    }
}


/**
 * 依題起草篇章與試卷 (移植自 teacher.js)
 */
export async function generateAssignmentFromTopic(topic, tags) {
    const tagFormat = tags.format || '';
    const tagContentType = tags.contentType || '';
    const tagDifficulty = tags.difficulty || '';

    const getDifficultyInstructions = (difficulty) => {
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
    };

    const difficultyInstruction = tagDifficulty
        ? getDifficultyInstructions(tagDifficulty)
        : `*   **文章風格**: 請依據您的專業，針對此主題判斷何種難度（簡單、基礎、普通、進階、困難）最能發揮。並依據該難度該有的字彙深度、句式複雜度與修辭手法撰寫。\n*   **試題風格**: 根據您的難度設定，調配合適的 PISA 問題層次分佈。`;

    const contentTypeInstructions = {
        '記敘': '**寫作手法提醒：請務必使用記敘文體，包含明確的人物、時間、地點和事件經過，著重於故事的發展與情節的描述，避免使用過於客觀或分析性的說明語氣。**',
        '議論': '**寫作手法提醒：請務必使用議論文體，提出明確的論點，並使用例證、引證或數據來支持你的主張，結構上應包含引論、本論、結論。**',
        '抒情': '**寫作手法提醒：請務必使用抒情文體，透過細膩的描寫與譬喻、轉化等修辭手法，表達豐富的情感與想像，著重於意境的營造。**'
    };
    const styleInstruction = contentTypeInstructions[tagContentType] || '';

    let articleInstruction = '';
    const mermaidInstruction = `\n    * **圖表運用指南**：請優先考慮使用 **Mermaid.js 語法** 來建立視覺化圖表，以更生動地呈現資訊。
        * **圖表類型**：請根據內容選擇最合適的圖表，例如用 \`xychart-beta\` 呈現數據、用 \`flowchart\` 展示流程、用 \`pie\` 顯示比例等。
        * **語法規則**：圖表語法需以 \`\`\`mermaid 開頭，以 \`\`\` 結尾。
        * **換行技巧**：在 \`xychart-beta\` 中，如果 X 軸的標籤文字過長，請在字串內使用 "<br>" 標籤來手動換行。
        * **備用方案**：如果內容不適合複雜圖表，也可以使用 GFM (GitHub Flavored Markdown) 格式的表格。`;

    if (tagFormat === '圖表') {
        articleInstruction = `**請以一個主要的 Mermaid 圖表或 Markdown 表格作為文章核心**。所有文字內容應是針對此圖表的簡潔說明，重點在於測驗學生詮釋圖表資訊的能力。${mermaidInstruction}`;
    } else if (tagFormat === '圖文') {
        articleInstruction = `撰寫一篇優質連續文本文章，內容需清晰、有深度、層次分明，且**務必分段**。**請務必在文章內容中，插入一個以上與主題相關、能輔助說明的 Mermaid 圖表或 Markdown 表格**，用以測驗圖文整合能力。${mermaidInstruction}`;
    } else if (tagFormat === '純文') {
        articleInstruction = `撰寫一篇優質文章，內容需清晰、有深度、層次分明，且**務必分段**。`;
    } else {
        articleInstruction = `撰寫一篇優質文章，內容需清晰、有深度、層次分明，且**務必分段**。請自行判斷是否需要搭配圖表，若需要，${mermaidInstruction}`;
    }

    let questionLevelInstruction = '題目層次分配如下：第 1 題：**擷取與檢索**。第 2、3 題：**統整與解釋**。第 4、5 題：**省思與評鑑**。';

    const prompt = `你是一位專為台灣國中生出題的資深國文科老師，請設計一份素養導向的閱讀測驗。所有文本與試題的難度應以「普通」難度作為「國中教育會考」的基準，再根據使用者指定的難度標籤，適度調整文章長度、詞彙深度、句式複雜度與題目鑑別度。
主題：「${topic}」
請遵循以下專業要求：
1.  **篇章撰寫**：
    * **標題設計**：根據主題「${topic}」，發想一個 **能引發學生好奇心並反映文章主旨** 的標題。絕不可使用誇張、聳動或內容農場式風格。
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
        - 每題四個選項長度應相近
        - 正確答案在四個選項中的位置必須隨機分布（0, 1, 2, 3）
    * **答題解析要求**：每題的 explanation 必須包含：(1) 明確說明正確答案的原因並引用原文佐證 (2) 逐一解釋其他三個選項為何錯誤
    * ${questionLevelInstruction}
3.  **標籤要求**（若未特別指定，請依據您產生內容的實際狀況自主填入最恰當的屬性）：
    * **形式**: ${tagFormat ? `請生成「${tagFormat}」形式的內容。` : `請自行判斷最適當的形式，於標籤填入純文、圖文或圖表。`}
    * **內容**: ${tagContentType ? `請生成「${tagContentType}」類型的內容。` : `請自行判斷最適當的文體，於標籤填入記敘、抒情、說明、議論或應用。`}
    * **難度**: ${tagDifficulty ? `請嚴格遵循上方的「難度指引」來生成「${tagDifficulty}」難度的內容，並將此難度作為標籤。` : `請自行決定最適當的難度，於標籤填入簡單、基礎、普通、進階或困難。`}
4.  **產出格式**：請嚴格按照指定的 JSON 格式輸出，不要包含 JSON 格式以外的任何文字。`;

    const schema = {
        type: "OBJECT",
        properties: {
            title: { type: "STRING" },
            article: { type: "STRING" },
            questions: {
                type: "ARRAY", items: {
                    type: "OBJECT", properties: {
                        questionText: { type: "STRING" },
                        options: { type: "ARRAY", items: { type: "STRING" } },
                        correctAnswerIndex: { type: "NUMBER" },
                        explanation: { type: "STRING" }
                    }, required: ["questionText", "options", "correctAnswerIndex", "explanation"]
                }
            },
            tags: {
                type: "OBJECT", properties: {
                    format: { type: "STRING" },
                    contentType: { type: "STRING" },
                    difficulty: { type: "STRING" }
                }, required: ["format", "contentType", "difficulty"]
            }
        },
        required: ["title", "article", "questions", "tags"]
    };

    const res = await callGenerativeAI(prompt, null, schema);
    return JSON.parse(res);
}

/**
 * 💡 AI 靈感發想（針對國中會考與素養導向）
 */
export async function generateTopicIdea(tags) {
    const formatReq = tags?.format ? `，文章形式要求包含「${tags.format}」元素` : '';
    const contentTypeReq = tags?.contentType ? `，文體偏好「${tags.contentType}」` : '';
    const difficultyReq = tags?.difficulty ? `，難度大約設定在「${tags.difficulty}」等級` : '';

    const prompt = `您是一位資深的台灣國中國文輔導團教師，擅長掌握「國中教育會考」的命題趨勢與 PISA 閱讀素養精神。
您的任務是為國文老師隨機提供一個極具創意的「閱讀測驗寫作架構 Prompt」。這個架構將會交由另一個寫手 AI 來撰寫真正的文章。

**極重要規則：國中教育會考的選材極度多元，包含了各種「連續文本」與「非連續文本」。您每次的回覆必須「完全顛覆」上一次的風格！**
請從以下【會考常見題材與文本形式】中，**隨機且跳躍式地挑選**（絕對不要重複常見的今昔對比或夾敘夾議）：
1. **生活應用類 (應用文/圖表)**：例如：產品使用說明書、活動海報、車班時刻表與購票須知、網路論壇的問答留言板、商品廣告文案、博物館導覽摺頁。
2. **科學與紀實類 (說明文)**：例如：動物行為觀察報告、氣象與星象觀測紀錄、醫學與健康常見迷思解析、歷史檔案解密、地理景觀成因剖析。
3. **文學與哲理 (記敘/抒情/議論)**：例如：翻譯小說的片段對比、現代詩歌與流行歌詞的賞析、人物傳記的某個小故事、生活中的微小哲學發現、針對某個校園現象的辯論投書。
${formatReq}${contentTypeReq}${difficultyReq}。

請直接回傳一份針對「寫手 AI」的指令框架（純文字，不需 Markdown 語法或程式碼塊），內容請涵蓋以下三個面向，格式請使用條列式：

核心主題與文本類型：(例如：是一份「外星人參觀地球的動線說明書」、還是一段「講述微塑膠危害的論壇對話」、或是一首「關於夏日午後的現代散文詩」？)
語氣與視角：(請搭配上述文本類型。例如：公家機關的生硬語氣、青少年的網路用語白話文、或是浪漫主義詩人的口吻)
寫作手法與結構設計：(請完全拋棄八股文結構！如果是說明書，結構就是「條列步驟與警告事項」；如果是論壇，結構就是「一問多答」；如果是海報，就是「斗大標題與時間地點」。請直接告訴寫手 AI 該如何切分這個特殊的版面！)`;

    return await callGenerativeAI(prompt);
}

/**
 * 為貼入的文章生成試題
 */
export async function generateQuestionsFromText(title, article, tags) {
    const prompt = `針對此篇章設計 5 道 PISA 閱讀素養單選題：\n《${title}》\n文章：${article}\n要求：第1題擷取，2-3統整，4-5省思。選項位置隨機。回傳 JSON。`;
    const schema = {
        type: "OBJECT",
        properties: {
            questions: {
                type: "ARRAY", items: {
                    type: "OBJECT", properties: {
                        questionText: { type: "STRING" },
                        options: { type: "ARRAY", items: { type: "STRING" } },
                        correctAnswerIndex: { type: "NUMBER" },
                        explanation: { type: "STRING" }
                    }, required: ["questionText", "options", "correctAnswerIndex", "explanation"]
                }
            },
            tags: { type: "OBJECT", properties: { format: { type: "STRING" }, contentType: { type: "STRING" }, difficulty: { type: "STRING" } } }
        },
        required: ["questions", "tags"]
    };

    const res = await callGenerativeAI(prompt, null, schema, 'teacher');
    return JSON.parse(res);
}

/**
 * 文章改寫潤飾
 */
export async function rewriteArticle(articleText, command) {
    const prompt = `請根據以下指令，潤飾這篇文稿。\n請嚴格遵守以下格式要求：\n1. **輸出格式**：請只輸出潤飾後的文稿全文，不要包含任何額外的說明或標題。\n2. **段落縮排**：所有文字段落（包含第一段）的開頭都必須加上兩個全形空格「　　」來進行縮排。\n\n指令："""${command}"""\n原文："""${articleText}"""`;
    return await callGenerativeAI(prompt);
}

/**
 * 完整文章解析（心智圖 + 深度解析 + 思考題）
 */
export async function generateFullAnalysis(articleText) {
    const prompt = `你是一位專業的國文老師，擅長針對文章進行深入分析。請為以下文章提供三項資訊：

          文章內容：
          """
          ${articleText}
          """

          請嚴格按照以下 JSON 格式回傳，不要有任何其他的文字或解釋：
          {
            "mindmap": "一個 Mermaid.js 的 mindmap格式的心智圖。請確保語法絕對正確，擷取文章重點即可，節點不要過多，節點文字六字內，第一層儘量不超過5個節點，第一層標上數字順序（如:①開頭），避免使用任何特殊字元或引號。語法生成從mindmap開始，不用生成mermaid",
            "explanation": "一篇 300 字左右的短文，對象是國中生，深入解析這篇文章的主旨、結構、寫作技巧與文化寓意。請以純文字格式撰寫，段落之間用換行分隔，重點處使用 Markdown 的 **粗體** 語法強調。不要長篇大論，要簡明易讀。",
            "thinking_questions": "一個 Markdown 格式的無序清單，提供三個與文章主題相關、能引導學生進行深度探究的思考題。問題應連結學生的生活經驗或引發思辨，且不應提供標準答案。不要長篇大論，要簡明易讀。"
          }`;

    const rawText = await callGenerativeAI(prompt);
    const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanedText);
}

/**
 * 單一資訊重新生成或潤飾 (移植自 callSingleGeminiAnalysis)
 */
export async function generateSingleInfo(articleText, target, action = 'regenerate', originalContent = '', refinePrompt = '') {
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

    const res = await callGenerativeAI(prompt);
    return target === 'mindmap' ? res.replace(/```mermaid/g, "").replace(/```/g, "").trim() : res;
}

/**
 * 整理優化文本 (移植自 teacher.js)
 */
export async function formatText(rawText) {
    if (!rawText.trim()) return rawText;

    const prompt = `你是一位專業且細心的中文文本編輯。你的唯一任務是根據以下規則，清理並優化使用者提供的文本，不做任何內容上的增刪或修改。

# 編輯規則 (必須嚴格遵守):
1.  **段落排版**: 在每一個自然段落的開頭，加上兩個全形空格 "　　" 作為縮排。段落之間空一行。
2.  **標點符號標準化**: 將文本中所有的半形標點符號轉換為對應的全形版本。
3.  **引號**: 使用「」與『』。
4.  **移除亂碼**: 移除無意義字元。
5.  **保留換行**: 保留原文換行。

# 輸出要求:
* **絕對不要**回覆任何除了整理後文本以外的內容。

待處理文本：
"""
${rawText}
"""`;

    return await callGenerativeAI(prompt);
}

/**
 * AI 求救引導
 */
export async function generateAiHelp(article, questions, userAnswers) {
    const wrongs = questions.map((q, i) => {
        if (userAnswers[i] === q.correctAnswerIndex) return null;
        return `【第 ${i + 1} 題】\n題目：${q.questionText}\n選項：\n${q.options.map((opt, j) => `  ${String.fromCharCode(65 + j)}. ${opt}`).join('\n')}\n學生選擇：${q.options[userAnswers[i]] || '未作答'}`;
    }).filter(Boolean).join('\n\n');

    if (!wrongs) return '恭喜全部答對！';

    const prompt = `你是一位鼓勵型的國文助教。學生答錯題目，請依據文章給予思考方向引導（不直接給答案）。每題2-3句。文章前3000字：\n${article.substring(0, 3000)}\n錯題：\n${wrongs}\n請用 Markdown 回覆。`;
    return await callGenerativeAI(prompt, null, null, 'student');
}
