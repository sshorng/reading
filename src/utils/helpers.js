// Utilities from utils.js porting
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

export async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getLocalDateString(date) {
    if (!date || isNaN(date.getTime())) return '';
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, -1);
    return localISOTime.split('T')[0];
}

export function toValidDate(d) {
    if (!d) return null;
    let date = null;
    if (d instanceof Date) {
        date = d;
    } else if (d.toDate && typeof d.toDate === 'function') {
        date = d.toDate();
    } else if (typeof d.seconds === 'number') {
        date = new Date(d.seconds * 1000 + (d.nanoseconds || 0) / 1000000);
    } else {
        date = new Date(d);
    }
    return (date && !isNaN(date.getTime())) ? date : null;
}

export function formatSubmissionTime(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('zh-TW', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
}

export function markdownToHtml(text) {
    if (typeof text !== 'string' || !text) return '';

    let src = text.replace(/\r\n/g, '\n');

    const mermaidBlocks = [];
    src = src.replace(/```mermaid([\s\S]*?)```/g, (_, code) => {
        const idx = mermaidBlocks.length;
        const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
        mermaidBlocks.push(`<div class="mermaid" style="white-space: pre;">${escaped}</div>`);
        return `\n__MERMAID_${idx}__\n`;
    });

    // 2. Extract table blocks (contiguous lines starting/ending with |)
    const tableBlocks = [];
    src = src.replace(/((?:^\|.+\|[ \t]*\n?)+)/gm, (match) => {
        const rows = match.trim().split('\n').filter(r => r.trim());
        if (rows.length === 0) return match;

        // Check for separator row
        const sepIdx = rows.findIndex(r => /^\|[\s:|-]+\|$/.test(r.trim()));
        let headerRows, bodyRows;
        if (sepIdx >= 0) {
            headerRows = rows.slice(0, sepIdx);
            bodyRows = rows.slice(sepIdx + 1);
        } else {
            headerRows = [rows[0]];
            bodyRows = rows.slice(1);
        }

        const parseRow = r => r.split('|').slice(1, -1).map(c => c.trim());
        const fmt = t => t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        let h = '<div class="my-6 overflow-x-auto rounded-lg border border-slate-200 shadow-sm"><table class="min-w-full divide-y divide-slate-200">';
        h += '<thead class="bg-slate-50">';
        headerRows.forEach(r => {
            const cols = parseRow(r);
            if (cols.length) h += '<tr>' + cols.map(c => `<th class="px-4 py-2.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">${fmt(c)}</th>`).join('') + '</tr>';
        });
        h += '</thead><tbody class="bg-white divide-y divide-slate-100">';
        bodyRows.forEach((r, i) => {
            const bg = i % 2 === 0 ? '' : ' class="bg-slate-50/50"';
            const cols = parseRow(r);
            if (cols.length) h += `<tr${bg}>` + cols.map(c => `<td class="px-4 py-2 text-sm text-slate-700">${fmt(c)}</td>`).join('') + '</tr>';
        });
        h += '</tbody></table></div>';

        const idx = tableBlocks.length;
        tableBlocks.push(h);
        return `\n__TABLE_${idx}__\n`;
    });

    // 3. Line-by-line processing
    const lines = src.split('\n');
    let html = '';
    let inList = null;
    let paragraphCounter = 1;

    const closeList = () => {
        if (inList === 'ul') html += '</ul>';
        else if (inList === 'ol') html += '</ol>';
        inList = null;
    };

    const bold = t => t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    for (const line of lines) {
        const t = line.trim();
        if (!t) { closeList(); continue; }

        // Placeholders
        let m;
        if ((m = t.match(/^__MERMAID_(\d+)__$/))) { closeList(); html += mermaidBlocks[+m[1]]; continue; }
        if ((m = t.match(/^__TABLE_(\d+)__$/))) { closeList(); html += tableBlocks[+m[1]]; continue; }

        // Headings (# style)
        if ((m = t.match(/^(#{1,4})\s+(.*)/))) {
            closeList();
            const lvl = m[1].length;
            const cls = { 1: 'text-2xl font-bold mb-5 mt-7 text-slate-900 border-b pb-2', 2: 'text-xl font-bold mb-4 mt-6 text-slate-800 border-l-4 border-red-800 pl-3', 3: 'text-lg font-bold mb-3 mt-5 text-slate-800', 4: 'text-base font-semibold mb-2 mt-4 text-slate-700' }[lvl];
            html += `<h${lvl} class="${cls}">${bold(m[2])}</h${lvl}>`;
            continue;
        }

        // Headings (Chinese: 一、...)
        if ((m = t.match(/^([一二三四五六七八九十]+、)\s*(.*)/))) {
            closeList();
            html += `<h3 class="text-lg font-bold mb-3 mt-6 text-slate-800 border-l-4 border-red-800 pl-3">${bold(m[1] + m[2])}</h3>`;
            continue;
        }

        // Horizontal rule
        if (/^[-*_]{3,}$/.test(t)) { closeList(); html += '<hr class="my-6 border-t border-slate-200">'; continue; }

        // Unordered list
        if ((m = t.match(/^[*-]\s+(.*)/))) {
            if (inList !== 'ul') { closeList(); html += '<ul class="list-disc list-inside my-3 space-y-1.5 text-slate-700 ml-2">'; inList = 'ul'; }
            html += `<li>${bold(m[1])}</li>`;
            continue;
        }

        // Ordered list
        if ((m = t.match(/^(\d+)\.\s+(.*)/))) {
            if (inList !== 'ol') { closeList(); html += '<ol class="list-decimal list-inside my-3 space-y-1.5 text-slate-700 ml-2">'; inList = 'ol'; }
            html += `<li>${bold(m[2])}</li>`;
            continue;
        }

        // Blockquote
        if (t.startsWith('>')) {
            closeList();
            html += `<blockquote class="border-l-4 border-slate-300 pl-4 py-1 text-slate-500 italic my-3 bg-slate-50/50 rounded-r">${bold(t.replace(/^>\s*/, ''))}</blockquote>`;
            continue;
        }



        // Normal paragraph
        closeList();
        const indent = line.startsWith('　　');
        let processed = bold(t).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-red-700 hover:underline font-bold">$1</a>');

        if (indent) {
            html += `<div class="relative mb-4"><p style="text-indent:2em;line-height:1.8">${processed}</p><span class="text-slate-300 text-[10px] select-none absolute left-0 top-1">${paragraphCounter++}</span></div>`;
        } else {
            html += `<p class="mb-3" style="line-height:1.8">${processed}</p>`;
        }
    }

    closeList();
    return html;
}
