// ===== Утилиты производительности =====

function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Защита от двойного клика: блокирует кнопку на время выполнения async-функции

function withLoading(btn, fn) {
    if (btn && btn.disabled) return;
    if (btn) btn.disabled = true;
    const result = fn();
    if (result && result.finally) {
        result.finally(() => { if (btn) btn.disabled = false; });
    } else {
        setTimeout(() => { if (btn) btn.disabled = false; }, 300);
    }
}

// Быстрый innerHTML без layout thrashing

function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}
let currentActiveTab = 'library';
let currentActiveSection = 'library';
let currentMarathonTab = 'pending';
const BOOKS_PER_PAGE = 5;
let allBooksCache = [];
let currentBooksPage = 1;
let allSearchCache = [];
let currentSearchPage = 1;
window.initAdminPage = function() {
    document.body.classList.add('no-transition');
    requestAnimationFrame(() => requestAnimationFrame(() => {
        document.body.classList.remove('no-transition');
    }));
    // Если сервер уже передал книги — рендерим мгновенно, без запроса
    if (currentActiveSection === 'library') {
        if (window.__INITIAL_BOOKS__ && window.__INITIAL_BOOKS__.length > 0) {
            allBooksCache = window.__INITIAL_BOOKS__;
            currentBooksPage = 1;
            renderLibraryPage(currentBooksPage);
        } else {
            loadAllBooks();
        }
    }
    currentMarathonTab = 'pending';
    const pendingButton = document.querySelector('.marathon-tab-button[onclick="openMarathonTab(\'pending\')"]');
    if (pendingButton) {
        pendingButton.classList.add('active');
    }
    const pendingContent = document.getElementById('pendingMarathons');
    if (pendingContent) {
        pendingContent.classList.add('active');
    }
    if (currentActiveSection === 'marathons') {
        loadPendingMarathons();
    }
};
// DOMContentLoaded removed: React calls window.initAdminPage() directly after scripts load

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    const icon = document.querySelector('.toggle-btn i');
    if (sidebar.classList.contains('collapsed')) {
        icon.classList.remove('fa-chevron-left');
        icon.classList.add('fa-chevron-right');
    } else {
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-left');
    }
}

function logout() {
    // Clear session directly — proxy interceptor also handles /logout
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('profile_image');
    window.location.href = '/login';
}

function showStatusMessage(message, isError = false) {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = message;
    statusMessage.style.backgroundColor = isError ? '#f44336' : '#4CAF50';
    statusMessage.classList.add('show');
    setTimeout(() => {
        statusMessage.classList.remove('show');
    }, 3000);
}

function navigateTo(section) {
    currentActiveSection = section;
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const _ni = document.querySelector(`.nav-item[data-nav="${section}"]`) || document.querySelector(`.nav-item[onclick="navigateTo('${section}')"]`);
    if (_ni) _ni.classList.add('active');
    document.getElementById('libraryContent').style.display = 'none';
    document.getElementById('marathonsContent').style.display = 'none';

    if (section === 'library') {
        document.getElementById('libraryContent').style.display = 'block';
        if (allBooksCache.length > 0) {
            renderLibraryPage(currentBooksPage);
        } else {
            loadAllBooks();
        }
    } else if (section === 'marathons') {
        document.getElementById('marathonsContent').style.display = 'block';
        if (currentMarathonTab === 'system') {
            loadMarathons('system');
        } else if (currentMarathonTab === 'user') {
            loadUserMarathons();
        } else if (currentMarathonTab === 'pending') {
            loadPendingMarathons();
        } else {
            loadPendingMarathons();
        }
    }
}

function checkOtherGenre(selectElement) {
    const formId = selectElement.id === 'bookGenre' ? 'addBookForm' : 'editBookModal';
    const otherGenreInputId = selectElement.id === 'bookGenre' ? 'otherGenreInput' : 'editOtherGenreInput';
    const otherGenreInput = document.getElementById(otherGenreInputId);
    if (selectElement.value === "Другое") {
        otherGenreInput.style.display = 'block';
        otherGenreInput.required = true;
    } else {
        otherGenreInput.style.display = 'none';
        otherGenreInput.required = false;
        otherGenreInput.value = '';
    }
}

// ========== ОБЪЕДИНЁННЫЙ ПОИСК С ЕДИНЫМ ВЫВОДОМ ==========

function buildSkeletonCards(count) {
    let html = '<div class="book-list">';
    for (let i = 0; i < count; i++) {
        html += `
        <div class="skeleton-card">
            <div class="skeleton-block skeleton-img"></div>
            <div class="skeleton-info">
                <div class="skeleton-block skeleton-title"></div>
                <div class="skeleton-block skeleton-meta"></div>
                <div class="skeleton-block skeleton-meta2"></div>
                <div class="skeleton-block skeleton-desc" style="margin-top:14px;"></div>
                <div class="skeleton-block skeleton-desc2"></div>
            </div>
        </div>`;
    }
    html += '</div>';
    return html;
}

// admin.js - добавьте console.log в loadAllBooks

function loadAllBooks(silent = false) {
    if (!silent) {
        document.getElementById('searchResults').innerHTML = buildSkeletonCards(BOOKS_PER_PAGE);
    }
    const savedPage = currentBooksPage;

    fetch('/get_all_books')
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || `HTTP ${response.status}`); });
            }
            return response.json();
        })
        .then(data => {
            // Guard: backend must return an array
            if (!Array.isArray(data)) {
                const msg = data?.error || 'Неверный формат ответа от сервера';
                console.error('loadAllBooks: expected array, got:', data);
                throw new Error(msg);
            }

            if (data.length === 0) {
                allBooksCache = [];
                if (!silent) {
                    document.getElementById('searchResults').innerHTML = '<div class="no-books">Книги не найдены</div>';
                }
            } else {
                allBooksCache = data;
                if (!silent) {
                    currentBooksPage = 1;
                    renderLibraryPage(1);
                } else {
                    const totalPages = Math.ceil(allBooksCache.length / BOOKS_PER_PAGE);
                    const page = Math.min(savedPage, totalPages) || 1;
                    currentBooksPage = page;
                    renderLibraryPage(page);
                }
                prefetchNextPageCovers(currentBooksPage);
            }
        })
        .catch(error => {
            console.error('loadAllBooks error:', error);
            allBooksCache = [];
            if (!silent) {
                document.getElementById('searchResults').innerHTML =
                    `<div class="no-books" style="color:#c0392b">
                        <i class="fas fa-exclamation-triangle"></i><br>
                        Ошибка загрузки книг:<br><small>${error.message}</small>
                    </div>`;
            }
        });
}

function showAllBooks() {
    document.getElementById('bookSearch').value = '';
    loadAllBooks();
}

// ГЛАВНАЯ ФУНКЦИЯ ПОИСКА - единый вывод

