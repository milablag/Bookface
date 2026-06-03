// static/js/pdf_viewer.js — PDF читалка на базе PDF.js (canvas рендеринг)
'use strict';

// ========== СОСТОЯНИЕ ==========
let pdfDoc        = null;
let currentPage   = 1;
let totalPages    = 0;
let pdfBookId     = null;
let pdfScale      = 1.0;
let currentMode   = null; // 'pdf' | 'md'

// MD режим
let mdBookId      = null;
let mdBookTitle   = '';
let mdBookAuthor  = '';
let mdCurrentPage = 1;
let mdTotalPages  = 0;
let mdFontSize    = 18;
let mdPages       = [];

// ========== PDF.js загрузчик ==========
function loadPDFJS() {
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(window.pdfjsLib);
        };
        script.onerror = () => {
            // Fallback to older version
            const s2 = document.createElement('script');
            s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
            s2.onload = () => {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                resolve(window.pdfjsLib);
            };
            s2.onerror = reject;
            document.head.appendChild(s2);
        };
        document.head.appendChild(script);
    });
}

// ========== PDF ЧИТАЛКА (canvas-based) ==========
async function openPDFViewer(pdfUrl, bookTitle, bookAuthor, bookId) {
    currentMode = 'pdf';
    pdfBookId   = bookId || null;

    const modal = document.getElementById('readerModal');
    if (!modal) return;

    // Переключаем модалку в PDF-режим (canvas)
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    document.getElementById('readerBookTitle').textContent  = bookTitle  || 'Книга';
    document.getElementById('readerBookAuthor').textContent = bookAuthor || '';

    const loadingDiv   = document.getElementById('readerLoading');
    const pagesDiv     = document.getElementById('readerPagesContainer');
    const progressText = document.getElementById('loadingProgress');

    if (loadingDiv) loadingDiv.style.display = 'flex';
    if (pagesDiv)   pagesDiv.style.display   = 'none';

    try {
        const pdfjsLib = await loadPDFJS();
        if (progressText) progressText.textContent = 'Загрузка PDF...';

        pdfDoc     = await pdfjsLib.getDocument({ url: pdfUrl, cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/', cMapPacked: true }).promise;
        totalPages = pdfDoc.numPages;

        // Загружаем сохранённый прогресс
        await loadPdfProgress();
        if (currentPage < 1) currentPage = 1;
        if (currentPage > totalPages) currentPage = totalPages;

        // Подготавливаем canvas-контейнер
        setupPdfCanvas(pagesDiv);

        if (loadingDiv) loadingDiv.style.display = 'none';
        if (pagesDiv)   pagesDiv.style.display   = 'flex';

        await renderPdfPage(currentPage);
        updatePdfInfo();

    } catch (error) {
        console.error('openPDFViewer error:', error);
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <div style="text-align:center;color:#8b3a2a;">
                    <i class="fas fa-exclamation-triangle" style="font-size:48px;margin-bottom:16px;"></i>
                    <p>Ошибка загрузки PDF: ${escHtml(error.message)}</p>
                    <button onclick="closeReader()" style="margin-top:16px;padding:10px 20px;background:#8b3a2a;color:white;border:none;border-radius:8px;cursor:pointer;">Закрыть</button>
                </div>`;
        }
    }
}

function setupPdfCanvas(container) {
    if (!container) return;
    // Меняем лэйаут на одностраничный canvas-режим
    container.style.display     = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems  = 'center';
    container.style.overflowY   = 'auto';
    container.style.background  = '#2b2b2b';
    container.innerHTML = '<canvas id="pdfCanvas" style="max-width:100%;box-shadow:0 4px 20px rgba(0,0,0,0.5);margin:20px auto;"></canvas>';
}

async function renderPdfPage(pageNum) {
    if (!pdfDoc) return;
    const canvas  = document.getElementById('pdfCanvas');
    if (!canvas) return;
    const ctx     = canvas.getContext('2d');

    const page    = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: pdfScale || 1.4 });

    canvas.width  = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;
}

function updatePdfInfo() {
    const el = (id) => document.getElementById(id);
    if (el('readerPageInfo'))    el('readerPageInfo').textContent   = `${currentPage} / ${totalPages}`;
    const pct = totalPages ? (currentPage / totalPages) * 100 : 0;
    if (el('readerProgressBar')) el('readerProgressBar').style.width = `${pct}%`;
    if (el('readerPercentage'))  el('readerPercentage').textContent  = `${Math.round(pct)}%`;
    if (el('readerPrevBtn'))     el('readerPrevBtn').disabled        = currentPage <= 1;
    if (el('readerNextBtn'))     el('readerNextBtn').disabled        = currentPage >= totalPages;
}

async function nextPdfPage() {
    if (currentPage < totalPages) {
        currentPage++;
        await renderPdfPage(currentPage);
        updatePdfInfo();
        savePdfProgress();
        // Scroll to top
        const cont = document.getElementById('readerPagesContainer');
        if (cont) cont.scrollTop = 0;
    }
}

async function prevPdfPage() {
    if (currentPage > 1) {
        currentPage--;
        await renderPdfPage(currentPage);
        updatePdfInfo();
        savePdfProgress();
        const cont = document.getElementById('readerPagesContainer');
        if (cont) cont.scrollTop = 0;
    }
}

function zoomIn() {
    pdfScale = Math.min(3.0, (pdfScale || 1.4) + 0.2);
    renderPdfPage(currentPage);
}

function zoomOut() {
    pdfScale = Math.max(0.5, (pdfScale || 1.4) - 0.2);
    renderPdfPage(currentPage);
}

async function savePdfProgress() {
    if (!pdfBookId) return;
    try {
        await fetch('/save_reading_progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                book_id:      pdfBookId,
                current_page: currentPage,
                total_pages:  totalPages,
                percentage:   totalPages ? (currentPage / totalPages) * 100 : 0,
                font_size:    Math.round(pdfScale * 10)
            })
        });
    } catch(e) { console.error('savePdfProgress:', e); }
}

async function loadPdfProgress() {
    if (!pdfBookId) return;
    try {
        const res  = await fetch(`/get_reading_progress/${pdfBookId}`);
        const data = await res.json();
        if (data.success && data.progress) {
            currentPage = data.progress.current_page || 1;
            if (data.progress.font_size) pdfScale = data.progress.font_size / 10;
        }
    } catch(e) { console.error('loadPdfProgress:', e); }
}

// ========== MD ЧИТАЛКА ==========
async function openMdReader(mdUrl, bookId, bookTitle, bookAuthor) {
    currentMode  = 'md';
    mdBookId     = bookId   || null;
    mdBookTitle  = bookTitle  || '';
    mdBookAuthor = bookAuthor || '';

    const modal = document.getElementById('readerModal');
    if (!modal) return;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    document.getElementById('readerBookTitle').textContent  = bookTitle  || 'Книга';
    document.getElementById('readerBookAuthor').textContent = bookAuthor || '';

    const loadingDiv   = document.getElementById('readerLoading');
    const pagesDiv     = document.getElementById('readerPagesContainer');
    const progressText = document.getElementById('loadingProgress');

    if (loadingDiv) loadingDiv.style.display = 'flex';
    if (pagesDiv)   pagesDiv.style.display   = 'none';

    try {
        if (progressText) progressText.textContent = 'Загрузка текста книги...';
        const res  = await fetch(mdUrl);
        const text = await res.text();

        if (progressText) progressText.textContent = 'Форматирование...';
        const html = (window.marked && typeof window.marked.parse === 'function')
            ? window.marked.parse(text)
            : basicMarkdownToHtml(text);

        mdPages      = splitHtmlIntoPages(html);
        if (mdPages.length === 0) mdPages = ['<p>Нет содержимого</p>'];
        mdTotalPages = mdPages.length;

        await loadMdProgress();
        if (mdCurrentPage < 1) mdCurrentPage = 1;
        if (mdCurrentPage > mdTotalPages) mdCurrentPage = mdTotalPages;

        // Настраиваем страничный вид
        setupMdPages(pagesDiv);

        if (loadingDiv) loadingDiv.style.display = 'none';
        pagesDiv.style.display = 'flex';

        renderMdPage();
        updateMdInfo();

    } catch (error) {
        console.error('openMdReader error:', error);
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <div style="text-align:center;color:#8b3a2a;">
                    <p>Ошибка загрузки: ${escHtml(error.message)}</p>
                    <button onclick="closeReader()" style="margin-top:16px;padding:10px 20px;background:#8b3a2a;color:white;border:none;border-radius:8px;cursor:pointer;">Закрыть</button>
                </div>`;
        }
    }
}

function setupMdPages(container) {
    if (!container) return;
    container.style.display       = 'flex';
    container.style.flexDirection = 'row';
    container.style.alignItems    = 'stretch';
    container.style.background    = '';
    container.style.overflowY     = '';
    // Восстанавливаем двухстраничный вид
    container.innerHTML = `
        <div id="leftPage" class="reader-page left-page"><div class="page-content"></div></div>
        <div id="rightPage" class="reader-page right-page"><div class="page-content"></div></div>`;
}

function splitHtmlIntoPages(html) {
    // Разбиваем по абзацам, собираем в страницы по ~2500 символов
    const CHARS_PER_PAGE = 2500;
    const parts = html.split(/(?=<h[123]>|<p>|<blockquote>)/gi).filter(p => p.trim());
    const pages = [];
    let current = '';
    for (const part of parts) {
        if (current.length + part.length > CHARS_PER_PAGE && current.length > 0) {
            pages.push(current);
            current = part;
        } else {
            current += part;
        }
    }
    if (current.trim()) pages.push(current.trim());
    return pages.length > 0 ? pages : [html];
}

function basicMarkdownToHtml(md) {
    return md
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
        .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,     '<em>$1</em>')
        .replace(/\n\n+/g, '</p><p>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');
}

