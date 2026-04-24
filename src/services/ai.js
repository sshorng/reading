import { useAuthStore } from '../stores/auth';

/**
 * 核心 AI 調用函數
 * @param {string} prompt 
 * @param {string|null} modelOverride 
 * @param {object|null} schema 
 * @param {string} type 'teacher' 或 'student'
 * @param {number} temperature 創意發想時可調高，預設 0.5 維持試煉穩定度
 */
export async function callGenerativeAI(prompt, modelOverride = null, schema = null, type = 'teacher', temperature = 0.5) {
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
        temperature: temperature,
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
                return `*   **文章風格**: 詞彙具體，以常用字為主（符合台灣教育部頒布之常用字標準）。句式簡短，多為單句或簡單複句。主題貼近日常生活經驗。篇幅約 500-800 字。\n*   **試題風格**: 題目多為「擷取與檢索」層次，答案可直接在文章中找到。選項與原文用字高度相似。`;
            case '基礎':
                return `*   **文章風格**: 詞彙淺白易懂，句式以簡單複句為主。主題明確，結構為總分總。篇幅約 700-1000 字。\n*   **試題風格**: 題目以「擷取與檢索」和淺層的「統整與解釋」為主，需要對段落進行簡單歸納。`;
            case '普通':
                return `*   **文章風格**: **以「台灣國中教育會考國文科」的平均難度為基準**。詞彙量適中，包含少量成語或較正式的書面語。句式長短錯落，開始出現較複雜的從屬句。主題可能涉及社會、自然、人文等領域。篇幅約 800-1200 字。\n*   **試題風格**: 題目均衡分佈於 PISA 三層次，特別著重「統整與解釋」，需要理解段落主旨、文意轉折。`;
            case '進階':
                return `*   **文章風格**: 詞彙量豐富，包含較多抽象詞彙、成語及修辭技巧。句式複雜，多長句和多層次的複句。主題可能具有思辨性或專業性。篇幅約 1000-1500 字。\n*   **試題風格**: 題目以「統整與解釋」和「省思與評鑑」為主，需要進行跨段落的訊息整合、推論作者觀點或評論文章內容。`;
            case '困難':
                return `*   **文章風格**: 詞彙精深，可能包含少量文言詞彙或專業術語。句式精鍊且高度複雜，可能使用非線性敘事或象徵手法。主題抽象，需要讀者具備相應的背景知識。篇幅約 1200-1800 字。\n*   **試題風格**: 題目以「省思與評鑑」為主，要求批判性思考，如評鑑論點的說服力、分析寫作手法的效果，或結合自身經驗進行評價。`;
            default:
                return `*   **文章風格**: 以「台灣國中教育會考國文科」的平均難度為基準。詞彙量適中，句式長短錯落。篇幅約 800-1200 字。\n*   **試題風格**: 題目均衡分佈於 PISA 三層次。`;
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
        * **極重要：圖表內絕對不可以包含任何 HTML 標籤（如 <br>, <b>, <i> 等），否則會導致渲染失敗！** 若文字過長，請精簡文字。
        * **圖表類型**：請根據內容選擇最合適的圖表，例如用 \`xychart-beta\` 或 \`pie\` 呈現數據、用 \`flowchart\` 展示流程等。
        * **語法規則**：圖表語法需以 \`\`\`mermaid 開頭，以 \`\`\` 結尾。不能包含任何特殊字元擾亂 JSON 解析。
        * **備用方案**：如果內容不適合複雜圖表，也可以使用 GFM (GitHub Flavored Markdown) 格式的表格。`;

    const defaultContentTypeInstruction = tagContentType ? '' : `**【文體平衡警告】：若無指定文體，請「絕對避免」連續生成說明文。請優先考慮「抒情」、「記敘」或針對社會議題的「議論」，以確保教材廣度。**`;

    if (tagFormat === '圖表') {
        articleInstruction = `**請以一個主要的 Mermaid 圖表或 Markdown 表格作為文章核心**。所有文字內容應是針對此圖表的簡潔說明，重點在於測驗學生詮釋圖表資訊的能力。${mermaidInstruction}`;
    } else if (tagFormat === '圖圖分開' || tagFormat === '圖文') {
        articleInstruction = `撰寫一篇優質連續文本文章，內容需清晰、有深度、層次分明，且**務必分段**。**請務必在文章內容中，插入一個以上與主題相關、能輔助說明的 Mermaid 圖表或 Markdown 表格**，用以測驗圖文整合能力。${mermaidInstruction}`;
    } else if (tagFormat === '純文') {
        articleInstruction = `撰寫一篇優質文章，內容需清晰、有深度、層次分明，且**務必分段**。`;
    } else {
        articleInstruction = `撰寫一篇優質文章，內容需清晰、有深度、層次分明，且**務必分段**。請自行判斷是否需要搭配圖表，若需要，${mermaidInstruction}`;
    }
    articleInstruction += `\n${defaultContentTypeInstruction}`;

    let questionLevelInstruction = `題目層次分配如下：
        - 第 1 題：**擷取與檢索** (從文本單一或多個段落中去找出明確訊息)。
        - 第 2、3 題：**統整與解釋** (歸納段落主旨、理解代名詞所指、推論作者未明言的觀點)。
        - 第 4、5 題：**省思與評鑑** (評估文章寫作手法、將文本資訊應用於新情境、或比較不同觀點)。`;

    // 依文體切換一、三節；禁令清單（二）對所有文體通用
    const isLiterary = ['記敘', '抒情'].includes(tagContentType);
    const isAnalytical = ['說明', '議論', '應用'].includes(tagContentType);

    const stylePartOne = isAnalytical
        ? `**一、語言要求**
*   用語精確，不加文學修飾。每段開頭直接點明論點或說明對象，不需要場景鋪陳。
*   邏輯要清晰：論點 → 論據 → 小結，讀者不需要猜測你在說什麼。`
        : `**一、語言要求**
*   寫起來像真人在說話，不要像在表演寫作或參加作文比賽。`;



    const writingStyleSection = tagFormat === '圖表'
        ? `**【圖表內容寫作規範】**
圖表是本題的核心，文字只是輔助讀者理解圖表的說明工具。
*   文字量要少：全文文字說明建議控制在 150 字以內。
*   語言風格：平實、精確、客觀，像新聞導語或圖表說明文字，絕對不要文學修辭。
*   禁止：比喻、擬人、抒情描寫、場景鋪陳、任何情緒性語言。
*   禁止：長篇引言或背景介紹，直接說明圖表呈現的資訊即可。
*   結構：可以有一句「破題說明」（圖表是什麼）＋一句「重點提示」（讀者應注意什麼），就夠了。`
        : `**【核心寫作原則：請逐條內化，違者重寫】**

${stylePartOne}

**二、絕對禁止的 AI 慣用句式（每一條都是硬性禁令，所有文體適用）**
*   禁止：「不是……而是……」
*   禁止：「……讓我們……」（如「讓我們一起思考」）
*   禁止：「……值得深思」、「……發人深省」、「……令人深思」
*   禁止：「……的背後，隱藏著……」
*   禁止：「……或許，正是……的關鍵」
*   禁止：「事實上，……」作為段落起首
*   禁止：「……不僅如此，……更……」的遞進排比
*   禁止：「我們不得不……」、「我們必須承認……」
*   禁止：用「？」問句當每段結尾的萬能收尾法
*   禁止：結尾出現「所以我們要……」、「期待……」、「希望……」、「讓我們共同……」等教條式呼籲
`;

    const prompt = `你是一位為台灣國中生撰寫閱讀測驗選文的資深作家。
你的文章品質對標「國中教育會考國文科」及「品學堂 Wisdomhall」的實際選文——文字洗練、敘述自然，讓人感覺是真正的人在說話，而非機器在輸出。

主題：「${topic}」

${writingStyleSection}

目前指定條件：
1.  **篇章撰寫與排版**：
    * **標題設計**：標題必須像真正的雜誌選文，簡潔有力、令人好奇。
        - **形式多變**：純疑問句、短句衝擊、四字詞語、具體名詞短語都可以。
        - **禁令**：禁止「前半段隱喻：後半段解釋」的冒號格式（如「光的旅途：論……」）；禁止內容農場式標題。
    * **所有連續文本文字段落（包含第一段）的開頭都必須加上兩個全形空格「　　」來進行縮排。如果是詩歌體則不用。**
    * **連續文本文字段落間請務必空一行。**
    * ${styleInstruction}
    * **難度指引**:
${difficultyInstruction}
    * ${articleInstruction}
    * **絕不使用圖片或圖片語法**。
2.  **標籤要求**（若未特別指定，請依據您產生內容的實際狀況自主填入最恰當的屬性）：
    * **形式**: ${tagFormat ? `請生成「${tagFormat}」形式的內容（必須為 ${tagFormat}）。` : `請自行判斷最適當的形式，於標籤填入「純文」、「圖文」或「圖表」（絕對不可使用英文，如 pure_text 等）。`}
    * **內容**: ${tagContentType ? `請生成「${tagContentType}」類型的內容（必須為 ${tagContentType}）。` : `請自行判斷最適當的文體，於標籤填入「記敘」、「抒情」、「說明」、「議論」或「應用」（絕對不可使用非此五類之詞彙）。`}
    * **難度**: ${tagDifficulty ? `請生成「${tagDifficulty}」難度的內容，並將此難度作為標籤。` : `請自行決定最適當的難度，於標籤填入「簡單」、「基礎」、「普通」、「進階」或「困難」。`}
3.  **產出格式**：請嚴格按照指定的 JSON 格式輸出，不要包含 JSON 格式以外的任何文字。`;

    const schema = {
        type: "OBJECT",
        properties: {
            title: { type: "STRING" },
            article: { type: "STRING" },
            tags: {
                type: "OBJECT", properties: {
                    format: { type: "STRING", enum: ["純文", "圖文", "圖表"] },
                    contentType: { type: "STRING", enum: ["記敘", "抒情", "說明", "議論", "應用"] },
                    difficulty: { type: "STRING", enum: ["簡單", "基礎", "普通", "進階", "困難"] }
                }, required: ["format", "contentType", "difficulty"]
            }
        },
        required: ["title", "article", "tags"]
    };

    // 文章生成調高 temperature 至 0.85，避免句式模板化
    const res = await callGenerativeAI(prompt, null, schema, 'teacher', 0.85);
    return JSON.parse(res);
}

