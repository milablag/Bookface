let currentActiveTab = 'planned';
let currentActiveSection = 'library';
let tinderBooks = [];
let currentTinderIndex = 0;
let currentMarathonTab = 'all';

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
const bookFilesCache = {};

function loadBookFiles(bookId, callback) {
    if (bookFilesCache[bookId]) {
        callback(bookFilesCache[bookId]);
        return;
    }
    fetch(`/get_book_files/${bookId}`)
        .then(response => response.json())
        .then(files => {
            bookFilesCache[bookId] = files;
            if (callback) callback(files);
        })
        .catch(error => console.error('Error loading file info:', error));
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== АУДИОПЛЕЕР ==========
// ========== АУДИОПЛЕЕР ==========
let currentAudio = null;
let isPlaying = false;
let autoSaveInterval = null;
let currentBookId = null;
let lastSavedTime = 0; // Для отслеживания последнего сохранения

// Получаем ID пользователя из сессии
const userId = document.body.getAttribute('data-session-id') || '';

// ===== PLAYLIST STATE =====
let currentPlaylist = [];     // [{id, title, url, track_order}]
let currentTrackIndex = 0;

function formatTime(s) {
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

function togglePlaylistPanel() {
    const panel = document.getElementById('playlistPanel');
    const btn = document.getElementById('togglePlaylistBtn');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        btn.style.background = 'rgba(255,211,61,0.2)';
        btn.style.borderColor = '#ffd93d';
    } else {
        panel.style.display = 'none';
        btn.style.background = 'rgba(255,255,255,0.1)';
        btn.style.borderColor = 'rgba(255,255,255,0.2)';
    }
}

function renderPlaylist() {
    const container = document.getElementById('playlistItems');
    const countLabel = document.getElementById('playlistCountLabel');
    if (!container) return;
    const n = currentPlaylist.length;
    if (countLabel) countLabel.textContent = `${n} ${n === 1 ? 'дор.' : 'дор.'}`;
    container.innerHTML = '';
    currentPlaylist.forEach((track, idx) => {
        const row = document.createElement('div');
        const isActive = idx === currentTrackIndex;
        row.style.cssText = `display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:6px;cursor:pointer;margin-bottom:3px;transition:background 0.15s;background:${isActive ? 'rgba(255,217,61,0.15)' : 'transparent'};`;
        row.innerHTML = `
            <span style="width:20px;text-align:right;font-size:11px;opacity:0.5;flex-shrink:0;">${track.track_order}</span>
            <i class="fas ${isActive ? 'fa-volume-up' : 'fa-headphones'}" style="font-size:12px;color:${isActive ? '#ffd93d' : 'rgba(255,255,255,0.4)'};flex-shrink:0;"></i>
            <span style="flex:1;font-size:12px;color:${isActive ? '#ffd93d' : 'white'};font-weight:${isActive ? 'bold' : 'normal'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(track.title)}</span>
        `;
        row.onclick = () => switchToTrack(idx);
        row.onmouseenter = () => { if (!isActive) row.style.background = 'rgba(255,255,255,0.07)'; };
        row.onmouseleave = () => { if (!isActive) row.style.background = 'transparent'; };
        container.appendChild(row);
    });
}

function switchToTrack(idx) {
    if (idx < 0 || idx >= currentPlaylist.length) return;
    currentTrackIndex = idx;
    const track = currentPlaylist[idx];
    const audioPlayer = document.getElementById('globalAudioPlayer');
    const playPauseIcon = document.getElementById('playPauseIcon');
    const trackLabel = document.getElementById('audioTrackLabel');

    if (trackLabel) {
        trackLabel.textContent = currentPlaylist.length > 1
            ? `${idx + 1}/${currentPlaylist.length} — ${track.title}`
            : track.title;
    }

    audioPlayer.src = track.url;
    audioPlayer.load();
    audioPlayer.play().then(() => {
        if (playPauseIcon) playPauseIcon.className = 'fas fa-pause';
        isPlaying = true;
    }).catch(() => {
        if (playPauseIcon) playPauseIcon.className = 'fas fa-play';
        isPlaying = false;
    });

    renderPlaylist();
    // Update prev/next button states
    updateNavButtons();
}

function updateNavButtons() {
    const prev = document.getElementById('prevTrackBtn');
    const next = document.getElementById('nextTrackBtn');
    if (prev) prev.style.opacity = currentTrackIndex > 0 ? '1' : '0.3';
    if (next) next.style.opacity = currentTrackIndex < currentPlaylist.length - 1 ? '1' : '0.3';
}

function showAudioPlayer(tracks, bookTitle, bookAuthor, bookId) {
    // Support old call style: showAudioPlayer(url_string, ...)
    if (typeof tracks === 'string') {
        tracks = [{id: 0, track_order: 1, title: bookTitle, url: tracks}];
    }

    const playerContainer = document.getElementById('audioPlayerContainer');
    const audioPlayer = document.getElementById('globalAudioPlayer');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playPauseIcon = document.getElementById('playPauseIcon');
    const progressBar = document.getElementById('progressBar');
    const progressBarContainer = document.getElementById('progressBarContainer');
    const currentTimeSpan = document.getElementById('currentTime');
    const totalTimeSpan = document.getElementById('totalTime');
    const volumeControl = document.getElementById('volumeControl');
    const rewindBackBtn = document.getElementById('rewindBackBtn');
    const rewindForwardBtn = document.getElementById('rewindForwardBtn');
    const prevTrackBtn = document.getElementById('prevTrackBtn');
    const nextTrackBtn = document.getElementById('nextTrackBtn');
    const closeBtn = document.getElementById('closeAudioPlayer');
    const audioBookTitleSpan = document.getElementById('audioBookTitle');
    const audioBookAuthorSpan = document.getElementById('audioBookAuthor');
    const trackLabel = document.getElementById('audioTrackLabel');

    currentBookId = bookId;
    currentPlaylist = tracks;

    sessionStorage.setItem('audioPlayerActive', 'true');
    sessionStorage.setItem('activeBookId', bookId);
    sessionStorage.setItem('activeBookTitle', bookTitle);
    sessionStorage.setItem('activeBookAuthor', bookAuthor);
    sessionStorage.removeItem('audioPlayerClosed');

    audioBookTitleSpan.textContent = bookTitle;
    audioBookAuthorSpan.textContent = bookAuthor;

    if (autoSaveInterval) { clearInterval(autoSaveInterval); autoSaveInterval = null; }
    if (currentAudio && currentAudio !== audioPlayer) currentAudio.pause();

    // Render playlist panel
    renderPlaylist();
    const countLabel = document.getElementById('playlistCountLabel');
    if (countLabel) countLabel.textContent = `${tracks.length} ${tracks.length === 1 ? 'дор.' : 'дор.'}`;

    playerContainer.style.display = 'block';
    currentAudio = audioPlayer;

    function saveProgressToDB(currentTime, isPlayingNow, volume) {
        if (currentBookId && userId && currentTime >= 0) {
            fetch('/save_audio_progress', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    book_id: currentBookId,
                    current_time: Math.floor(currentTime),
                    is_playing: isPlayingNow,
                    volume: volume,
                    current_track_index: currentTrackIndex
                })
            }).catch(e => console.error('Error saving progress:', e));
        }
    }

    function updateTime() {
        if (audioPlayer.duration && !isNaN(audioPlayer.duration)) {
            const current = audioPlayer.currentTime;
            const duration = audioPlayer.duration;
            const percent = (current / duration) * 100;
            progressBar.style.width = `${percent}%`;
            currentTimeSpan.textContent = formatTime(current);
            totalTimeSpan.textContent = formatTime(duration);
        }
    }

    function forceSaveProgress() {
        if (audioPlayer.duration && !isNaN(audioPlayer.duration) && audioPlayer.currentTime > 0) {
            saveProgressToDB(Math.floor(audioPlayer.currentTime), !audioPlayer.paused, audioPlayer.volume);
            lastSavedTime = Math.floor(audioPlayer.currentTime);
        }
    }

    audioPlayer.removeEventListener('timeupdate', updateTime);
    audioPlayer.removeEventListener('loadedmetadata', updateTime);
    audioPlayer.removeEventListener('pause', forceSaveProgress);
    audioPlayer.onended = null;
    audioPlayer.addEventListener('loadedmetadata', updateTime);
    audioPlayer.addEventListener('timeupdate', updateTime);
    audioPlayer.addEventListener('pause', forceSaveProgress);

    // Load saved progress and start
    getAudioProgressFromDB(bookId, (progress) => {
        let startIdx = 0;
        let startTime = 0;
        if (progress) {
            startIdx = Math.min(progress.current_track_index || 0, tracks.length - 1);
            startTime = progress.current_time || 0;
            audioPlayer.volume = progress.volume || 0.7;
            volumeControl.value = (progress.volume || 0.7) * 100;
        } else {
            audioPlayer.volume = 0.7;
            volumeControl.value = 70;
        }
        currentTrackIndex = startIdx;
        const track = tracks[startIdx];
        if (trackLabel) {
            trackLabel.textContent = tracks.length > 1
                ? `${startIdx + 1}/${tracks.length} — ${track.title}`
                : track.title;
        }
        audioPlayer.src = track.url;
        audioPlayer.load();
        renderPlaylist();
        updateNavButtons();

        audioPlayer.addEventListener('loadedmetadata', function onMeta() {
            audioPlayer.removeEventListener('loadedmetadata', onMeta);
            if (startTime > 0) audioPlayer.currentTime = startTime;
        });

        audioPlayer.play().then(() => {
            playPauseIcon.className = 'fas fa-pause';
            isPlaying = true;
        }).catch(() => {
            playPauseIcon.className = 'fas fa-play';
            isPlaying = false;
        });
    });

    autoSaveInterval = setInterval(() => {
        if (audioPlayer && audioPlayer.currentTime > 0) {
            const t = Math.floor(audioPlayer.currentTime);
            if (Math.abs(t - lastSavedTime) >= 5) {
                forceSaveProgress();
            }
        }
    }, 5000);

    playPauseBtn.onclick = () => {
        if (audioPlayer.paused) {
            audioPlayer.play().catch(() => {});
            playPauseIcon.className = 'fas fa-pause';
            isPlaying = true;
        } else {
            audioPlayer.pause();
            playPauseIcon.className = 'fas fa-play';
            isPlaying = false;
            forceSaveProgress();
        }
    };

    progressBarContainer.onclick = (e) => {
        const rect = progressBarContainer.getBoundingClientRect();
        audioPlayer.currentTime = (e.clientX - rect.left) / rect.width * audioPlayer.duration;
        forceSaveProgress();
    };

    rewindBackBtn.onclick = () => {
        audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 10);
        forceSaveProgress();
    };

    rewindForwardBtn.onclick = () => {
        audioPlayer.currentTime = Math.min(audioPlayer.duration, audioPlayer.currentTime + 10);
        forceSaveProgress();
    };

    prevTrackBtn.onclick = () => {
        if (currentTrackIndex > 0) {
            forceSaveProgress();
            switchToTrack(currentTrackIndex - 1);
        }
    };

    nextTrackBtn.onclick = () => {
        if (currentTrackIndex < currentPlaylist.length - 1) {
            forceSaveProgress();
            switchToTrack(currentTrackIndex + 1);
        }
    };

    volumeControl.oninput = (e) => {
        audioPlayer.volume = e.target.value / 100;
        forceSaveProgress();
    };

    audioPlayer.onended = () => {
        playPauseIcon.className = 'fas fa-play';
        isPlaying = false;
        // Auto-advance to next track
        if (currentTrackIndex < currentPlaylist.length - 1) {
            setTimeout(() => switchToTrack(currentTrackIndex + 1), 500);
        } else {
            // All tracks done
            progressBar.style.width = '0%';
            currentTimeSpan.textContent = '0:00';
            if (autoSaveInterval) { clearInterval(autoSaveInterval); autoSaveInterval = null; }
            saveProgressToDB(0, false, audioPlayer.volume);
            sessionStorage.removeItem('audioPlayerActive');
        }
    };

    closeBtn.onclick = () => {
        forceSaveProgress();
        audioPlayer.pause();
        playerContainer.style.display = 'none';
        if (document.getElementById('playlistPanel')) {
            document.getElementById('playlistPanel').style.display = 'none';
        }
        currentAudio = null;
        playPauseIcon.className = 'fas fa-play';
        isPlaying = false;
        if (autoSaveInterval) { clearInterval(autoSaveInterval); autoSaveInterval = null; }
        sessionStorage.setItem('audioPlayerClosed', 'true');
    };

    window.addEventListener('beforeunload', () => {
        if (audioPlayer && audioPlayer.currentTime > 0) forceSaveProgress();
    });
}