function renderMdPage() {
    const leftContent  = document.querySelector('#leftPage .page-content');
    const rightContent = document.querySelector('#rightPage .page-content');
    if (!leftContent || !rightContent) return;

    const pageStyle = `font-size:${mdFontSize}px;line-height:1.7;`;

    const leftHtml = mdPages[mdCurrentPage - 1] || '<p style="color:#aaa;text-align:center;padding-top:60px;">Конец книги</p>';
    leftContent.innerHTML = `
        <div style="flex:1;${pageStyle}">${leftHtml}</div>
        <div class="page-number">— ${mdCurrentPage} —</div>`;

    const rightIdx  = mdCurrentPage;
    const rightHtml = mdPages[rightIdx] || '<p style="text-align:center;color:#a88962;padding-top:60px;">Конец книги</p>';
    rightContent.innerHTML = `
        <div style="flex:1;${pageStyle}">${rightHtml}</div>
        ${rightIdx < mdTotalPages ? `<div class="page-number">— ${rightIdx + 1} —</div>` : ''}`;
}

function nextMdPage() {
    if (mdCurrentPage + 1 <= mdTotalPages) {
        mdCurrentPage = Math.min(mdCurrentPage + 2, mdTotalPages);
        renderMdPage();
        updateMdInfo();
        saveMdProgress();
    }
}