/**
 * 💡 AI 靈感發想（極簡化：PISA 素養導向與品學堂風格自由發揮）
 */
export async function generateTopicIdea(topic, tags) {
    const formatReq = tags?.format ? `，形式須包含「${tags.format}」` : '';
    const contentTypeReq = tags?.contentType ? `，文體偏好「${tags.contentType}」` : '';
    const difficultyReq = tags?.difficulty ? `，難度約在「${tags.difficulty}」` : '';

    // 🔥 隨機「軟性切入點」(Soft Random Seed)：破除 LLM 每次都講科技冷漠的死板慣性
    const randomAngles = [
        "社會階級與資源分配的隱形角落",
        "流行次文化(動漫、迷因)背後的心理學",
        "大腦陷阱與行為經濟學的日常體現",
        "科技發展與人際邊界的模糊地帶",
        "歷史事件在現代社會的荒謬重演",
        "自然生態法則對人類社會的微觀啟示",
        "日常物品背後的設計哲學與文化霸權",
        "跨國文化對於『時間』與『空間』的異度理解",
        "當代媒體與眼球經濟下的『真實』定義",
        "性別、年齡或族群刻板印象的微歧視現象"
    ];
    const pickedAngle = randomAngles[Math.floor(Math.random() * randomAngles.length)];

    const prompt = `你是一位為台灣國中生設計閱讀測驗選文的資深編輯。
你的文章品質對標「國中教育會考國文科」選文及「品學堂 Wisdomhall」——敘述自然、有人的溫度，而非機器輸出的模板感。

你的任務：為「寫手 AI」發想一份有血有肉的閱讀文本靈感提案。

主題方向：${topic ? `「${topic}」` : '請自由發揮一個讓人眼睛一亮的國中閱讀素養主題。'}
👉 本次請優先從「${pickedAngle}」的角度切入，但需自然融入，不要生硬點出該詞彙。
${formatReq}${contentTypeReq}${difficultyReq}

【提案格式要求】
直接回傳純文字提案，不要問候語、不要 Markdown、不要程式碼塊。條列以下三問：

寫什麼：(一個具體的切入場景或人物，讓讀者知道這篇文章在說什麼；不超過三句話)
文體大方向：(記敘／說明／議論／抒情，一句話說明理由即可；不要設計行文節奏或每一段的走法)
本題最容易踩的 AI 陷阱：(直接列出寫手最容易出現的一兩個具體壞習慣，例如「用大詞替代細節」或「結尾突然說教」，讓寫手知道要刻意避開什麼)
    `;

    // 拉高 temperature (0.9) 釋放創造力，避免產出重複枯燥的提案
    return await callGenerativeAI(prompt, null, null, 'teacher', 0.9);
}