function getAudioProgressFromDB(bookId, callback) {
    if (!userId) { callback(null); return; }
    fetch(`/get_audio_progress/${bookId}`)
        .then(r => r.json())
        .then(data => {
            if (data.success && data.progress) callback(data.progress);
            else callback(null);
        })
        .catch(() => callback(null));
}

// ===== RESTORE PLAYER ON PAGE LOAD =====
function restoreAudioPlayer() {
    if (sessionStorage.getItem('audioPlayerClosed') === 'true') return;
    if (sessionStorage.getItem('audioPlayerActive') !== 'true') return;
    const savedBookId = parseInt(sessionStorage.getItem('activeBookId'));
    const savedBookTitle = sessionStorage.getItem('activeBookTitle');
    const savedBookAuthor = sessionStorage.getItem('activeBookAuthor');
    if (!savedBookId || !savedBookTitle) return;
    // Reload tracks from server and restore player
    fetch(`/get_audio_tracks/${savedBookId}`)
        .then(r => r.json())
        .then(tracks => {
            if (tracks && tracks.length > 0) {
                showAudioPlayer(tracks, savedBookTitle, savedBookAuthor, savedBookId);
            } else {
                const savedUrl = sessionStorage.getItem('activeAudioUrl');
                if (savedUrl) showAudioPlayer(savedUrl, savedBookTitle, savedBookAuthor, savedBookId);
            }
        })
        .catch(() => {
            const savedUrl = sessionStorage.getItem('activeAudioUrl');
            if (savedUrl) showAudioPlayer(savedUrl, savedBookTitle, savedBookAuthor, savedBookId);
        });
}