function prevMdPage() {
    if (mdCurrentPage > 1) {
        mdCurrentPage = Math.max(1, mdCurrentPage - 2);
        renderMdPage();
        updateMdInfo();
        saveMdProgress();
    }
}

function updateMdInfo() {
    const rightNum = Math.min(mdCurrentPage + 1, mdTotalPages);
    const el = (id) => document.getElementById(id);
    if (el('readerPageInfo'))    el('readerPageInfo').textContent   = `${mdCurrentPage}–${rightNum} / ${mdTotalPages}`;
    const pct = mdTotalPages ? (mdCurrentPage / mdTotalPages) * 100 : 0;
    if (el('readerProgressBar')) el('readerProgressBar').style.width = `${pct}%`;
    if (el('readerPercentage'))  el('readerPercentage').textContent  = `${Math.round(pct)}%`;
    if (el('readerPrevBtn'))     el('readerPrevBtn').disabled        = mdCurrentPage <= 1;
    if (el('readerNextBtn'))     el('readerNextBtn').disabled        = mdCurrentPage + 1 >= mdTotalPages;
}

function changeMdFontSize(delta) {
    const newSize = mdFontSize + delta;
    if (newSize >= 12 && newSize <= 28) {
        mdFontSize = newSize;
        renderMdPage();
        saveMdProgress();
    }
}