function searchBooks(event) {
    if (event) event.preventDefault();
    const searchTerm = document.getElementById('bookSearch').value.trim();
    if (!searchTerm) {
        loadAllBooks();
        return;
    }
    showStatusMessage('Поиск...');
    fetch('/search_unified_books', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ search_term: searchTerm })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success === false) {
            showStatusMessage(data.message || 'Ошибка поиска', true);
            return;
        }
        displayUnifiedResults(data);
    })
    .catch(error => {
        console.error('Error:', error);
        showStatusMessage('Ошибка при поиске книг', true);
    });
}

// Отображение объединённых результатов (один общий список)

function displayUnifiedResults(data) {
    const allBooks = [];
    if (data.local && data.local.length > 0) {
        data.local.forEach(book => {
            allBooks.push({ ...book, is_in_library: true, is_imported: true });
        });
    }
    if (data.external && data.external.length > 0) {
        data.external.forEach(book => {
            if (!book.is_imported) {
                allBooks.push({ ...book, is_in_library: false, is_external: true });
            }
        });
    }
    if (allBooks.length === 0) {
        document.getElementById('searchResults').innerHTML = '<div class="no-books">📖 Книги не найдены</div>';
        showStatusMessage('Книги не найдены', true);
        return;
    }
    allSearchCache = allBooks;
    currentSearchPage = 1;
    renderSearchPage(currentSearchPage);
    showStatusMessage(`Найдено ${allBooks.length} книг`);
}

// Создание карточки для локальной книги

// admin.js - добавьте console.log в начало createLibraryBookCard

function createLibraryBookCard(book) {
    // ОТЛАДКА: выводим данные книги
    // console.log('=== Creating card for book ===');
    // console.log('Book ID:', book.id);
    // console.log('Book title:', book.title);
    // console.log('audio_track_count:', book.audio_track_count);
    // console.log('has_audio:', book.has_audio);
    // console.log('Full book object:', book);

    const bookCard = document.createElement('div');
    bookCard.className = 'book-card';
    bookCard.setAttribute('data-book-id', book.id);

    const defaultImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="170" height="265" viewBox="0 0 170 265"%3E%3Crect width="170" height="265" fill="%23f0f0f0"/%3E%3Ctext x="85" y="132" text-anchor="middle" fill="%23999" font-size="14"%3ENo Image%3C/text%3E%3C/svg%3E';
    const coverUrl = getBookCoverUrl(book) || defaultImage;

    // ПРАВИЛЬНОЕ определение наличия аудио
    const hasAudio = (book.audio_track_count && book.audio_track_count > 0) || book.has_audio === true;
    const hasPdf = book.has_pdf === true;

    console.log('hasAudio after check:', hasAudio);
    console.log('audio_track_count value:', book.audio_track_count);

    // Формируем текст для аудио
    let audioText = 'нет';
    if (book.audio_track_count && book.audio_track_count > 0) {
        const count = book.audio_track_count;
        audioText = count + ' ' + (count === 1 ? 'дорожка' : (count < 5 ? 'дорожки' : 'дорожек'));
    } else if (book.has_audio === true) {
        audioText = 'есть';
    }

    console.log('audioText:', audioText);

    bookCard.innerHTML = `
        <img class="book-image" src="${coverUrl}" alt="${escapeHtml(book.title)}" loading="eager" fetchpriority="high" decoding="async" onerror="this.src='${defaultImage}'">
        <div class="book-info">
            <h3 class="book-title">${escapeHtml(book.title)}</h3>
            <p class="book-meta"><strong>Автор:</strong> ${escapeHtml(book.author)}</p>
            <p class="book-meta"><strong>Жанр:</strong> ${escapeHtml(book.genre)}</p>
            ${book.year ? `<p class="book-meta"><strong>Год:</strong> ${book.year}</p>` : ''}
            ${book.description ? `<p class="book-description"><strong>Описание:</strong> ${escapeHtml(book.description)}</p>` : ''}
            <div class="file-indicators" id="file-indicators-${book.id}">
                <span style="display: flex; align-items: center; gap: 5px; color: #555;">
                    <i class="fas fa-file-pdf" style="color: ${hasPdf ? '#4CAF50' : '#888'};"></i> PDF:
                    <span style="color: ${hasPdf ? '#4CAF50' : '#888'};">${hasPdf ? 'есть' : 'нет'}</span>
                </span>
                <span style="display: flex; align-items: center; gap: 5px; color: #555;">
                    <i class="fas fa-headphones" style="color: ${hasAudio ? '#4CAF50' : '#888'};"></i> Аудио:
                    <span style="color: ${hasAudio ? '#4CAF50' : '#888'};">${audioText}</span>
                </span>
            </div>
        </div>
        <div class="book-options" onclick="toggleBookActions(event, ${book.id})">
            <i class="fas fa-ellipsis-v"></i>
            <div class="book-actions">
                <button onclick="editBook(${book.id})"><i class="fas fa-edit"></i> Редактировать</button>
                <button onclick="deleteBook(${book.id})"><i class="fas fa-trash"></i> Удалить</button>
            </div>
        </div>
    `;
    return bookCard;
}
// Создание карточки для внешней книги (с зелёной рамкой и кнопкой импорта)