function logoutAndClearSession() {
    // Сохраняем последний прогресс перед выходом
    const audioPlayer = document.getElementById('globalAudioPlayer');
    if (audioPlayer && audioPlayer.currentTime > 0 && currentBookId && userId) {
        fetch('/save_audio_progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                book_id: currentBookId,
                current_time: Math.floor(audioPlayer.currentTime),
                is_playing: false,
                volume: audioPlayer.volume
            })
        }).catch(e => console.error('Error saving final progress:', e));
    }

    // Очищаем сессионные данные
    sessionStorage.removeItem('audioPlayerActive');
    sessionStorage.removeItem('audioPlayerClosed');
    sessionStorage.removeItem('activeBookId');
    sessionStorage.removeItem('activeBookTitle');
    sessionStorage.removeItem('activeBookAuthor');
    sessionStorage.removeItem('activeAudioUrl');

    // Закрываем плеер
    const playerContainer = document.getElementById('audioPlayerContainer');
    if (playerContainer) {
        playerContainer.style.display = 'none';
    }
    if (audioPlayer) {
        audioPlayer.pause();
    }

    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('profile_image');
    window.location.href = '/login';
}

function logout() {
    logoutAndClearSession();
}

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========
window.initUserPage = function () {
    // Remove no-transition class after first frame so CSS transitions work normally
    document.body.classList.add('no-transition');
    requestAnimationFrame(() => requestAnimationFrame(() => {
        document.body.classList.remove('no-transition');
    }));
    // Wire up Enter key on search input
    const searchInput = document.getElementById('bookSearch');
    if (searchInput && !searchInput._debounced) {
        searchInput._debounced = true;
        let _searchTimer;
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                clearTimeout(_searchTimer);
                _searchTimer = setTimeout(() => searchBooks(e), 150);
            }
        });
    }
    // Загружаем только стартовый экран — профиль грузим лишь при переходе в него
    loadUserBooks('planned');
    // Загружаем аватарку сразу чтобы не мигала при обновлении
    fetch('/get_profile_data')
        .then(r => r.json())
        .then(data => {
            const imgSrc = data.profile_image || '/static/ava.jpg';
            const sideAvatar = document.querySelector('.avatar');
            if (sideAvatar) sideAvatar.src = imgSrc;
            const usernameEl = document.querySelector('.username');
            if (usernameEl && data.username) usernameEl.textContent = data.username;
            // Сохраняем в localStorage — при следующем рендере React покажет
            // правильное имя сразу, без мигания "Пользователь → RALINA"
            if (data.username) localStorage.setItem('username', data.username);
            if (data.profile_image) localStorage.setItem('profile_image', data.profile_image);
            // Уведомляем React-компонент, чтобы он обновил state через useState
            window.dispatchEvent(new CustomEvent('bf:profileLoaded', { detail: {
                username: data.username,
                profile_image: imgSrc,
            }}));
        })
        .catch(() => {});
    const savedIndex = localStorage.getItem('currentTinderIndex');
    if (savedIndex) { currentTinderIndex = parseInt(savedIndex); }
    restoreAudioPlayer();
};
// DOMContentLoaded removed: React calls window.initUserPage() directly after scripts load

function cancelEdit() {
    navigateTo('library');
}

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