async function saveMdProgress() {
    if (!mdBookId) return;
    try {
        await fetch('/save_reading_progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                book_id: mdBookId, current_page: mdCurrentPage,
                total_pages: mdTotalPages, percentage: mdTotalPages ? (mdCurrentPage / mdTotalPages) * 100 : 0,
                font_size: mdFontSize
            })
        });
    } catch(e) { console.error('saveMdProgress:', e); }
}

async function loadMdProgress() {
    if (!mdBookId) return;
    try {
        const res  = await fetch(`/get_reading_progress/${mdBookId}`);
        const data = await res.json();
        if (data.success && data.progress) {
            mdCurrentPage = data.progress.current_page || 1;
            mdFontSize    = data.progress.font_size    || 18;
        }
    } catch(e) { console.error('loadMdProgress:', e); }
}

// ========== ОБЩИЕ ФУНКЦИИ (единый интерфейс для JSX кнопок) ==========
function nextPage() {
    if (currentMode === 'pdf') nextPdfPage();
    else if (currentMode === 'md') nextMdPage();
}

function prevPage() {
    if (currentMode === 'pdf') prevPdfPage();
    else if (currentMode === 'md') prevMdPage();
}

function changeFontSize(delta) {
    if (currentMode === 'pdf') {
        if (delta > 0) zoomIn(); else zoomOut();
    } else {
        changeMdFontSize(delta);
    }
}

function toggleViewMode() {
    if (currentMode === 'pdf') return; // PDF не поддерживает два режима
    const container = document.getElementById('readerPagesContainer');
    const leftPage  = document.getElementById('leftPage');
    const rightPage = document.getElementById('rightPage');
    if (!container) return;
    if (container.style.flexDirection === 'column') {
        container.style.flexDirection = 'row';
        if (leftPage)  leftPage.style.maxWidth  = '45%';
        if (rightPage) rightPage.style.maxWidth = '45%';
    } else {
        container.style.flexDirection = 'column';
        if (leftPage)  leftPage.style.maxWidth  = '80%';
        if (rightPage) rightPage.style.maxWidth = '80%';
    }
}

function showGoToPageDialog() {
    const maxPage = currentMode === 'pdf' ? totalPages : mdTotalPages;
    const curPage = currentMode === 'pdf' ? currentPage : mdCurrentPage;
    const input   = prompt(`Перейти к странице (1–${maxPage}):`, curPage.toString());
    if (!input) return;
    const num = parseInt(input, 10);
    if (isNaN(num) || num < 1 || num > maxPage) {
        alert(`Введите число от 1 до ${maxPage}`);
        return;
    }
    if (currentMode === 'pdf') {
        currentPage = num;
        renderPdfPage(currentPage);
        updatePdfInfo();
        savePdfProgress();
    } else {
        mdCurrentPage = num;
        renderMdPage();
        updateMdInfo();
        saveMdProgress();
    }
}

function closeReader() {
    const modal = document.getElementById('readerModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';

    if (currentMode === 'md')  saveMdProgress();
    if (currentMode === 'pdf') savePdfProgress();

    currentMode   = null;
    pdfDoc        = null;
    pdfBookId     = null;
    mdBookId      = null;
    mdPages       = [];
    mdCurrentPage = 1;
    mdTotalPages  = 0;
    currentPage   = 1;
    totalPages    = 0;
}

function escHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

// ========== КЛАВИАТУРА ==========
document.addEventListener('keydown', function(event) {
    const modal = document.getElementById('readerModal');
    if (!modal || (modal.style.display !== 'flex' && modal.style.display !== 'block')) return;
    switch(event.key) {
        case 'ArrowLeft':   prevPage();           event.preventDefault(); break;
        case 'ArrowRight':  nextPage();           event.preventDefault(); break;
        case 'Escape':      closeReader();        event.preventDefault(); break;
        case '+': case '=': changeFontSize(1);   event.preventDefault(); break;
        case '-':           changeFontSize(-1);  event.preventDefault(); break;
        case 'g': case 'G': showGoToPageDialog(); event.preventDefault(); break;
    }
});

// ========== ЭКСПОРТ ==========
window.openPDFViewer      = openPDFViewer;
window.openMdReader       = openMdReader;
window.nextPage           = nextPage;
window.prevPage           = prevPage;
window.changeFontSize     = changeFontSize;
window.toggleViewMode     = toggleViewMode;
window.showGoToPageDialog = showGoToPageDialog;
window.closeReader        = closeReader;
