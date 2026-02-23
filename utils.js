export function el(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    for (const key in attributes) {
        if (key === 'textContent') {
            element.textContent = attributes[key];
        } else if (key === 'innerHTML') {
            element.innerHTML = attributes[key];
        } else if (key.startsWith('on') && typeof attributes[key] === 'function') {
            element.addEventListener(key.substring(2).toLowerCase(), attributes[key]);
        }
        else {
            element.setAttribute(key, attributes[key]);
        }
    }
    if (typeof children === 'function') {
        children(element);
    } else if (Array.isArray(children)) {
        for (const child of children) {
            if (child === null || child === undefined) continue;
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof HTMLElement) {
                element.appendChild(child);
            }
        }
    } else if (typeof children === 'string') {
        element.appendChild(document.createTextNode(children));
    } else if (children instanceof HTMLElement) {
        element.appendChild(children);
    }
    return element;
}

export function updateElement(parent, newNode, oldNode) {
    if (!oldNode) {
        parent.appendChild(newNode);
    } else if (!newNode) {
        parent.removeChild(oldNode);
    } else if (newNode.nodeType === Node.TEXT_NODE && oldNode.nodeType === Node.TEXT_NODE) {
        if (newNode.textContent !== oldNode.textContent) {
            oldNode.textContent = newNode.textContent;
        }
    } else if (newNode.tagName !== oldNode.tagName) {
        parent.replaceChild(newNode, oldNode);
    } else {
        // Update attributes
        const oldAttrs = oldNode.attributes;
        const newAttrs = newNode.attributes;

        for (let i = oldAttrs.length - 1; i >= 0; i--) {
            const { name } = oldAttrs[i];
            if (!newNode.hasAttribute(name)) {
                oldNode.removeAttribute(name);
            }
        }

        for (let i = 0; i < newAttrs.length; i++) {
            const { name, value } = newAttrs[i];
            if (oldNode.getAttribute(name) !== value) {
                oldNode.setAttribute(name, value);
            }
        }

        // Update children
        const newChildren = Array.from(newNode.childNodes);
        const oldChildren = Array.from(oldNode.childNodes);
        const maxLength = Math.max(newChildren.length, oldChildren.length);

        for (let i = 0; i < maxLength; i++) {
            updateElement(oldNode, newChildren[i], oldChildren[i]);
        }
    }
}

export const escapeHtml = (unsafe) => unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

export function normalizeClassName(className) {
    if (!className) return "";
    const numMap = { '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9' };
    const digitsOnly = className.replace(/[一二三四五六七八九]/g, match => numMap[match]).replace(/\D/g, '');
    return digitsOnly;
}

export function generateDefaultPassword(className, seatNumber) {
    const normalizedClass = normalizeClassName(className);
    const formattedSeat = String(seatNumber).padStart(2, '0');
    return `${normalizedClass}${formattedSeat}`;
}