function showStatusMessage(message, isError = false) {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = message;
    statusMessage.style.backgroundColor = isError ? '#f44336' : '#4CAF50';
    statusMessage.classList.add('show');
    setTimeout(() => {
        statusMessage.classList.remove('show');
    }, 3000);
}

const loadedTabs = new Set(['planned']);

function openTab(tabName) {
    if (currentActiveSection !== 'library') return;
    currentActiveTab = tabName;
    document.querySelectorAll('#library-content .tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('#library-content .tab-button').forEach(button => {
        button.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    const _tb = document.querySelector(`#library-content .tab-button[data-tab="${tabName}"]`) || document.querySelector(`#library-content .tab-button[onclick="openTab('${tabName}')"]`);
    if (_tb) _tb.classList.add('active');
    if (!loadedTabs.has(tabName)) {
        loadedTabs.add(tabName);
        loadUserBooks(tabName);
    }
}

function navigateTo(section) {
    currentActiveSection = section;
    document.getElementById('currentPassword').value = '';
    document.getElementById('editPassword').value = '';
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const _ni = document.querySelector(`.nav-item[data-nav="${section}"]`) || document.querySelector(`.nav-item[onclick="navigateTo('${section}')"]`);
    if (_ni) _ni.classList.add('active');
    document.querySelectorAll('.content > .tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${section}-content`).classList.add('active');
    // Показываем поиск только в библиотеке
    const searchBar = document.getElementById('headerSearchBar');
    if (searchBar) searchBar.style.display = section === 'library' ? 'flex' : 'none';
    switch (section) {
        case 'library':
            loadUserBooks(currentActiveTab);
            break;
        case 'favorites':
            loadFavorites();
            break;
        case 'marathons':
            loadMarathons(currentMarathonTab);
            break;
        case 'tinder':
            if (!tinderBooks || tinderBooks.length === 0) {
                loadTinderBooks();
            } else {
                showCurrentTinderBook();
            }
            break;
        case 'edit_profile':
            loadProfileData();
            break;
    }
}

function loadProfileData() {
    fetch('/get_profile_data')
        .then(response => response.json())
        .then(data => {
            document.getElementById('editUsername').value = data.username || '';
            document.getElementById('editEmail').value = data.email || '';
            const imgSrc = data.profile_image || '/static/ava.jpg';
            const sideAvatar = document.querySelector('.avatar');
            if (sideAvatar) sideAvatar.src = imgSrc;
            const preview = document.getElementById('profileAvatarPreview');
            if (preview) preview.src = imgSrc;
            const titleEl = document.getElementById('profileFormUsername');
            if (titleEl) titleEl.textContent = data.username || 'Мой профиль';
        })
        .catch(error => console.error('Error loading profile data:', error));
}

function updateAvatarPreview(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('profileAvatarPreview');
        if (preview) preview.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function updateProfile(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    fetch('/update_profile', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showStatusMessage('Профиль успешно обновлен');
            const username = formData.get('username');
            if (username) document.querySelector('.username').textContent = username;
            document.getElementById('currentPassword').value = '';
            document.getElementById('editPassword').value = '';
            loadProfileData();
        } else {
            showStatusMessage(data.message || 'Ошибка при обновлении профиля', true);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showStatusMessage('Ошибка при обновлении профиля', true);
    });
    return false;
}

function loadTinderBooks() {
    const savedIndex = localStorage.getItem('tinderCurrentIndex');
    currentTinderIndex = savedIndex ? parseInt(savedIndex) : 0;
    localStorage.removeItem('tinderBooks');
    localStorage.removeItem('tinderViewedBooks');
    const _tc = document.getElementById('currentBook');
    if (_tc) _tc.innerHTML = '<div class="no-books" style="padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:#F08080;"></i><br><br>Загрузка книг...</div>';
    fetch('/get_tinder_books')
        .then(response => { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
        .then(data => {
            tinderBooks = Array.isArray(data) ? data : [];
            if (currentTinderIndex >= tinderBooks.length) currentTinderIndex = 0;
            showCurrentTinderBook();
        })
        .catch(error => {
            console.error('Error loading tinder books:', error);
            const c = document.getElementById('currentBook');
            if (c) c.innerHTML = '<div class="no-books">Ошибка загрузки книг. Попробуйте позже.</div>';
        });
}
function showCurrentTinderBook() {
    if (currentTinderIndex >= tinderBooks.length) {
        document.getElementById('currentBook').innerHTML = '<div class="no-books">Вы просмотрели все книги</div>';
        return;
    }
    const book = tinderBooks[currentTinderIndex];
    document.getElementById('currentBook').innerHTML = `
        <img class="tinder-card-image" src="${book.image_filename || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27170%27 height=%27265%27 viewBox=%270 0 170 265%27%3E%3Crect width=%27170%27 height=%27265%27 fill=%27%23f0f0f0%27/%3E%3Ctext x=%2785%27 y=%27132%27 text-anchor=%27middle%27 fill=%27%23999%27 font-size=%2714%27%3ENo Image%3C/text%3E%3C/svg%3E'}" alt="${book.title}">
        <div class="tinder-card-content">
            <h4>${book.title}</h4>
            <p><strong>Автор:</strong> ${book.author}</p>
            ${book.year ? `<p><strong>Год:</strong> ${book.year}</p>` : ''}
            ${book.description ? `<p>${book.description}</p>` : ''}
        </div>
    `;
}

function likeBook() {
    if (currentTinderIndex >= tinderBooks.length) return;
    const bookId = tinderBooks[currentTinderIndex].id;
    fetch('/add_to_favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateTinderViewedList(bookId);
            showStatusMessage('Книга добавлена в избранное');
        } else {
            showStatusMessage(data.message || 'Ошибка', true);
        }
    });
}

function dislikeBook() {
    updateTinderViewedList(tinderBooks[currentTinderIndex].id);
}

function updateTinderViewedList(bookId) {
    let viewedBooks = JSON.parse(localStorage.getItem('tinderViewedBooks') || '[]');
    if (!viewedBooks.includes(bookId)) {
        viewedBooks.push(bookId);
        localStorage.setItem('tinderViewedBooks', JSON.stringify(viewedBooks));
    }
    currentTinderIndex++;
    localStorage.setItem('tinderCurrentIndex', currentTinderIndex);
    showCurrentTinderBook();
}

function loadFavorites() {
    fetch('/get_favorites')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            const container = document.getElementById('favoritesBooks');
            if (!container) return;
            if (!Array.isArray(data) || data.length === 0) {
                container.innerHTML = '<div class="no-books">Избранные книги не найдены</div>';
            } else {
                displayFavoritesBooks(data, container);
            }
        })
        .catch(error => console.error('Error loading favorites:', error));
}