function createExternalBookCard(book) {
    const bookCard = document.createElement('div');
    bookCard.className = 'book-card';
    // Формируем URL для обложки из хранилища API
    let coverUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="170" height="265" viewBox="0 0 170 265"%3E%3Crect width="170" height="265" fill="%23f0f0f0"/%3E%3Ctext x="85" y="132" text-anchor="middle" fill="%23999" font-size="14"%3ENo Image%3C/text%3E%3C/svg%3E';
    if (book.cover_path) {
        // Прямой URL к MinIO API (порт 9002)
        let coverPath = book.cover_path;
        // Убираем начальный слеш если есть
        if (coverPath.startsWith('/')) {
            coverPath = coverPath.substring(1);
        }
        coverUrl = `http://localhost:9002/${coverPath}`;
    }
    // Добавляем зелёную рамку
    bookCard.style.cssText = 'border: 2px solid #4CAF50; transition: all 0.3s ease;';
    const hasPdf = book.has_pdf === true;
    const hasAudio = book.has_audio === true;
    // Формируем URL для PDF и аудио (если есть)
    let pdfUrl = '';
    let audioUrl = '';
    if (book.pdf_path) {
        let pdfPath = book.pdf_path;
        if (pdfPath.startsWith('/')) {
            pdfPath = pdfPath.substring(1);
        }
        pdfUrl = `http://localhost:9002/${pdfPath}`;
    }
    if (book.audio_path) {
        let audioPath = book.audio_path;
        if (audioPath.startsWith('/')) {
            audioPath = audioPath.substring(1);
        }
        audioUrl = `http://localhost:9002/${audioPath}`;
    }
    bookCard.innerHTML = `
        <img class="book-image" src="${coverUrl}" alt="${escapeHtml(book.title)}" loading="eager" fetchpriority="high" decoding="async" onload="this.classList.add('loaded')" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"170\" height=\"265\" viewBox=\"0 0 170 265\"%3E%3Crect width=\"170\" height=\"265\" fill=\"%23f0f0f0\"/%3E%3Ctext x=\"85\" y=\"132\" text-anchor=\"middle\" fill=\"%23999\" font-size=\"14\"%3ENo Image%3C/text%3E%3C/svg%3E';this.classList.add('loaded')">
        <div class="book-info">
            <h3 class="book-title">${escapeHtml(book.title)}</h3>
            <p class="book-meta"><strong>Автор:</strong> ${escapeHtml(book.author)}</p>
            <p class="book-meta"><strong>Жанр:</strong> ${escapeHtml(book.genre)}</p>
            ${book.year ? `<p class="book-meta"><strong>Год:</strong> ${book.year}</p>` : ''}
            ${book.description ? `<p class="book-description"><strong>Описание:</strong> ${escapeHtml(book.description.substring(0, 300))}${book.description.length > 300 ? '...' : ''}</p>` : ''}
            <div class="file-indicators" style="margin-top: 10px; display: flex; gap: 20px;">
                <span style="display: flex; align-items: center; gap: 5px; color: #555;">
                    <i class="fas fa-file-pdf" style="color: ${hasPdf ? '#4CAF50' : '#888'};"></i>
                    PDF: <span style="color: ${hasPdf ? '#4CAF50' : '#888'};">${hasPdf ? 'есть' : 'нет'}</span>
                </span>
                <span style="display: flex; align-items: center; gap: 5px; color: #555;">
                    <i class="fas fa-headphones" style="color: ${hasAudio ? '#4CAF50' : '#888'};"></i>
                    Аудио: <span style="color: ${hasAudio ? '#4CAF50' : '#888'};">${hasAudio ? 'есть' : 'нет'}</span>
                </span>
            </div>
            <button onclick='importBookFromSearch(${JSON.stringify(book).replace(/'/g, "&#39;")})' style="margin-top: 15px; background: #4CAF50; color: white; padding: 8px 20px; border: none; border-radius: 4px; cursor: pointer;">
                Импортировать в библиотеку
            </button>
        </div>
    `;
    return bookCard;
}

// ─── ПАГИНАЦИЯ ───────────────────────────────────────────────────────────────

function buildPagination(totalItems, currentPage, onPageChange) {
    const totalPages = Math.ceil(totalItems / BOOKS_PER_PAGE);
    if (totalPages <= 1) return null;
    const nav = document.createElement('div');
    nav.className = 'books-pagination';
    const info = document.createElement('span');
    info.className = 'pagination-info';
    const from = (currentPage - 1) * BOOKS_PER_PAGE + 1;
    const to = Math.min(currentPage * BOOKS_PER_PAGE, totalItems);
    info.textContent = `${from}–${to} из ${totalItems}`;
    const btnPrev = document.createElement('button');
    btnPrev.className = 'pagination-btn';
    btnPrev.textContent = '← Назад';
    btnPrev.disabled = currentPage === 1;
    btnPrev.onclick = () => onPageChange(currentPage - 1);
    const btnNext = document.createElement('button');
    btnNext.className = 'pagination-btn';
    btnNext.textContent = 'Вперёд →';
    btnNext.disabled = currentPage === totalPages;
    btnNext.onclick = () => onPageChange(currentPage + 1);
    const pages = document.createElement('div');
    pages.className = 'pagination-pages';
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = 'pagination-page-btn' + (i === currentPage ? ' active' : '');
        btn.textContent = i;
        btn.onclick = () => onPageChange(i);
        pages.appendChild(btn);
    }
    nav.appendChild(btnPrev);
    nav.appendChild(pages);
    nav.appendChild(btnNext);
    nav.appendChild(info);
    return nav;
}

function renderLibraryPage(page) {
    currentBooksPage = page;
    const resultsContainer = document.getElementById('searchResults');
    const start = (page - 1) * BOOKS_PER_PAGE;
    const pageBooks = allBooksCache.slice(start, start + BOOKS_PER_PAGE);
    // Стартуем загрузку картинок немедленно — браузер дедуплицирует запросы,
    // двойных обращений к серверу не будет, зато сеть начинает работать раньше
    preloadCovers(pageBooks);
    const container = document.createElement('div');
    container.className = 'book-list';
    displayBooksInContainer(pageBooks, container, false);
    const pag = buildPagination(allBooksCache.length, page, renderLibraryPage);
    if (pag) {
        resultsContainer.replaceChildren(container, pag);
    } else {
        resultsContainer.replaceChildren(container);
    }
    // Фоново кешируем следующие страницы
    prefetchNextPageCovers(page);
}

function getBookCoverUrl(book) {
    const defaultImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="170" height="265" viewBox="0 0 170 265"%3E%3Crect width="170" height="265" fill="%23f0f0f0"/%3E%3Ctext x="85" y="132" text-anchor="middle" fill="%23999" font-size="14"%3ENo Image%3C/text%3E%3C/svg%3E';
    if (book.cover_path) {
        let coverPath = book.cover_path;
        if (coverPath.startsWith('/')) coverPath = coverPath.substring(1);
        return `http://localhost:9002/${coverPath}`;
    }
    return book.image_filename || defaultImage;
}

function preloadCovers(books) {
    books.forEach(book => {
        const url = getBookCoverUrl(book);
        if (url && !url.startsWith('data:')) {
            const img = new Image();
            img.src = url;
        }
    });
}

function prefetchNextPageCovers(currentPage) {
    // Пропускаем текущую и следующую страницы (они уже грузятся или загружены)
    // Фоново кешируем ВСЕ остальные страницы батчами по 5 книг
    const BATCH = BOOKS_PER_PAGE;
    const skipStart = (currentPage - 1) * BATCH;
    const skipEnd   = (currentPage + 1) * BATCH; // текущая + следующая
    const rest = allBooksCache.filter((_, i) => i < skipStart || i >= skipEnd);

    let i = 0;
    function loadBatch(deadline) {
        while (i < rest.length && (deadline.timeRemaining() > 4 || deadline.didTimeout)) {
            const url = getBookCoverUrl(rest[i]);
            if (url && !url.startsWith('data:')) new Image().src = url;
            i++;
        }
        if (i < rest.length) {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(loadBatch, { timeout: 3000 });
            } else {
                setTimeout(() => loadBatch({ timeRemaining: () => 10, didTimeout: false }), 400);
            }
        }
    }

    // Начинаем со следующей страницы немедленно (в idle), остальное — потом
    const nextBooks = allBooksCache.slice(currentPage * BATCH, (currentPage + 1) * BATCH);
    const runNext = () => nextBooks.forEach(book => {
        const url = getBookCoverUrl(book);
        if (url && !url.startsWith('data:')) new Image().src = url;
    });

    if ('requestIdleCallback' in window) {
        requestIdleCallback(runNext, { timeout: 500 });
        requestIdleCallback(loadBatch, { timeout: 3000 });
    } else {
        setTimeout(runNext, 200);
        setTimeout(() => loadBatch({ timeRemaining: () => 10, didTimeout: false }), 600);
    }
}