export function markdownToHtml(text) {
    // Ensure input is a string to prevent .replace errors
    if (typeof text !== 'string' || !text) {
        return '';
    }

    // Regex to find mermaid blocks, allowing for nested content and empty lines.
    const mermaidRegex = /```mermaid([\s\S]*?)```/g;
    const placeholders = [];
    let placeholderId = 0;

    // 1. Replace all mermaid blocks with placeholders
    const textWithPlaceholders = text.replace(mermaidRegex, (match, mermaidContent) => {
        const placeholder = `__MERMAID_PLACEHOLDER_${placeholderId++}__`;
        // HTML-escape the mermaid content so the browser doesn't interpret
        // characters like <, >, & as HTML tags (preserves original syntax).
        // textContent will still return the correct decoded characters.
        const escaped = mermaidContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        placeholders.push(`<div class="mermaid" style="white-space: pre;">${escaped}</div>`);
        return placeholder;
    });

    // 2. Process the rest of the text as before
    const blocks = textWithPlaceholders.split(/(\n\s*\n)/); // Split by one or more empty lines
    let html = '';
    let paragraphCounter = 1;

    blocks.forEach(block => {
        if (block.trim() === '') return;

        // Check if the block is a placeholder
        if (block.trim().startsWith('__MERMAID_PLACEHOLDER_')) {
            const id = parseInt(block.trim().replace('__MERMAID_PLACEHOLDER_', '').replace('__', ''));
            html += placeholders[id];
            return;
        }

        const hasIndent = block.startsWith('　　');
        let trimmedBlock = block.trim();

        // Table processing
        if (trimmedBlock.startsWith('|') && trimmedBlock.includes('|')) {
            let tableHtml = '';
            const lines = trimmedBlock.split('\n');
            if (lines.length > 1 && lines[1].match(/\| *(:?-+:?|---) *\|/)) {
                const headers = lines[0].split('|').map(h => h.trim()).slice(1, -1);
                const rows = lines.slice(2);
                tableHtml = '<div class="my-6 overflow-x-auto"><table class="min-w-full border border-slate-300 divide-y divide-slate-200"><thead class="bg-slate-50">';
                tableHtml += `<tr>${headers.map(h => `<th class="px-4 py-2 text-left text-sm font-medium text-slate-600">${h.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</th>`).join('')}</tr></thead>`;
                tableHtml += '<tbody class="bg-white divide-y divide-slate-200">';
                rows.forEach(rowLine => {
                    if (rowLine.trim() === '') return;
                    const cells = rowLine.split('|').map(c => c.trim()).slice(1, -1);
                    tableHtml += `<tr>${cells.map(c => `<td class="px-4 py-2 text-sm text-slate-700">${c.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</td>`).join('')}</tr>`;
                });
                tableHtml += '</tbody></table></div>';
                html += tableHtml;
                return;
            }
        }

        // Heading processing
        if (trimmedBlock.startsWith('#### ')) { html += `<h4 class="text-lg font-bold mb-3 mt-5">${trimmedBlock.substring(5).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</h4>`; return; }
        if (trimmedBlock.startsWith('### ')) { html += `<h3 class="text-xl font-bold mb-4 mt-6">${trimmedBlock.substring(4).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</h3>`; return; }
        if (trimmedBlock.startsWith('## ')) { html += `<h2 class="text-2xl font-bold mb-4 mt-8 border-b pb-2">${trimmedBlock.substring(3).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</h2>`; return; }
        if (trimmedBlock.startsWith('# ')) { html += `<h1 class="text-3xl font-bold mb-6 mt-8">${trimmedBlock.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</h1>`; return; }

        // List processing
        if (trimmedBlock.match(/^\d+\.\s/m)) { // Check for ordered list (e.g., "1. ")
            html += '<ol class="list-decimal list-inside my-4 space-y-4">'; // Increased space-y for better readability
            // Split by newline that is followed by a number and a dot (e.g., "1. ")
            trimmedBlock.split(/\n(?=\d+\.\s)/).forEach(item => {
                const trimmedItem = item.trim();
                if (trimmedItem.match(/^\d+\.\s/)) {
                    let listItemContent = trimmedItem.substring(trimmedItem.indexOf('.') + 1).trim();
                    // Process newlines within a list item as <br>
                    listItemContent = listItemContent
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-red-700 hover:underline">$1</a>')
                        .replace(/\n/g, '<br>');
                    html += `<li class="pl-2">${listItemContent}</li>`;
                }
            });
            html += '</ol>';
            return;
        }
        if (trimmedBlock.startsWith('* ') || trimmedBlock.startsWith('- ')) {
            html += '<ul class="list-disc list-inside my-4 space-y-2">';
            trimmedBlock.split('\n').forEach(item => {
                let listItemContent = item.substring(item.indexOf(' ') + 1);
                listItemContent = listItemContent
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-red-700 hover:underline">$1</a>');
                html += `<li>${listItemContent}</li>`;
            });
            html += '</ul>';
            return;
        }

        // Paragraph processing
        let processedContent = trimmedBlock
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-red-700 hover:underline">$1</a>')
            .replace(/\n/g, '<br>');

        if (hasIndent) {
            html += `<div style="position: relative; margin-bottom: 1rem;">` +
                `<p class="prose-custom" style="margin: 0; text-indent: 2em;">${processedContent}</p>` +
                `<span class="text-gray-400 text-xs select-none" style="position: absolute; left: 0; top: 0.7em;">${paragraphCounter++}</span>` +
                `</div>`;
        } else {
            html += `<p class="prose-custom">${processedContent}</p>`;
        }
    });

    return html;
}

export function formatSubmissionTime(timestamp) {
    if (!timestamp || !timestamp.toDate) return '';
    const date = timestamp.toDate();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `(${month}/${day} ${hours}:${minutes})`;
}

export function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function getLocalDateString(date) {
    const d = date; // Use the passed-in date object
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