function displayFavoritesBooks(books, container) {
    container.innerHTML = '';
    books.forEach(book => {
        const bookCard = document.createElement('div');
        bookCard.className = 'favorites-book-card';
        bookCard.setAttribute('data-book-id', book.id);
        bookCard.innerHTML = `
            <img class="favorites-book-image" src="${book.image_filename || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27170%27 height=%27265%27 viewBox=%270 0 170 265%27%3E%3Crect width=%27170%27 height=%27265%27 fill=%27%23f0f0f0%27/%3E%3Ctext x=%2785%27 y=%27132%27 text-anchor=%27middle%27 fill=%27%23999%27 font-size=%2714%27%3ENo Image%3C/text%3E%3C/svg%3E'}" alt="${book.title}">
            <div class="favorites-book-info">
                <h3>${book.title}</h3>
                <p><strong>Автор:</strong> ${book.author}</p>
                <p><strong>Жанр:</strong> ${book.genre}</p>
                ${book.year ? `<p><strong>Год:</strong> ${book.year}</p>` : ''}
                ${book.description ? `<p>${book.description}</p>` : ''}
            </div>
            <div class="favorites-book-options" onclick="toggleFavoritesBookActions(event, ${book.id})">
                <i class="fas fa-ellipsis-v"></i>
                <div class="favorites-book-actions">
                    <button onclick="addToCategory(${book.id}, 'planned')">Планирую</button>
                    <button onclick="removeFromFavorites(${book.id})">Удалить</button>
                </div>
            </div>
            <div class="favorites-book-media">
                <button class="fav-audio-btn" id="fav-audio-${book.id}" style="background:none;border:none;font-size:20px;color:#ccc;cursor:pointer;" title="Слушать">
                    <i class="fas fa-headphones"></i>
                </button>
                <button class="fav-read-btn" id="fav-read-${book.id}" style="background:none;border:none;font-size:20px;color:#ccc;cursor:pointer;" title="Читать">
                    <i class="fas fa-book-open"></i>
                </button>
            </div>
        `;
        container.appendChild(bookCard);

        // Load file info for audio/read buttons
        loadBookFiles(book.id, (files) => {
            const audioBtn = document.getElementById('fav-audio-' + book.id);
            const readBtn = document.getElementById('fav-read-' + book.id);
            if (audioBtn && (files.audio_url || (files.audio_tracks && files.audio_tracks.length > 0))) {
                audioBtn.style.color = '#5bc0de';
                audioBtn.onclick = (e) => {
                    e.stopPropagation();
                    const tracks = files.audio_tracks?.length > 0 ? files.audio_tracks : [{id: 0, track_order: 1, title: book.title, url: files.audio_url}];
                    showAudioPlayer(tracks, book.title, book.author, book.id);
                };
            }
            if (readBtn && (files.md_url || files.pdf_url)) {
                readBtn.style.color = '#d9534f';
                readBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (files.md_url) openMdReader(files.md_url, book.id, book.title, book.author);
                    else openPDFViewer(files.pdf_url, book.title, book.author, book.id);
                };
            }
        });
    });
}

function toggleFavoritesBookActions(event, bookId) {
    event.stopPropagation();
    const actions = event.currentTarget.querySelector('.favorites-book-actions');
    actions.style.display = actions.style.display === 'block' ? 'none' : 'block';
}

function removeFromFavorites(bookId) {
    fetch('/remove_from_favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showStatusMessage('Книга удалена из избранного');
            loadFavorites();
        } else {
            showStatusMessage(data.message || 'Ошибка', true);
        }
    });
}

function loadUserBooks(status) {
    const container = document.getElementById(`${status}Books`);
    if (!container) return;
    container.innerHTML = '<div class="no-books"><i class="fas fa-spinner fa-spin" style="color:#F08080;"></i> Загрузка...</div>';
    fetch(`/get_user_books?status=${status}`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (!Array.isArray(data) || data.length === 0) {
                container.innerHTML = '<div class="no-books">Книги не найдены</div>';
            } else {
                displayUserBooks(data, status);
            }
        })
        .catch(error => {
            console.error('loadUserBooks error:', error);
            container.innerHTML = '<div class="no-books">Книги не найдены</div>';
        });
}
// user.js - измените функцию displayUserBooks

// user.js - исправленная функция displayUserBooks

// user.js - УПРОЩЕННАЯ версия displayUserBooks (без лишних загрузок)