/**
 * 為貼入的文章生成試題
 */
export async function generateQuestionsFromText(title, article, tags) {
    const questionLevelInstruction = `【題型與 PISA 閱讀理解層次要求】
    - 第 1 題：**擷取與檢索**。考驗學生從複雜文本中「精準定位資訊」。
    - 第 2 題：**統整與解釋 (微觀)**。考驗「歸納單一或跨段落的主旨」，或理解隱喻與代名詞的真實意涵。
    - 第 3 題：**統整與解釋 (宏觀)**。考驗「推論作者的核心觀點或未言明的前提」。
    - 第 4 題：**省思與評鑑 (形式與寫作)**。考驗「分析寫作手法與結構安排的目的」。例如：「作者為何在此處插入這個案例？有何用意？」
    - 第 5 題：**省思與評鑑 (內容與真實世界應用)**。這題最具挑戰性！請設計一個「外部生活情境」或「相反觀點」，要求學生運用文章中的知識或邏輯來判斷、解決該情境。例如：「若根據本文的結論，下列哪一個真實社會現象是作者最可能批評的？」`;

    const examStyleInstruction = `【選項設計規範：極度重要，請呈現『品學堂』般的高品質誘答】
    - 錯誤選項必須精準反映學生的「閱讀迷思」（如：只看字面意思忽略語境、將局部當成全部、倒果為因、過度衍伸）。
    - 錯誤選項不可有明顯的語法錯誤或荒謬邏輯，必須具備高度「似是而非」的誘答力。
    - 每題四個選項長度應相近，避免「最長選項是答案」的規律。
    - 正確答案在四個選項中的位置必須隨機分布（0, 1, 2, 3）。`;

    const prompt = `你現在是台灣「PISA 閱讀素養測試」與「品學堂 (Wisdomhall)」首席命題大師，專門設計能刺激國中生思辨的靈活考題。
    請根據以下文本，設計出一份高鑑別度、絕不流於死背或單純找字的 5 題單選題測驗。
    所有試題難度應落在「中偏難（素養應用題為主）」。

    文本標題：《${title}》
    文本內容：
${article}

    請嚴格遵循以下命題規範：
    1. ${questionLevelInstruction}
    2. ** 試題必須是素養導向的 **，旨在考驗學子的歸納、分析、批判與應用能力，而非僅是記憶。
    3. ** 試題必須是客觀題，答案能直接或間接從文本中找到，絕不可出現『你認為』、『你覺得』等開放式問句。**
        4. ${examStyleInstruction}
    5. ** 答題解析要求 **：每題的 explanation 必須包含：(1) 明確說明正確答案的原因並引用原文佐證(2) 逐一解釋其他三個選項為何錯誤
    6. ** 標籤識別(極重要) **：請根據您對該文章的理解，從以下預定義選項中選擇最契合的屬性填入 JSON 的 tags 欄位：
       - format (形式): 「純文」、「圖文」或「圖表」。
       - contentType (內容): 「記敘」、「抒情」、「說明」、「議論」或「應用」。
       - difficulty (難度): 「簡單」、「基礎」、「普通」、「進階」或「困難」。
    7. ** 輸出限制 **：請嚴格返回 JSON 格式，不要包含 \`\`\`json 標籤外的任何廢話。`;
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
    const prompt = `你是一位專業中文編輯，任務是依據指令潤飾文稿，使其更接近「國中教育會考」選文的語言品質——自然、洗練、有人的溫度。

【硬性禁令：以下句式一律不得出現在潤飾結果中】
- 「不是……而是……」
- 「讓我們……」
- 「值得深思」、「發人深省」
- 「……的背後，隱藏著……」
- 「……或許，正是……的關鍵」
- 「事實上，……」作為段落起首
- 「不僅如此，……更……」的遞進排比
- 「所以我們要……」、「期待……」、「希望……」等結尾教條

【格式要求】
1. 只輸出潤飾後的文稿全文，不要包含任何說明或標題。
2. 所有文字段落（含第一段）的開頭加上兩個全形空格「　　」縮排。
3. 段落之間空一行。

指令："""${command}"""
原文："""${articleText}"""`;
    return await callGenerativeAI(prompt, null, null, 'teacher', 0.7);
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
            "explanation": "一篇 300 字左右的短文，對象是國中生，深入解析這篇文章的主旨、結構、寫作技巧與文化寓意。請以純文字格式撰寫，段落之間用換行分隔，重點處使用 Markdown 的 **粗體** 語法強調。**禁止使用『不是……而是……』這類 AI 味重的句型**，要簡明易讀且具備專業感。",
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
        explanation: "一篇 300 字左右的短文，對象是國中生，深入解析這篇文章的主旨、結構、寫作技巧與文化寓意。請以純文字格式撰寫，段落之間用換行分隔，重點處使用 Markdown 的 **粗體** 語法強調。**禁止使用『不是……而是……』這類 AI 味重的句型**，要簡明易讀且具備專業感。",
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