function renderSearchPage(page) {
    currentSearchPage = page;
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';
    const start = (page - 1) * BOOKS_PER_PAGE;
    const pageBooks = allSearchCache.slice(start, start + BOOKS_PER_PAGE);
    const container = document.createElement('div');
    container.className = 'book-list';
    pageBooks.forEach(book => {
        const bookCard = book.is_in_library
            ? createLibraryBookCard(book)
            : createExternalBookCard(book);
        container.appendChild(bookCard);
    });
    resultsContainer.appendChild(container);
    const pag = buildPagination(allSearchCache.length, page, renderSearchPage);
    if (pag) resultsContainer.appendChild(pag);
}

// ─────────────────────────────────────────────────────────────────────────────

// Отображение книг в контейнере (для loadAllBooks)

function displayBooksInContainer(books, container, showImportButton = false) {
    const fragment = document.createDocumentFragment();
    books.forEach(book => {
        fragment.appendChild(showImportButton ? createExternalBookCard(book) : createLibraryBookCard(book));
    });
    container.appendChild(fragment);
}

// Импорт книги из результатов поиска

// Импорт книги из результатов поиска

function importBookFromSearch(book) {
    if (!confirm(`Импортировать книгу "${book.title}" в библиотеку?`)) return;
    showStatusMessage('Импорт книги...');
    // Добавляем полные URL для PDF и аудио из хранилища API
    const bookToImport = {
        ...book,
        cover_path: book.cover_path,
        pdf_path: book.pdf_path,
        audio_path: book.audio_path,
        has_pdf: book.has_pdf,
        has_audio: book.has_audio
    };
    fetch('/import_book_from_api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book: bookToImport })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showStatusMessage(data.message);
            // Обновляем поиск
            const searchTerm = document.getElementById('bookSearch').value.trim();
            if (searchTerm) {
                searchBooks();
            } else {
                loadAllBooks();
            }
        } else {
            showStatusMessage(data.message || 'Ошибка импорта книги', true);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showStatusMessage('Ошибка при импорте книги', true);
    });
}

function loadBookFiles(bookId, callback) {
    fetch(`/get_book_files/${bookId}`)
        .then(response => response.json())
        .then(files => {
            if (callback) callback(files);
        })
        .catch(error => console.error('Error loading file info:', error));
}

function toggleBookActions(event, bookId) {
    event.stopPropagation();
    const bookActions = event.currentTarget.querySelector('.book-actions');
    if (bookActions.style.display === 'block') {
        bookActions.style.display = 'none';
    } else {
        document.querySelectorAll('.book-actions').forEach(actions => {
            actions.style.display = 'none';
        });
        bookActions.style.display = 'block';
    }
}

// ========== УПРАВЛЕНИЕ КНИГАМИ ==========

function showAddBookForm() {
    const form = document.getElementById('addBookForm');
    form.classList.add('open');
    setTimeout(() => document.getElementById('bookTitle').focus(), 200);
    document.getElementById('otherGenreInput').style.display = 'none';
    document.getElementById('otherGenreInput').required = false;
}

function hideAddBookForm() {
    const form = document.getElementById('addBookForm');
    form.classList.remove('open');
    document.getElementById('bookForm').reset();
    audioTracksQueue = [];
    document.getElementById('audioTracksQueue').innerHTML = '';
    document.getElementById('bookForm').reset();
    document.getElementById('otherGenreInput').style.display = 'none';
}

// ========== AUDIO TRACKS ==========
let audioTracksQueue = []; // {title, file} for add-book form

function addAudioTrackRow() {
    const idx = audioTracksQueue.length;
    audioTracksQueue.push({title: '', file: null});
    const container = document.getElementById('audioTracksQueue');
    const row = document.createElement('div');
    row.className = 'audio-track-row';
    row.setAttribute('data-idx', idx);
    row.innerHTML = `
        <span class="track-num">${idx + 1}</span>
        <input type="text" placeholder="Название дорожки" class="track-title-input"
               oninput="audioTracksQueue[${idx}].title = this.value" style="flex:1;">
        <input type="file" accept=".mp3,.wav,.ogg,.m4a" class="track-file-input"
               onchange="audioTracksQueue[${idx}].file = this.files[0]" style="flex:1;">
        <button type="button" class="remove-track-btn" onclick="removeAudioTrackRow(${idx})">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(row);
}

function removeAudioTrackRow(idx) {
    audioTracksQueue[idx] = null;
    const container = document.getElementById('audioTracksQueue');
    const row = container.querySelector(`[data-idx="${idx}"]`);
    if (row) row.remove();
    // Re-number remaining rows
    container.querySelectorAll('.audio-track-row').forEach((r, i) => {
        r.querySelector('.track-num').textContent = i + 1;
    });
}

// В админке - функция загрузки нового трека

// В admin.js функция uploadNewAudioTrack должна быть такой:

function uploadNewAudioTrack() {
    const bookId = document.getElementById('editBookId').value;
    const title = document.getElementById('newTrackTitle').value.trim();
    const file = document.getElementById('newTrackFile').files[0];
    if (!bookId) {
        showStatusMessage('ID книги не найден', true);
        return;
    }
    if (!file) {
        showStatusMessage('Выберите файл дорожки', true);
        return;
    }
    const fd = new FormData();
    fd.append('title', title || file.name);
    fd.append('audio_file', file);
    // Правильный URL - с book_id в пути
    const btn = document.querySelector('#editBookModal .upload-track-btn') || document.querySelector('[onclick="uploadNewAudioTrack()"]');
    const originalText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Загрузка...'; }
    fetch(`/add_audio_track/${bookId}`, {
        method: 'POST',
        body: fd
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    })
    .then(data => {
        if (data.success) {
            showStatusMessage('Дорожка загружена');
            document.getElementById('newTrackTitle').value = '';
            document.getElementById('newTrackFile').value = '';
            loadEditBookAudioTracks(bookId);
            // Обновляем только индикаторы карточки — без замены карточки (нет моргания)
            refreshBookInCache(Number(bookId));
        } else {
            showStatusMessage('Ошибка: ' + (data.message || 'Unknown'), true);
        }
    })
    .catch(err => {
        console.error('Upload error:', err);
        showStatusMessage('Ошибка загрузки: ' + err.message, true);
    })
    .finally(() => {
        if (btn) { btn.disabled = false; btn.textContent = originalText; }
    });
}

// Тихо обновляет одну книгу в кэше — только индикаторы, без замены карточки (нет моргания)

function refreshBookInCache(bookId) {
    fetch(`/get_book/${bookId}`)
        .then(r => r.json())
        .then(book => {
            if (!book || !book.id) return;

            // Обновляем запись в кэше
            const idx = allBooksCache.findIndex(b => b.id === bookId);
            if (idx !== -1) {
                allBooksCache[idx] = book;
            }

            // Обновляем только блок индикаторов внутри карточки
            const indicators = document.getElementById(`file-indicators-${bookId}`);
            if (indicators) {
                // ПРАВИЛЬНОЕ определение наличия аудио
                const hasAudio = (book.audio_track_count && book.audio_track_count > 0) || book.has_audio === true;
                const hasPdf = book.has_pdf === true;

                let audioText = 'нет';
                if (book.audio_track_count && book.audio_track_count > 0) {
                    const count = book.audio_track_count;
                    audioText = count + ' ' + (count === 1 ? 'дорожка' : (count < 5 ? 'дорожки' : 'дорожек'));
                } else if (book.has_audio === true) {
                    audioText = 'есть';
                }

                indicators.innerHTML = `
                    <span style="display:flex;align-items:center;gap:5px;color:#555;">
                        <i class="fas fa-file-pdf" style="color:${hasPdf ? '#4CAF50' : '#888'};"></i> PDF:
                        <span style="color:${hasPdf ? '#4CAF50' : '#888'};">${hasPdf ? 'есть' : 'нет'}</span>
                    </span>
                    <span style="display:flex;align-items:center;gap:5px;color:#555;">
                        <i class="fas fa-headphones" style="color:${hasAudio ? '#4CAF50' : '#888'};"></i> Аудио:
                        <span style="color:${hasAudio ? '#4CAF50' : '#888'};">${audioText}</span>
                    </span>
                `;
            }
        })
        .catch(() => {});
}


function loadEditBookAudioTracks(bookId) {
    fetch(`/get_audio_tracks/${bookId}`)
        .then(r => r.json())
        .then(tracks => {
            const container = document.getElementById('editBookAudioTracks');
            container.innerHTML = '';
            if (!tracks || tracks.length === 0) {
                container.innerHTML = '<div style="color:#aaa;font-size:13px;">Нет дорожек</div>';
                return;
            }
            tracks.forEach(t => {
                const row = document.createElement('div');
                row.className = 'audio-track-row existing-track';
                row.setAttribute('data-track-id', t.id);
                row.innerHTML = `
                    <span class="track-num">${t.track_order}</span>
                    <span class="track-title">${escapeHtml(t.title)}</span>
                    <a href="${t.url}" target="_blank" class="track-play-link" title="Прослушать">
                        <i class="fas fa-play-circle"></i>
                    </a>
                    <button type="button" class="remove-track-btn"
                            onclick="deleteEditBookTrack(${bookId}, ${t.id}, this)">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                container.appendChild(row);
            });
        })
        .catch(() => {
            document.getElementById('editBookAudioTracks').innerHTML = '<div style="color:#aaa;font-size:13px;">Ошибка загрузки</div>';
        });
}