function displayUserBooks(books, status) {
    const container = document.getElementById(`${status}Books`);
    if (!container) return;

    const bookListContainer = document.createElement('div');
    bookListContainer.className = 'book-list';

    books.forEach(book => {
        const bookCard = document.createElement('div');
        bookCard.className = 'book-card';
        bookCard.setAttribute('data-book-id', book.id);
        bookCard.innerHTML = `
            <div class="book-image-container">
                <img class="book-image" loading="lazy"
                     src="${book.image_filename || '/static/ava.jpg'}"
                     alt="${escapeHtml(book.title)}"
                     onerror="this.src='/static/ava.jpg'">
            </div>
            <div class="book-actions" onclick="toggleBookActions(event, ${book.id}, '${status}')" style="position:absolute;top:8px;right:8px;z-index:20;">
                <i class="fas fa-ellipsis-v"></i>
                ${getActionsMenu(book.id, status)}
            </div>
            <div class="book-info">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <button class="audio-play-btn" id="audio-btn-${book.id}-${status}"
                            style="background: none; border: none; font-size: 20px; color: #ccc; cursor: pointer;">
                        <i class="fas fa-headphones"></i>
                    </button>
                    <div style="flex: 1; text-align: center;">
                        <h3 class="book-title">${escapeHtml(book.title)}</h3>
                        <p class="book-author">${escapeHtml(book.author)}</p>
                    </div>
                    <button class="read-btn" id="read-btn-${book.id}-${status}"
                            style="background: none; border: none; font-size: 20px; color: #ccc; cursor: pointer;">
                        <i class="fas fa-book-open"></i>
                    </button>
                </div>
            </div>
        `;
        bookListContainer.appendChild(bookCard);
    });

    container.innerHTML = '';
    container.appendChild(bookListContainer);

    // Загружаем информацию о файлах
    books.forEach(book => {
        loadBookFiles(book.id, (files) => {
            const audioBtn = document.getElementById(`audio-btn-${book.id}-${status}`);
            const readBtn = document.getElementById(`read-btn-${book.id}-${status}`);
            if (!audioBtn || !readBtn) return;

            // Аудио кнопка
            if (files.audio_url || (files.audio_tracks && files.audio_tracks.length > 0)) {
                audioBtn.style.color = '#5bc0de';
                audioBtn.title = 'Слушать аудиокнигу';
                audioBtn.onclick = (e) => {
                    e.stopPropagation();
                    const tracks = files.audio_tracks?.length > 0 ? files.audio_tracks : [{id: 0, track_order: 1, title: book.title, url: files.audio_url}];
                    showAudioPlayer(tracks, book.title, book.author, book.id);
                };
            }

            // Кнопка чтения - открывает читалку (загрузка будет ТОЛЬКО внутри модального окна)
            if (files.md_url || files.pdf_url) {
                readBtn.style.color = '#d9534f';
                readBtn.title = 'Читать книгу';
                readBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (files.md_url) {
                        openMdReader(files.md_url, book.id, book.title, book.author);
                    } else if (files.pdf_url) {
                        openPDFViewer(files.pdf_url, book.title, book.author, book.id);
                    }
                };
            }
        });
    });
}

// Функция конвертации PDF в MD на сервере
function convertPdfToMd(bookId, pdfUrl, title, author) {
    fetch('/convert_pdf_to_md', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId, pdf_url: pdfUrl })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.md_url) {
            initMdReader(data.md_url, bookId, title, author);
        } else {
            showStatusMessage('Ошибка конвертации PDF', true);
        }
    })
    .catch(error => {
        console.error('Conversion error:', error);
        showStatusMessage('Ошибка при конвертации', true);
    });
}

function getActionsMenu(bookId, currentStatus) {
    const actions = {
        'planned': ['reading', 'read'],
        'reading': ['planned', 'read'],
        'read': ['planned', 'reading']
    };
    const labels = { 'planned': 'Планирую', 'reading': 'Читаю', 'read': 'Прочитано' };

    let menuItems = `<button onclick="openEditBookModal(${bookId})"><i class="fas fa-pen" style="margin-right:6px;color:#F08080;"></i>Редактировать</button>`;
    actions[currentStatus]?.forEach(action => {
        menuItems += `<button onclick="moveBookToCategory(${bookId}, '${action}')">${labels[action]}</button>`;
    });
    menuItems += `<button onclick="removeBookFromLibrary(${bookId})" style="color:#d9534f;"><i class="fas fa-trash" style="margin-right:6px;"></i>Удалить</button>`;

    return `<div class="book-actions-menu">${menuItems}</div>`;
}

// ========== РЕДАКТИРОВАНИЕ КНИГИ ==========
function openEditBookModal(bookId) {
    // Закрыть все меню
    document.querySelectorAll('.book-actions-menu').forEach(m => m.style.display = 'none');
    
    // Найти данные книги из DOM или загрузить с сервера
    const card = document.querySelector(`.book-card[data-book-id="${bookId}"]`);
    const title = card ? card.querySelector('.book-title')?.textContent || '' : '';
    const author = card ? card.querySelector('.book-author')?.textContent || '' : '';
    
    document.getElementById('editBookId').value = bookId;
    document.getElementById('editBookTitle').value = title;
    document.getElementById('editBookAuthor').value = author;
    document.getElementById('editBookGenre').value = '';
    document.getElementById('editBookYear').value = '';
    document.getElementById('editBookDescription').value = '';
    
    // Загружаем актуальные данные с сервера
    fetch(`/get_book_info/${bookId}`)
        .then(r => r.json())
        .then(data => {
            if (data) {
                document.getElementById('editBookTitle').value = data.title || title;
                document.getElementById('editBookAuthor').value = data.author || author;
                document.getElementById('editBookGenre').value = data.genre || '';
                document.getElementById('editBookYear').value = data.year || '';
                document.getElementById('editBookDescription').value = data.description || '';
            }
        })
        .catch(() => {});  // Если нет эндпоинта — просто используем данные из карточки
    
    const modal = document.getElementById('editBookModal');
    if (modal) modal.classList.add('open');
}

function closeEditBookModal() {
    const modal = document.getElementById('editBookModal');
    if (modal) modal.classList.remove('open');
}

