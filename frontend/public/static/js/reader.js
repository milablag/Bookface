// static/js/reader.js

let readerBookId = null;
let readerBookTitle = '';
let readerBookAuthor = '';
let readerCurrentSpread = 1; // Текущий разворот (страницы 1-2, 3-4, ...)
let readerTotalSpreads = 0;
let readerPages = [];
let readerCurrentFontSize = 16;
let readerPdfUrl = null;
let readerPdfDoc = null;
let readerPageHeight = 0;
let readerPageWidth = 0;
let readerViewMode = 'double'; // 'double' или 'single'
let readerParagraphs = []; // хранит отформатированные абзацы для пересчёта при смене шрифта

// Инициализация
async function initReader(pdfUrl, bookId, title, author) {
    console.log('initReader called', { pdfUrl, bookId, title, author });

    readerPdfUrl = pdfUrl;
    readerBookId = bookId;
    readerBookTitle = title;
    readerBookAuthor = author;
    readerCurrentSpread = 1;
    readerTotalSpreads = 0;
    readerPages = [];

    const modal = document.getElementById('readerModal');
    if (!modal) {
        console.error('Reader modal not found');
        return;
    }

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    const titleElem = document.getElementById('readerBookTitle');
    const authorElem = document.getElementById('readerBookAuthor');
    if (titleElem) titleElem.textContent = title;
    if (authorElem) authorElem.textContent = author || '';

    await calculatePageSize();
    await loadReadingProgress(bookId);
    await loadAndProcessPDF(pdfUrl);
}

// Расчет размера страницы
function calculatePageSize() {
    return new Promise((resolve) => {
        setTimeout(() => {
            const page = document.querySelector('.reader-page');
            if (page) {
                const style = getComputedStyle(page);
                const paddingTop = parseFloat(style.paddingTop) || 0;
                const paddingBottom = parseFloat(style.paddingBottom) || 0;

                readerPageHeight = page.clientHeight - paddingTop - paddingBottom - 60;
                readerPageWidth = page.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);

                console.log(`Page size: ${readerPageWidth}x${readerPageHeight}`);
            } else {
                readerPageHeight = 600;
                readerPageWidth = 400;
            }
            resolve();
        }, 200);
    });
}