function deleteEditBookTrack(bookId, trackId, btn) {
    if (!confirm('Удалить дорожку?')) return;
    fetch(`/delete_audio_track/${bookId}/${trackId}`, {method: 'DELETE'})
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                const row = btn.closest('.audio-track-row');
                if (row) row.remove();
                showStatusMessage('Дорожка удалена');
            } else {
                showStatusMessage('Ошибка удаления', true);
            }
        });
}

function addBook() {
    const formData = new FormData();
    const bookTitle = document.getElementById('bookTitle').value.trim();
    formData.append('title', bookTitle);
    formData.append('author', document.getElementById('bookAuthor').value);
    let genre = document.getElementById('bookGenre').value;
    const otherGenre = document.getElementById('otherGenreInput').value;
    if (genre === 'Другое' && otherGenre) genre = otherGenre;
    formData.append('genre', genre);
    formData.append('year', document.getElementById('bookYear').value);
    formData.append('description', document.getElementById('bookDescription').value);
    const image = document.getElementById('bookImage').files[0];
    if (image) formData.append('image', image);
    const pdf = document.getElementById('bookPdf').files[0];
    if (pdf) formData.append('pdf_file', pdf);
    const tracksToUpload = [...audioTracksQueue].filter(t => t && t.file);
    // Захватываем файлы ДО отправки (после hideAddBookForm они сбросятся)
    const imageFile = document.getElementById('bookImage').files[0];
    const pdfFile = document.getElementById('bookPdf').files[0];
    const imageBlobUrl = imageFile ? URL.createObjectURL(imageFile) : null;

    // Блокируем кнопку на время запроса
    const submitBtn = document.querySelector('#addBookForm .submit-btn');
    if (submitBtn) submitBtn.disabled = true;

    fetch('/add_book', { method: 'POST', body: formData })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const bookId = data.book_id;
            hideAddBookForm();
            showStatusMessage(`Книга "${bookTitle}" успешно добавлена`);

            // pdfFile/imageFile уже захвачены выше
            const newBook = {
                id: bookId,
                title: bookTitle,
                author: document.getElementById('bookAuthor').value,
                genre: genre,
                year: document.getElementById('bookYear').value || null,
                description: document.getElementById('bookDescription').value || null,
                image_filename: imageBlobUrl, // blob URL захвачен до сброса формы
                has_pdf: !!pdfFile,
                has_audio: tracksToUpload.length > 0,
                audio_track_count: tracksToUpload.length
            };

            // Вставляем в кэш и перерисовываем страницу
            allBooksCache.unshift(newBook);
            currentBooksPage = 1;
            renderLibraryPage(1);

            // Треки и обновление реального URL картинки — фоном
            if (tracksToUpload.length > 0) {
                uploadTracksForBook(bookId, tracksToUpload, true);
            }
            // Фоново обновляем книгу в кэше с реальными данными от сервера
            fetch(`/get_book/${bookId}`)
                .then(r => r.json())
                .then(realBook => {
                    if (realBook && realBook.id) {
                        const idx = allBooksCache.findIndex(b => b.id === bookId);
                        if (idx !== -1) allBooksCache[idx] = realBook;
                    }
                    // Освобождаем blob URL — он больше не нужен
                    if (imageBlobUrl) URL.revokeObjectURL(imageBlobUrl);
                }).catch(() => {
                    if (imageBlobUrl) URL.revokeObjectURL(imageBlobUrl);
                });
        } else {
            showStatusMessage(data.message || 'Ошибка при добавлении книги', true);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showStatusMessage('Ошибка при добавлении книги', true);
    })
    .finally(() => {
        if (submitBtn) submitBtn.disabled = false;
    });
}