function saveEditedBook() {
    const bookId = document.getElementById('editBookId').value;
    const title = document.getElementById('editBookTitle').value.trim();
    const author = document.getElementById('editBookAuthor').value.trim();
    const genre = document.getElementById('editBookGenre').value.trim();
    const year = document.getElementById('editBookYear').value;
    const description = document.getElementById('editBookDescription').value.trim();
    
    if (!title || !author) {
        showStatusMessage('Название и автор обязательны', true);
        return;
    }
    
    fetch('/edit_book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: parseInt(bookId), title, author, genre, year: year ? parseInt(year) : null, description })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            showStatusMessage('Книга успешно обновлена');
            closeEditBookModal();
            // Обновить карточку в DOM
            const card = document.querySelector(`.book-card[data-book-id="${bookId}"]`);
            if (card) {
                const titleEl = card.querySelector('.book-title');
                const authorEl = card.querySelector('.book-author');
                if (titleEl) titleEl.textContent = title;
                if (authorEl) authorEl.textContent = author;
            }
            // Перезагрузить все вкладки
            loadedTabs.clear();
            loadUserBooks(currentActiveTab);
        } else {
            showStatusMessage(data.message || 'Ошибка при сохранении', true);
        }
    })
    .catch(() => showStatusMessage('Ошибка соединения с сервером', true));
}

function removeBookFromLibrary(bookId) {
    if (!confirm('Удалить книгу из библиотеки?')) return;
    fetch('/remove_from_library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            showStatusMessage('Книга удалена из библиотеки');
            loadedTabs.clear();
            loadUserBooks(currentActiveTab);
        } else {
            showStatusMessage(data.message || 'Ошибка', true);
        }
    })
    .catch(() => showStatusMessage('Ошибка', true));
}

function displaySearchResults(books) {
    const resultsContainer = document.getElementById('searchResults');
    const bookListContainer = document.createElement('div');
    bookListContainer.className = 'book-list';

    books.forEach(book => {
        const bookCard = document.createElement('div');
        bookCard.className = 'book-card';
        bookCard.setAttribute('data-book-id', book.id);
        bookCard.innerHTML = `
            <div class="book-image-container">
                <img class="book-image" loading="eager" fetchpriority="high" decoding="async" src="${book.image_filename || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27170%27 height=%27265%27 viewBox=%270 0 170 265%27%3E%3Crect width=%27170%27 height=%27265%27 fill=%27%23f0f0f0%27/%3E%3Ctext x=%2785%27 y=%27132%27 text-anchor=%27middle%27 fill=%27%23999%27 font-size=%2714%27%3ENo Image%3C/text%3E%3C/svg%3E'}" alt="${escapeHtml(book.title)}">
            </div>
            <div class="book-actions" onclick="toggleBookActions(event, ${book.id}, 'search')" style="position:absolute;top:8px;right:8px;z-index:20;">
                <i class="fas fa-ellipsis-v"></i>
                <div class="book-actions-menu">
                    <button onclick="addToCategory(${book.id}, 'planned')">Планирую</button>
                    <button onclick="addToCategory(${book.id}, 'reading')">Читаю</button>
                    <button onclick="addToCategory(${book.id}, 'read')">Прочитано</button>
                </div>
            </div>
            <div class="book-info">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                    <span style="font-size: 18px; color: #ccc;"><i class="fas fa-headphones"></i></span>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 14px; font-weight: bold; margin: 0 0 2px 0; line-height: 1.2;">${escapeHtml(book.title)}</div>
                        <div style="font-size: 12px; color: #999; margin: 0;">${escapeHtml(book.author)}</div>
                    </div>
                    <span style="font-size: 18px; color: #ccc;"><i class="fas fa-book-open"></i></span>
                </div>
            </div>
        `;
        bookListContainer.appendChild(bookCard);
    });

    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(bookListContainer);
}

function toggleBookActions(event, bookId, context) {
    event.stopPropagation();
    const menu = event.currentTarget.querySelector('.book-actions-menu');
    document.querySelectorAll('.book-actions-menu').forEach(m => m.style.display = 'none');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function addToCategory(bookId, category) {
    fetch('/add_to_category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId, category: category })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showStatusMessage(`Книга добавлена в "${getCategoryName(category)}"`);
            fetch('/remove_from_favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ book_id: bookId })
            });
            // Сброс кэша файлов для этой книги чтобы подтянуть свежие данные
            delete bookFilesCache[bookId];
            loadedTabs.delete(category); // сброс чтобы вкладка перезагрузилась
            loadUserBooks(category);
            document.getElementById('bookSearch').value = '';
            document.getElementById('searchResults').innerHTML = '';
            // Переключаем на вкладку где появилась книга
            openTab(category);
        } else {
            showStatusMessage(data.message || 'Ошибка', true);
        }
    });
}

function getCategoryName(category) {
    const names = { 'planned': 'Планирую', 'reading': 'Читаю', 'read': 'Прочитано' };
    return names[category] || category;
}

// bookSearch listeners moved into initUserPage to avoid null errors in React
// document.getElementById('bookSearch') listeners are handled by initUserPage

function searchBooks(event) {
    event.preventDefault();
    const searchTerm = document.getElementById('bookSearch').value.trim();
    if (!searchTerm) return;

    fetch('/search_books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search_term: searchTerm })
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    })
    .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
            document.getElementById('searchResults').innerHTML = '<div class="no-books">Книги не найдены</div>';
        } else {
            displaySearchResults(data);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showStatusMessage('Ошибка при поиске книг', true);
    });
}

function moveBookToCategory(bookId, newCategory) {
    const bookCard = document.querySelector(`.book-card[data-book-id="${bookId}"]`);
    if (!bookCard) return;

    fetch('/move_to_category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId, new_category: newCategory })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showStatusMessage(`Книга перемещена в "${getCategoryName(newCategory)}"`);
            // Сбрасываем все вкладки чтобы они перезагрузились при открытии
            loadedTabs.clear();
            loadedTabs.add(currentActiveTab);
            // Перезагружаем только текущую и целевую
            loadUserBooks(currentActiveTab);
            if (newCategory !== currentActiveTab) loadUserBooks(newCategory);
        } else {
            showStatusMessage('Не удалось переместить книгу', true);
        }
    });
}

// ========== МАРАФОНЫ ==========
function showAddMarathonForm() {
    const form = document.getElementById('addMarathonForm');
    if (form) form.style.display = 'block';
}