// Загрузка PDF
async function loadAndProcessPDF(pdfUrl) {
    try {
        const loadingDiv = document.getElementById('readerLoading');
        const pageContainer = document.getElementById('readerPagesContainer');
        const progressText = document.getElementById('loadingProgress');

        if (!loadingDiv || !pageContainer) {
            console.error('Required elements not found');
            return;
        }

        loadingDiv.style.display = 'flex';
        pageContainer.style.display = 'none';

        if (!window.pdfjsLib) {
            await loadPDFJSLibrary();
        }

        if (progressText) progressText.textContent = 'Загрузка PDF файла...';

        const loadingTask = window.pdfjsLib.getDocument(pdfUrl);
        readerPdfDoc = await loadingTask.promise;
        const totalPdfPages = readerPdfDoc.numPages;

        if (progressText) progressText.textContent = `Извлечение текста из ${totalPdfPages} страниц...`;

        let fullText = '';
        for (let i = 1; i <= totalPdfPages; i++) {
            if (progressText) progressText.textContent = `Обработка страницы ${i} из ${totalPdfPages}...`;
            const page = await readerPdfDoc.getPage(i);
            const textContent = await page.getTextContent();

            // Извлечение текста: в этом PDF каждый символ дублируется дважды
            // на одних и тех же координатах (особенность рендера).
            // Решение: дедупликация на уровне символов по позиции (x, y, char),
            // затем сборка строк с восстановлением пробелов по X-зазору.
            const items = textContent.items;
            if (!items || items.length === 0) {
                fullText += '\n\n';
                continue;
            }

            // Разворачиваем items в отдельные символы с координатами
            // каждый item содержит str (строку) и transform[4]=x, transform[5]=y
            // ширину символа получаем из item.width / item.str.length
            const allChars = [];
            for (const item of items) {
                if (!item.str || !item.transform) continue;
                const x0 = item.transform[4];
                const y  = item.transform[5];
                const itemW = item.width || 0;
                const charW = item.str.length > 0 ? itemW / item.str.length : 0;
                for (let ci = 0; ci < item.str.length; ci++) {
                    allChars.push({
                        ch: item.str[ci],
                        x: x0 + ci * charW,
                        y: y
                    });
                }
            }

            // Дедупликация: ключ = (round(x*2)/2, round(y*2)/2, ch)
            const seenChars = new Set();
            const uniqueChars = [];
            for (const c of allChars) {
                const key = `${Math.round(c.x * 2) / 2}_${Math.round(c.y * 2) / 2}_${c.ch}`;
                if (!seenChars.has(key)) {
                    seenChars.add(key);
                    uniqueChars.push(c);
                }
            }

            // Группировка по строкам (Y с допуском 2pt; PDF Y снизу вверх)
            const lineMap = new Map();
            for (const c of uniqueChars) {
                const lineY = Math.round(c.y / 2) * 2;
                if (!lineMap.has(lineY)) lineMap.set(lineY, []);
                lineMap.get(lineY).push(c);
            }

            // Сортируем строки сверху вниз (больший Y = выше на странице)
            const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);

            // Собираем текст строк, восстанавливая пробелы по X-зазору
            const SPACE_THRESHOLD = 1.5; // pt — зазор между символами считается пробелом
            let rawLines = [];
            for (const lineY of sortedYs) {
                const chars = lineMap.get(lineY).sort((a, b) => a.x - b.x);
                let lineText = '';
                let prevX1 = null;
                for (const c of chars) {
                    if (prevX1 !== null && c.x - prevX1 > SPACE_THRESHOLD) {
                        lineText += ' ';
                    }
                    lineText += c.ch;
                    prevX1 = c.x + 1; // приблизительная ширина символа
                }
                lineText = lineText.trim();
                if (lineText) rawLines.push(lineText);
            }

            // Склеиваем строки: перенос слова (дефис в конце) → убираем дефис
            let pageText = '';
            for (let li = 0; li < rawLines.length; li++) {
                const line = rawLines[li].trimEnd();
                if (li === rawLines.length - 1) {
                    pageText += line;
                } else if (/[-\u2010\u00ad]$/.test(line)) {
                    // Перенос слова — убираем дефис, следующее слово клеим без пробела
                    pageText += line.slice(0, -1);
                } else {
                    pageText += line + ' ';
                }
            }

            fullText += pageText.trim() + '\n\n';

            if (i % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        if (progressText) progressText.textContent = 'Форматирование текста...';

        const cleanText = cleanAndFormatText(fullText);
        readerParagraphs = cleanText; // сохраняем для пересчёта при смене шрифта
        await splitIntoPages(cleanText);

        if (progressText) progressText.textContent = `Создано ${readerTotalSpreads} разворотов`;

        await renderSpread(readerCurrentSpread);
        updateSpreadInfo();
        await saveTotalPages();

        loadingDiv.style.display = 'none';
        pageContainer.style.display = 'flex';

    } catch (error) {
        console.error('Error loading PDF:', error);
        const loadingDiv = document.getElementById('readerLoading');
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <div style="text-align: center; color: #8b3a2a;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                    <p>Ошибка загрузки PDF: ${error.message}</p>
                    <button onclick="closeReader()" style="margin-top: 20px; padding: 10px 20px; background: #8b3a2a; color: white; border: none; border-radius: 8px; cursor: pointer;">Закрыть</button>
                </div>
            `;
        }
    }
}

// Очистка и форматирование текста
function cleanAndFormatText(rawText) {
    let text = rawText.replace(/\r\n/g, '\n');

    // Убираем лишние пробелы внутри строк (но сохраняем переводы строк)
    text = text.replace(/[ \t]+/g, ' ');

    // Разбиваем на блоки-абзацы по двойному переносу
    let blocks = text.split(/\n\n+/);
    const formatted = [];

    for (let block of blocks) {
        block = block.trim();
        if (block.length === 0) continue;

        // Одиночные \n внутри блока — склеиваем с пробелом
        block = block.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim();

        if (block.length === 0 || block.length > 8000) continue;

        // Определяем тип блока
        const isChapterHeading =
            block.length < 120 && (
                /^(ГЛАВА|CHAPTER|Глава|Chapter|Раздел|Часть|ЧАСТЬ|РАЗДЕЛ)\b/i.test(block) ||
                /^[Гг][лл][аа][вв][аа]\s/i.test(block) ||
                /^\d+\.$/.test(block) ||
                /^[IVXLCDM]+\.$/.test(block)
            );

        // Полностью заглавный текст до 80 симв — скорее всего заголовок
        const isAllCaps = block.length < 80 && block === block.toUpperCase() && /[А-ЯЁA-Z]/.test(block);

        const isDialogue = /^[—\u2013\u2014\-]/.test(block);

        const isBlockquote = (block.startsWith('"') || block.startsWith('\u00ab')) && block.length < 500;

        let html = '';
        let forcePageBreak = false;

        if (isChapterHeading || isAllCaps) {
            html = '<h2>' + escapeHtml(block) + '</h2>';
            forcePageBreak = true;
        } else if (isBlockquote) {
            html = '<blockquote>' + escapeHtml(block) + '</blockquote>';
        } else if (isDialogue) {
            html = '<p class="dialog">' + escapeHtml(block) + '</p>';
        } else {
            html = '<p>' + escapeHtml(block) + '</p>';
        }

        formatted.push({
            html: html,
            length: block.length,
            forcePageBreak: forcePageBreak
        });
    }

    return formatted;
}

// Разбиение на страницы
async function splitIntoPages(paragraphs) {
    readerPages = [];

    if (!paragraphs || paragraphs.length === 0) {
        readerPages = [[{ html: '<p>Нет содержимого</p>' }]];
        readerTotalSpreads = 1;
        return;
    }

    const measureDiv = document.createElement('div');
    measureDiv.style.position = 'absolute';
    measureDiv.style.visibility = 'hidden';
    measureDiv.style.width = `${readerPageWidth}px`;
    measureDiv.style.fontFamily = "'Georgia', 'Times New Roman', serif";
    measureDiv.style.fontSize = `${readerCurrentFontSize}px`;
    measureDiv.style.lineHeight = '1.7';
    measureDiv.style.padding = '0';
    document.body.appendChild(measureDiv);

    let currentPage = [];
    let currentHeight = 0;
    const pagePadding = 60;

    for (let i = 0; i < paragraphs.length; i++) {
        const para = paragraphs[i];
        measureDiv.innerHTML = para.html;
        const elementHeight = measureDiv.scrollHeight;

        // Принудительный разрыв страницы перед заголовком главы
        // (но только если на текущей странице уже есть контент)
        const needsBreak = para.forcePageBreak && currentPage.length > 0;

        if (needsBreak || (currentHeight + elementHeight > readerPageHeight - pagePadding && currentPage.length > 0)) {
            readerPages.push([...currentPage]);
            currentPage = [para];
            currentHeight = elementHeight;
        } else {
            currentPage.push(para);
            currentHeight += elementHeight;
        }

        if (i % 100 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    if (currentPage.length > 0) {
        readerPages.push(currentPage);
    }

    document.body.removeChild(measureDiv);

    // Рассчитываем количество разворотов (2 страницы на разворот)
    readerTotalSpreads = Math.ceil(readerPages.length / 2);

    if (readerTotalSpreads === 0) {
        readerPages = [[{ html: '<p>Нет содержимого для отображения</p>' }]];
        readerTotalSpreads = 1;
    }

    console.log(`Создано ${readerPages.length} страниц, ${readerTotalSpreads} разворотов`);
}

// Рендер разворота
async function renderSpread(spreadNum) {
    const leftPageIndex = (spreadNum - 1) * 2;
    const rightPageIndex = leftPageIndex + 1;

    const leftPage = document.getElementById('leftPage');
    const rightPage = document.getElementById('rightPage');
    const leftContent = leftPage ? leftPage.querySelector('.page-content') : null;
    const rightContent = rightPage ? rightPage.querySelector('.page-content') : null;

    if (!leftContent || !rightContent) {
        console.error('Page elements not found');
        return;
    }

    // Рендер левой страницы
    if (leftPageIndex < readerPages.length) {
        leftContent.innerHTML = renderPageContent(leftPageIndex + 1, readerPages[leftPageIndex]);
        leftContent.style.fontSize = `${readerCurrentFontSize}px`;
        leftContent.style.lineHeight = `${(readerCurrentFontSize * 1.75).toFixed(1)}px`;
        leftPage.setAttribute('data-page-num', leftPageIndex + 1);
    } else {
        leftContent.innerHTML = '<div style="text-align: center; padding: 50px;"><p>Конец книги</p></div>';
        leftPage.removeAttribute('data-page-num');
    }

    // Рендер правой страницы
    if (rightPageIndex < readerPages.length) {
        rightContent.innerHTML = renderPageContent(rightPageIndex + 1, readerPages[rightPageIndex]);
        rightContent.style.fontSize = `${readerCurrentFontSize}px`;
        rightContent.style.lineHeight = `${(readerCurrentFontSize * 1.75).toFixed(1)}px`;
        rightPage.setAttribute('data-page-num', rightPageIndex + 1);
    } else {
        rightContent.innerHTML = '<div style="text-align: center; padding: 50px;"><p>Конец книги</p></div>';
        rightPage.removeAttribute('data-page-num');
    }
}

// Рендер содержимого страницы
function renderPageContent(pageNum, pageContent) {
    if (!pageContent || pageContent.length === 0) {
        return '<div style="text-align: center; padding: 50px;"><p>Страница не найдена</p></div>';
    }

    let html = '<div style="flex: 1;">';
    for (const item of pageContent) {
        html += item.html;
    }
    html += '</div>';
    html += `<div class="page-number" style="text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #e0d5c5;">— ${pageNum} —</div>`;

    return html;
}

// Следующий разворот
async function nextSpread() {
    if (readerCurrentSpread < readerTotalSpreads) {
        // Анимация перелистывания
        const rightPage = document.getElementById('rightPage');
        if (rightPage) {
            rightPage.classList.add('flipping');
            setTimeout(() => rightPage.classList.remove('flipping'), 400);
        }

        readerCurrentSpread++;
        await renderSpread(readerCurrentSpread);
        await saveReadingProgress();
        updateSpreadInfo();
    }
}

// Предыдущий разворот
async function prevSpread() {
    if (readerCurrentSpread > 1) {
        const leftPage = document.getElementById('leftPage');
        if (leftPage) {
            leftPage.classList.add('flipping');
            setTimeout(() => leftPage.classList.remove('flipping'), 400);
        }

        readerCurrentSpread--;
        await renderSpread(readerCurrentSpread);
        await saveReadingProgress();
        updateSpreadInfo();
    }
}

// Обновление информации
function updateSpreadInfo() {
    const pageInfo = document.getElementById('readerPageInfo');
    const progressBar = document.getElementById('readerProgressBar');
    const percentage = document.getElementById('readerPercentage');
    const prevBtn = document.getElementById('readerPrevBtn');
    const nextBtn = document.getElementById('readerNextBtn');

    const firstPageNum = (readerCurrentSpread - 1) * 2 + 1;
    const lastPageNum = Math.min(firstPageNum + 1, readerPages.length);

    if (pageInfo) pageInfo.textContent = `${firstPageNum}-${lastPageNum} / ${readerPages.length}`;

    const percent = (readerCurrentSpread / readerTotalSpreads) * 100;
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (percentage) percentage.textContent = `${Math.round(percent)}%`;

    if (prevBtn) prevBtn.disabled = readerCurrentSpread <= 1;
    if (nextBtn) nextBtn.disabled = readerCurrentSpread >= readerTotalSpreads;
}

// Изменение шрифта — пересчитываем разбивку на страницы с новым размером
async function changeFontSize(delta) {
    const newSize = readerCurrentFontSize + delta;
    if (newSize >= 12 && newSize <= 24) {
        readerCurrentFontSize = newSize;
        if (readerParagraphs.length > 0) {
            // Запоминаем примерную позицию в тексте чтобы не прыгнуть в начало
            const currentPageIndex = (readerCurrentSpread - 1) * 2;
            const firstParaOnPage = readerPages[currentPageIndex] ? readerPages[currentPageIndex][0] : null;

            await calculatePageSize();
            await splitIntoPages(readerParagraphs);

            // Восстанавливаем позицию: ищем страницу с тем же первым абзацем
            if (firstParaOnPage) {
                let found = false;
                for (let p = 0; p < readerPages.length; p++) {
                    if (readerPages[p][0] === firstParaOnPage) {
                        readerCurrentSpread = Math.ceil((p + 1) / 2);
                        found = true;
                        break;
                    }
                }
                if (!found) readerCurrentSpread = Math.min(readerCurrentSpread, readerTotalSpreads);
            }

            await renderSpread(readerCurrentSpread);
            updateSpreadInfo();
            await saveReadingProgress();
        }
    }
}

// Переключение режима просмотра
function toggleViewMode() {
    readerViewMode = readerViewMode === 'double' ? 'single' : 'double';
    const container = document.getElementById('readerPagesContainer');
    const leftPage = document.getElementById('leftPage');
    const rightPage = document.getElementById('rightPage');

    if (readerViewMode === 'single') {
        container.style.flexDirection = 'column';
        leftPage.style.maxWidth = '80%';
        rightPage.style.maxWidth = '80%';
    } else {
        container.style.flexDirection = 'row';
        leftPage.style.maxWidth = '45%';
        rightPage.style.maxWidth = '45%';
    }
}

// Сохранение прогресса
async function saveReadingProgress() {
    if (!readerBookId) return;

    const currentPage = (readerCurrentSpread - 1) * 2 + 1;

    try {
        await fetch('/save_reading_progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                book_id: readerBookId,
                current_page: currentPage,
                total_pages: readerPages.length,
                percentage: (currentPage / readerPages.length) * 100,
                font_size: readerCurrentFontSize
            })
        });
    } catch (error) {
        console.error('Error saving progress:', error);
    }
}

async function saveTotalPages() {
    await saveReadingProgress();
}

async function loadReadingProgress(bookId) {
    try {
        const response = await fetch(`/get_reading_progress/${bookId}`);
        const data = await response.json();

        if (data.success && data.progress) {
            const pageNum = data.progress.current_page || 1;
            readerCurrentSpread = Math.ceil(pageNum / 2);
            readerCurrentFontSize = data.progress.font_size || 16;
        }
    } catch (error) {
        console.error('Error loading progress:', error);
    }
}

function showGoToPageDialog() {
    const pageNum = prompt(`Введите номер страницы (1-${readerPages.length}):`,
                          (readerCurrentSpread - 1) * 2 + 1);
    if (pageNum) {
        const num = parseInt(pageNum);
        if (!isNaN(num) && num >= 1 && num <= readerPages.length) {
            readerCurrentSpread = Math.ceil(num / 2);
            renderSpread(readerCurrentSpread);
            saveReadingProgress();
            updateSpreadInfo();
        } else {
            alert(`Введите число от 1 до ${readerPages.length}`);
        }
    }
}

function loadPDFJSLibrary() {
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
        script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function closeReader() {
    const modal = document.getElementById('readerModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    saveReadingProgress();

    readerPdfDoc = null;
    readerPages = [];
    readerParagraphs = [];
    readerCurrentSpread = 1;
    readerTotalSpreads = 0;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Обработка клавиш
document.addEventListener('keydown', function(event) {
    const modal = document.getElementById('readerModal');
    if (!modal || modal.style.display !== 'block') return;

    switch(event.key) {
        case 'ArrowLeft':
            prevSpread();
            event.preventDefault();
            break;
        case 'ArrowRight':
            nextSpread();
            event.preventDefault();
            break;
        case 'Escape':
            closeReader();
            event.preventDefault();
            break;
        case 'g':
        case 'G':
            showGoToPageDialog();
            event.preventDefault();
            break;
        case '+':
        case '=':
            changeFontSize(1);
            event.preventDefault();
            break;
        case '-':
            changeFontSize(-1);
            event.preventDefault();
            break;
        case 'v':
        case 'V':
            toggleViewMode();
            event.preventDefault();
            break;
    }
});

let _resizeTimer = null;
window.addEventListener('resize', () => {
    const modal = document.getElementById('readerModal');
    if (!modal || modal.style.display !== 'block') return;
    // Дебаунс — не пересчитываем на каждый пиксель изменения окна
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(async () => {
        await calculatePageSize();
        if (readerParagraphs.length > 0) {
            const currentPageIndex = (readerCurrentSpread - 1) * 2;
            const firstParaOnPage = readerPages[currentPageIndex] ? readerPages[currentPageIndex][0] : null;
            await splitIntoPages(readerParagraphs);
            if (firstParaOnPage) {
                for (let p = 0; p < readerPages.length; p++) {
                    if (readerPages[p][0] === firstParaOnPage) {
                        readerCurrentSpread = Math.ceil((p + 1) / 2);
                        break;
                    }
                }
                readerCurrentSpread = Math.min(readerCurrentSpread, readerTotalSpreads);
            }
            await renderSpread(readerCurrentSpread);
            updateSpreadInfo();
        } else if (readerPdfDoc) {
            await renderSpread(readerCurrentSpread);
        }
    }, 300);
});