async function uploadTracksForBook(bookId, tracks, silent = false) {
    if (!bookId) {
        console.error('No bookId provided');
        return;
    }
    // Загружаем все треки параллельно
    const uploads = tracks.map(t => {
        if (!t || !t.file) return Promise.resolve();
        const fd = new FormData();
        const trackTitle = t.title && t.title.trim() ? t.title.trim() : t.file.name.replace(/\.[^/.]+$/, '');
        fd.append('title', trackTitle);
        fd.append('audio_file', t.file);
        return fetch(`/add_audio_track/${bookId}`, { method: 'POST', body: fd })
            .then(r => r.json())
            .then(data => {
                if (!data.success && !silent) {
                    showStatusMessage(`Ошибка загрузки "${trackTitle}"`, true);
                }
            })
            .catch(e => {
                console.error(`Error uploading track ${trackTitle}:`, e);
                if (!silent) showStatusMessage(`Ошибка загрузки "${trackTitle}"`, true);
            });
    });
    await Promise.all(uploads);
}

function editBook(bookId) {
    showEditBookModal(bookId);
}

// admin.js - исправленная функция showEditBookModal
function showEditBookModal(bookId) {
    document.getElementById('modalOverlay').style.display = 'block';
    document.body.style.overflow = 'hidden';

    fetch(`/get_book/${bookId}`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(bookData => {
            if (!bookData || !bookData.id) {
                showStatusMessage('Ошибка: книга не найдена', true);
                hideEditBookModal();
                return;
            }

            document.getElementById('editBookId').value = bookData.id;
            document.getElementById('editBookTitle').value = bookData.title || '';
            document.getElementById('editBookAuthor').value = bookData.author || '';
            document.getElementById('editBookYear').value = bookData.year || '';
            document.getElementById('editBookDescription').value = bookData.description || '';

            const standardGenres = ["Фантастика", "Детектив", "Роман", "Биография", "Поэзия", "Драма"];
            if (bookData.genre && !standardGenres.includes(bookData.genre)) {
                document.getElementById('editBookGenre').value = "Другое";
                document.getElementById('editOtherGenreInput').value = bookData.genre;
                document.getElementById('editOtherGenreInput').style.display = 'block';
                document.getElementById('editOtherGenreInput').required = true;
            } else {
                document.getElementById('editBookGenre').value = bookData.genre || '';
                document.getElementById('editOtherGenreInput').style.display = 'none';
                document.getElementById('editOtherGenreInput').required = false;
            }

            document.getElementById('editBookModal').classList.add('open');

            // Загружаем статус файлов
            fetch(`/get_book_files/${bookData.id}`)
                .then(r => r.json())
                .then(files => {
                    const pdfStatus = document.getElementById('editBookPdfStatus');
                    if (pdfStatus) {
                        pdfStatus.innerHTML = files.pdf_url
                            ? `<i class="fas fa-check-circle" style="color:#4CAF50"></i> PDF загружен`
                            : `<i class="fas fa-times-circle" style="color:#aaa"></i> PDF не загружен`;
                    }
                }).catch(() => {});

            loadEditBookAudioTracks(bookData.id);
        })
        .catch(error => {
            console.error('showEditBookModal error:', error);
            showStatusMessage('Ошибка загрузки книги: ' + error.message, true);
            hideEditBookModal();
        });
}

function hideEditBookModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.body.style.overflow = 'auto';
    document.getElementById('editBookModal').classList.remove('open');
    document.getElementById('editBookForm').reset();
}