function hideAddMarathonForm() {
    const form = document.getElementById('addMarathonForm');
    if (form) form.style.display = 'none';
    const mForm = document.getElementById('marathonForm');
    if (mForm) mForm.reset();
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

function addMarathon(event) {
    if (event) event.preventDefault();
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
        body: JSON.stringify({ name, book_count: parseInt(bookCount), duration: durationText, description })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            showStatusMessage(`Марафон "${name}" отправлен на модерацию`);
            hideAddMarathonForm();
            loadMarathons(currentMarathonTab);
        } else {
            showStatusMessage(data.message || 'Ошибка при создании марафона', true);
        }
    })
    .catch(() => showStatusMessage('Ошибка соединения', true));
}

function openMarathonTab(tabName) {
    currentMarathonTab = tabName;
    document.querySelectorAll('#marathons-content .tab-button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`#marathons-content .tab-button[data-marathon-tab="${tabName}"]`) || document.querySelector(`#marathons-content .tab-button[onclick="openMarathonTab('${tabName}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
    document.querySelectorAll('#marathons-content > .tab-content').forEach(content => content.classList.remove('active'));
    const tabEl = document.getElementById(`${tabName}Marathons`);
    if (tabEl) tabEl.classList.add('active');
    loadMarathons(tabName);
}

function loadMarathons(type) {
    const container = document.getElementById(`${type}MarathonsList`);
    if (!container) return;
    container.innerHTML = '<div class="no-books">Загрузка...</div>';

    fetch(`/get_${type}_marathons`)
        .then(response => response.json())
        .then(data => {
            if (!Array.isArray(data) || data.length === 0) {
                container.innerHTML = '<div class="no-books">Марафоны не найдены</div>';
            } else {
                displayMarathons(data, container, type);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            container.innerHTML = '<div class="no-books">Ошибка загрузки</div>';
        });
}

function displayMarathons(marathons, container, type) {
    container.innerHTML = '';
    marathons.forEach(marathon => {
        const card = document.createElement('div');
        card.className = 'marathon-card';

        const isJoined = marathon.is_joined || marathon.is_participant;
        const isCreator = marathon.is_creator;
        const progress = marathon.progress;
        const canJoinLeave = type === 'all' || type === 'my' || type === 'active';

        let actionsHtml = '';
        if (canJoinLeave && !isCreator) {
            if (isJoined) {
                actionsHtml = `<button class="marathon-leave-btn" onclick="leaveMarathon(${marathon.id}, this)" style="background:#ff6b6b;color:white;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-size:13px;">Покинуть</button>`;
            } else {
                actionsHtml = `<button class="marathon-join-btn" onclick="joinMarathon(${marathon.id}, this)" style="background:#4CAF50;color:white;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-size:13px;">Вступить</button>`;
            }
        }

        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                <h3 style="margin:0;font-size:16px;">${escapeHtml(marathon.name)}</h3>
                ${actionsHtml}
            </div>
            ${marathon.creator_name ? `<p style="margin:3px 0;font-size:13px;color:#888;"><strong>Автор:</strong> ${escapeHtml(marathon.creator_name)}</p>` : ''}
            <p style="margin:3px 0;font-size:13px;"><strong>Книг:</strong> ${marathon.book_count}</p>
            ${marathon.duration ? `<p style="margin:3px 0;font-size:13px;"><strong>Срок:</strong> ${escapeHtml(marathon.duration)}</p>` : ''}
            ${marathon.description ? `<p style="margin:6px 0 0;font-size:13px;color:#555;">${escapeHtml(marathon.description)}</p>` : ''}
            ${progress !== undefined && progress !== null ? `
            <div style="margin-top:10px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
                    <span>Прогресс</span><span>${progress}/${marathon.book_count}</span>
                </div>
                <div style="height:6px;background:#eee;border-radius:3px;overflow:hidden;">
                    <div style="height:100%;width:${marathon.book_count > 0 ? Math.round((progress/marathon.book_count)*100) : 0}%;background:#4CAF50;border-radius:3px;"></div>
                </div>
            </div>` : ''}
        `;
        container.appendChild(card);
    });
}

function joinMarathon(marathonId, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    fetch('/join_marathon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marathon_id: marathonId })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            showStatusMessage('Вы вступили в марафон!');
            loadMarathons(currentMarathonTab);
        } else {
            showStatusMessage(data.message || 'Ошибка', true);
            if (btn) { btn.disabled = false; btn.textContent = 'Вступить'; }
        }
    })
    .catch(() => {
        showStatusMessage('Ошибка соединения', true);
        if (btn) { btn.disabled = false; btn.textContent = 'Вступить'; }
    });
}

function leaveMarathon(marathonId, btn) {
    if (!confirm('Покинуть марафон?')) return;
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    fetch('/leave_marathon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marathon_id: marathonId })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            showStatusMessage('Вы покинули марафон');
            loadMarathons(currentMarathonTab);
        } else {
            showStatusMessage(data.message || 'Ошибка', true);
            if (btn) { btn.disabled = false; btn.textContent = 'Покинуть'; }
        }
    })
    .catch(() => {
        showStatusMessage('Ошибка соединения', true);
        if (btn) { btn.disabled = false; btn.textContent = 'Покинуть'; }
    });
}


document.addEventListener('click', function (e) {
    document.querySelectorAll('.book-actions-menu, .marathon-actions-menu').forEach(menu => {
        menu.style.display = 'none';
    });
    // Закрытие модального окна по клику на фон
    const modal = document.getElementById('editBookModal');
    if (modal && e.target === modal) closeEditBookModal();
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeEditBookModal();
});

// Сохранение прогресса в БД
function saveAudioProgressToDB(bookId, currentTime, isPlaying, volume) {
    fetch('/save_audio_progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            book_id: bookId,
            current_time: currentTime,
            is_playing: isPlaying,
            volume: volume
        })
    }).catch(e => console.error('Error saving progress to DB:', e));
}