function updateBook() {
    const bookId = document.getElementById('editBookId').value;
    const title = document.getElementById('editBookTitle').value.trim();
    const author = document.getElementById('editBookAuthor').value.trim();
    let genre = document.getElementById('editBookGenre').value;
    const year = document.getElementById('editBookYear').value;
    const description = document.getElementById('editBookDescription').value.trim();
    const imageFile = document.getElementById('editBookImage').files[0];
    if (genre === "Другое") {
        genre = document.getElementById('editOtherGenreInput').value.trim();
    }
    if (!title || !author || !genre) {
        showStatusMessage('Пожалуйста, заполните обязательные поля', true);
        return;
    }
    const formData = new FormData();
    formData.append('book_id', bookId);
    formData.append('title', title);
    formData.append('author', author);
    formData.append('genre', genre);
    if (year) formData.append('year', year);
    if (description) formData.append('description', description);
    if (imageFile) formData.append('image', imageFile);
    // Upload PDF if provided
    const pdfFile = document.getElementById('editBookPdf') ? document.getElementById('editBookPdf').files[0] : null;
    fetch('/update_book', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(async data => {
        if (data.success) {
            // Upload PDF separately if provided
            if (pdfFile) {
                const fd2 = new FormData();
                fd2.append('book_id', bookId);
                fd2.append('pdf_file', pdfFile);
                await fetch('/upload_book_files', {method: 'POST', body: fd2}).catch(() => {});
            }
            showStatusMessage(`Книга "${title}" успешно обновлена!`);
            hideEditBookModal();
            loadAllBooks(true); // тихое обновление — страница не сбрасывается
        } else {
            showStatusMessage('Ошибка: ' + data.message, true);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showStatusMessage('Произошла ошибка при обновлении книги', true);
    });
}

function deleteBook(bookId) {
    if (!confirm('Вы уверены, что хотите удалить эту книгу?')) return;
    fetch(`/delete_book/${bookId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showStatusMessage('Книга успешно удалена!');
            loadAllBooks(true);
        } else {
            showStatusMessage('Ошибка: ' + data.message, true);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showStatusMessage('Произошла ошибка при удалении книги', true);
    });
}

// ========== МАРАФОНЫ (оставляем без изменений) ==========

function showAddMarathonForm() {
    document.getElementById('addMarathonForm').style.display = 'block';
    document.getElementById('marathonName').focus();
    document.getElementById('marathonBookCount').value = '1';
    document.getElementById('marathonDurationValue').value = '30';
}

function hideAddMarathonForm() {
    document.getElementById('addMarathonForm').style.display = 'none';
    document.getElementById('marathonForm').reset();
}

function addMarathon() {
    const name = document.getElementById('marathonName').value.trim();
    const bookCount = document.getElementById('marathonBookCount').value;
    const durationValue = document.getElementById('marathonDurationValue').value;
    const durationUnit = document.getElementById('marathonDurationUnit').value;
    const description = document.getElementById('marathonDescription').value.trim();
    if (!name || !bookCount || !durationValue) {
        showStatusMessage('Пожалуйста, заполните все обязательные поля', true);
        return;
    }
    const durationText = `${durationValue} ${getDurationUnitText(durationValue, durationUnit)}`;
    fetch('/add_marathon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: name,
            book_count: parseInt(bookCount),
            duration: durationText,
            description: description
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showStatusMessage(`Марафон "${name}" успешно добавлен!`);
            hideAddMarathonForm();
            if (currentMarathonTab === 'system') {
                loadMarathons('system');
            } else {
                loadMarathons(currentMarathonTab);
            }
        } else {
            showStatusMessage('Ошибка: ' + (data.message || 'Неизвестная ошибка'), true);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showStatusMessage('Произошла ошибка при добавлении марафона: ' + error.message, true);
    });
}

function getDurationUnitText(value, unit) {
    const num = parseInt(value);
    if (unit === 'days') {
        return num === 1 ? 'день' : num < 5 ? 'дня' : 'дней';
    } else if (unit === 'months') {
        return num === 1 ? 'месяц' : num < 5 ? 'месяца' : 'месяцев';
    } else {
        return num === 1 ? 'год' : num < 5 ? 'года' : 'лет';
    }
}

function loadMarathons(type) {
    currentMarathonTab = type;
    const containerId = type === 'system' ? 'systemMarathonsList' : 'userMarathonsList';
    const container = document.getElementById(containerId);
    container.innerHTML = '<div class="no-books">Загрузка...</div>';
    const endpoint = type === 'system' ? '/get_system_marathons' : '/get_user_marathons';
    fetch(endpoint)
        .then(response => response.json())
        .then(data => {
            if (!data || data.length === 0) {
                container.innerHTML = '<div class="no-books">Марафоны не найдены</div>';
            } else {
                displayMarathons(data, container);
            }
        })
        .catch(error => {
            console.error('Error loading marathons:', error);
            container.innerHTML = '<div class="no-books">Ошибка загрузки марафонов</div>';
        });
}

function openMarathonTab(tabName) {
    currentMarathonTab = tabName;
    document.querySelectorAll('.marathon-tab-button').forEach(button => {
        button.classList.remove('active');
    });
    const _mt = document.querySelector(`.marathon-tab-button[data-marathon-tab="${tabName}"]`) || document.querySelector(`.marathon-tab-button[onclick="openMarathonTab('${tabName}')"]`);
    if (_mt) _mt.classList.add('active');
    document.querySelectorAll('.marathon-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Marathons`).classList.add('active');
    if (tabName === 'system') {
        loadMarathons('system');
    } else if (tabName === 'user') {
        loadUserMarathons();
    } else if (tabName === 'pending') {
        loadPendingMarathons();
    }
}

function displayMarathons(marathons, container) {
    container.innerHTML = '';
    marathons.forEach(marathon => {
        const marathonCard = document.createElement('div');
        marathonCard.className = 'marathon-card';
        let actionsHtml = '';
        if (marathon.type === 'system') {
            actionsHtml = `
                <div class="marathon-actions" onclick="toggleMarathonActions(event, ${marathon.id})">
                    <i class="fas fa-ellipsis-v"></i>
                    <div class="marathon-actions-menu">
                        <button onclick="showEditMarathonModal(${marathon.id})"><i class="fas fa-edit"></i> Редактировать</button>
                        <button onclick="deleteMarathon(${marathon.id})"><i class="fas fa-trash"></i> Удалить</button>
                    </div>
                </div>
            `;
        } else if (marathon.type === 'user') {
            actionsHtml = `
                <div class="marathon-actions" onclick="toggleMarathonActions(event, ${marathon.id})">
                    <i class="fas fa-ellipsis-v"></i>
                    <div class="marathon-actions-menu">
                        <button onclick="deleteMarathon(${marathon.id})"><i class="fas fa-trash"></i> Удалить</button>
                    </div>
                </div>
            `;
        }
        let creatorInfo = '';
        if (marathon.type === 'user' && marathon.creator_name) {
            creatorInfo = `<p class="marathon-meta"><strong>Автор:</strong> ${escapeHtml(marathon.creator_name)}</p>`;
        }
        marathonCard.innerHTML = `
            ${actionsHtml}
            <h3 class="marathon-title">${escapeHtml(marathon.name)}</h3>
            ${creatorInfo}
            <p class="marathon-meta"><strong>Книг:</strong> ${marathon.book_count}</p>
            ${marathon.duration ? `<p class="marathon-meta"><strong>Срок:</strong> ${escapeHtml(marathon.duration)}</p>` : ''}
            ${marathon.description ? `<p class="marathon-description"><strong>Описание:</strong> ${escapeHtml(marathon.description)}</p>` : ''}
            ${marathon.participants_count ? `<p class="marathon-meta"><strong>Участников:</strong> ${marathon.participants_count}</p>` : ''}
        `;
        container.appendChild(marathonCard);
    });
}

function toggleMarathonActions(event, marathonId) {
    event.stopPropagation();
    const marathonActions = event.currentTarget.querySelector('.marathon-actions-menu');
    if (marathonActions.style.display === 'block') {
        marathonActions.style.display = 'none';
    } else {
        document.querySelectorAll('.marathon-actions-menu').forEach(menu => {
            menu.style.display = 'none';
        });
        marathonActions.style.display = 'block';
    }
}

function deleteMarathon(marathonId) {
    if (!confirm('Вы уверены, что хотите удалить этот марафон?')) return;
    fetch(`/delete_marathon/${marathonId}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showStatusMessage('Марафон успешно удален!');
                if (currentMarathonTab === 'pending') {
                    loadPendingMarathons();
                } else {
                    loadMarathons(currentMarathonTab);
                }
            } else {
                showStatusMessage('Ошибка: ' + data.message, true);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showStatusMessage('Произошла ошибка при удалении марафона', true);
        });
}

function showEditMarathonModal(marathonId) {
    fetch(`/get_marathon/${marathonId}`)
        .then(response => response.json())
        .then(data => {
            if (data.id) {
                document.getElementById('editMarathonId').value = data.id;
                document.getElementById('editMarathonName').value = data.name;
                document.getElementById('editMarathonBookCount').value = data.book_count;
                if (data.duration) {
                    const durationMatch = data.duration.match(/^(\d+)\s(.+)/);
                    if (durationMatch) {
                        const value = durationMatch[1];
                        const unitText = durationMatch[2];
                        document.getElementById('editMarathonDurationValue').value = value;
                        let unit = 'days';
                        if (unitText.includes('месяц')) unit = 'months';
                        else if (unitText.includes('год')) unit = 'years';
                        document.getElementById('editMarathonDurationUnit').value = unit;
                    }
                }
                document.getElementById('editMarathonDescription').value = data.description || '';
                document.getElementById('editMarathonModal').style.display = 'block';
            } else {
                showStatusMessage(data.message || 'Ошибка при загрузке данных марафона', true);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showStatusMessage('Произошла ошибка при загрузке данных марафона', true);
        });
}

function hideEditMarathonModal() {
    document.getElementById('editMarathonModal').style.display = 'none';
    document.getElementById('editMarathonForm').reset();
}

function updateMarathon() {
    const marathonId = document.getElementById('editMarathonId').value;
    const name = document.getElementById('editMarathonName').value.trim();
    const bookCount = document.getElementById('editMarathonBookCount').value;
    const durationValue = document.getElementById('editMarathonDurationValue').value;
    const durationUnit = document.getElementById('editMarathonDurationUnit').value;
    const description = document.getElementById('editMarathonDescription').value.trim();
    if (!name || !bookCount || !durationValue) {
        showStatusMessage('Пожалуйста, заполните все обязательные поля', true);
        return;
    }
    const durationText = `${durationValue} ${getDurationUnitText(durationValue, durationUnit)}`;
    fetch('/update_marathon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            marathon_id: marathonId,
            name: name,
            book_count: bookCount,
            duration: durationText,
            description: description
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showStatusMessage(`Марафон "${name}" успешно обновлен!`);
            hideEditMarathonModal();
            if (currentMarathonTab === 'pending') {
                loadPendingMarathons();
            } else {
                loadMarathons(currentMarathonTab);
            }
        } else {
            showStatusMessage('Ошибка: ' + (data.message || 'Неизвестная ошибка'), true);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showStatusMessage('Произошла ошибка при обновлении марафона', true);
    });
}

function loadPendingMarathons() {
    const container = document.getElementById('pendingMarathonsList');
    container.innerHTML = '<div class="no-books">Загрузка...</div>';
    fetch('/get_pending_marathons')
        .then(response => response.json())
        .then(data => {
            if (data.length === 0) {
                container.innerHTML = '<div class="no-books">Нет марафонов на модерации</div>';
            } else {
                displayPendingMarathons(data, container);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            container.innerHTML = '<div class="no-books">Ошибка загрузки марафонов</div>';
        });
}

function displayPendingMarathons(marathons, container) {
    container.innerHTML = '';
    marathons.forEach(marathon => {
        const marathonCard = document.createElement('div');
        marathonCard.className = 'marathon-card';
        marathonCard.innerHTML = `
            <div class="marathon-actions" onclick="toggleMarathonActions(event, ${marathon.id})">
                <i class="fas fa-ellipsis-v"></i>
                <div class="marathon-actions-menu">
                    <button onclick="openModerateModal(${marathon.id})">
                        <i class="fas fa-eye"></i> Открыть
                    </button>
                </div>
            </div>
            <h3 class="marathon-title">${escapeHtml(marathon.name)}</h3>
            <p class="marathon-meta"><strong>Автор:</strong> ${escapeHtml(marathon.creator_name)}</p>
            <p class="marathon-meta"><strong>Книг:</strong> ${marathon.book_count}</p>
            ${marathon.duration ? `<p class="marathon-meta"><strong>Срок:</strong> ${escapeHtml(marathon.duration)}</p>` : ''}
            ${marathon.description ? `<p class="marathon-description"><strong>Описание:</strong> ${escapeHtml(marathon.description)}</p>` : ''}
        `;
        container.appendChild(marathonCard);
    });
}
let currentModerateMarathonId = null;

function openModerateModal(marathonId) {
    currentModerateMarathonId = marathonId;
    fetch(`/get_marathon_for_moderation/${marathonId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                document.getElementById('moderateMarathonName').value = data.name;
                document.getElementById('moderateMarathonCreator').value = data.creator_name;
                document.getElementById('moderateMarathonBookCount').value = data.book_count;
                document.getElementById('moderateMarathonDuration').value = data.duration || 'Не указан';
                document.getElementById('moderateMarathonDescription').value = data.description || '';
                document.getElementById('moderateMarathonModal').style.display = 'block';
            } else {
                showStatusMessage(data.message || 'Ошибка загрузки данных', true);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showStatusMessage('Ошибка загрузки данных марафона', true);
        });
}

function hideModerateMarathonModal() {
    document.getElementById('moderateMarathonModal').style.display = 'none';
    currentModerateMarathonId = null;
}

function approveMarathon() {
    if (!currentModerateMarathonId) return;
    fetch(`/approve_marathon/${currentModerateMarathonId}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showStatusMessage('Марафон одобрен и опубликован!');
                hideModerateMarathonModal();
                loadPendingMarathons();
                loadUserMarathons();
            } else {
                showStatusMessage(data.message || 'Ошибка при одобрении', true);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showStatusMessage('Ошибка при одобрении марафона', true);
        });
}

function rejectMarathon() {
    if (!currentModerateMarathonId) return;
    fetch(`/reject_marathon/${currentModerateMarathonId}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showStatusMessage('Марафон отклонен');
                hideModerateMarathonModal();
                loadPendingMarathons();
            } else {
                showStatusMessage(data.message || 'Ошибка при отклонении', true);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showStatusMessage('Ошибка при отклонении марафона', true);
        });
}

function loadUserMarathons() {
    const container = document.getElementById('userMarathonsList');
    container.innerHTML = '<div class="no-books">Загрузка...</div>';
    fetch('/get_user_marathons')
        .then(response => response.json())
        .then(data => {
            if (data.length === 0) {
                container.innerHTML = '<div class="no-books">Пользовательские марафоны не найдены</div>';
            } else {
                displayUserMarathons(data, container);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            container.innerHTML = '<div class="no-books">Ошибка загрузки марафонов</div>';
        });
}

function displayUserMarathons(marathons, container) {
    container.innerHTML = '';
    marathons.forEach(marathon => {
        const marathonCard = document.createElement('div');
        marathonCard.className = 'marathon-card';
        marathonCard.innerHTML = `
            <div class="marathon-actions" onclick="toggleMarathonActions(event, ${marathon.id})">
                <i class="fas fa-ellipsis-v"></i>
                <div class="marathon-actions-menu">
                    <button onclick="deleteMarathon(${marathon.id})"><i class="fas fa-trash"></i> Удалить</button>
                </div>
            </div>
            <h3 class="marathon-title">${escapeHtml(marathon.name)}</h3>
            <p class="marathon-meta"><strong>Автор:</strong> ${escapeHtml(marathon.creator_name)}</p>
            <p class="marathon-meta"><strong>Книг:</strong> ${marathon.book_count}</p>
            ${marathon.duration ? `<p class="marathon-meta"><strong>Срок:</strong> ${escapeHtml(marathon.duration)}</p>` : ''}
            ${marathon.description ? `<p class="marathon-description"><strong>Описание:</strong> ${escapeHtml(marathon.description)}</p>` : ''}
        `;
        container.appendChild(marathonCard);
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Закрытие модальных окон при клике вне
document.addEventListener('click', function(event) {
    document.querySelectorAll('.book-actions, .marathon-actions-menu').forEach(menu => {
        if (menu.style.display === 'block' && !menu.contains(event.target) &&
            !event.target.closest('.book-options') && !event.target.closest('.marathon-actions')) {
            menu.style.display = 'none';
        }
    });
    const editMarathonModal = document.getElementById('editMarathonModal');
    if (editMarathonModal && editMarathonModal.style.display === 'block' && !editMarathonModal.contains(event.target) && event.target !== editMarathonModal.querySelector('.modal-content')) {
        hideEditMarathonModal();
    }
    const moderateMarathonModal = document.getElementById('moderateMarathonModal');
    if (moderateMarathonModal && moderateMarathonModal.style.display === 'block' && !moderateMarathonModal.contains(event.target) && event.target !== moderateMarathonModal.querySelector('.modal-content')) {
        hideModerateMarathonModal();
    }
});
document.getElementById('modalOverlay')?.addEventListener('click', hideEditBookModal);