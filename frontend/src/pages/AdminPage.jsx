import { useEffect, useRef, useState } from 'react'
import { getSession } from '../api.js'

function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return }
    const s = document.createElement('script')
    s.id = id; s.src = src
    s.onload = resolve; s.onerror = reject
    document.body.appendChild(s)
  })
}
function removeScript(id) { document.getElementById(id)?.remove() }

function PageLoader() {
  return (
    <div className="bf-page-loader">
      <div className="bf-spinner" />
      <span className="bf-spinner-text">Загрузка...</span>
    </div>
  )
}

export default function AdminPage() {
  const session     = getSession()
  const initialised = useRef(false)
  const [username,     setUsername]     = useState(session.username      || 'Администратор')
  const [profileImage, setProfileImage] = useState(session.profile_image || '/static/ava.jpg')

  // ── Effect 1: грузим CSS и скрипты ──────────────────────────────────────
  useEffect(() => {
    window.__API_URL__       = (import.meta.env.VITE_API_URL || '/api')
    window.__INITIAL_BOOKS__ = []

    if (document.getElementById('script-admin')) {
      setPageReady(true)
      return
    }

    initialised.current = false
    const scriptPromise = loadScript('/static/js/proxy-interceptor.js?v=5', 'script-interceptor')
      .then(() => loadScript('/static/js/admin.js', 'script-admin'))

    scriptPromise
      .then(() => { window.initAdminPage?.() })
      .catch((e) => { console.error('[AdminPage] load error:', e) })

    return () => {
      initialised.current = false
      removeScript('script-admin')

    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 2: слушаем событие от admin.js когда профиль загружен ──────────
  useEffect(() => {
    function onProfile(e) {
      const data = e.detail || {}
      if (data.username)      setUsername(data.username)
      if (data.profile_image) setProfileImage(data.profile_image)
    }
    window.addEventListener('bf:profileLoaded', onProfile)
    return () => window.removeEventListener('bf:profileLoaded', onProfile)
  }, [])

  return (
    <>
      <div className="modal-overlay" id="modalOverlay"></div>
      <div className="app-container">
        <div className="sidebar" id="sidebar">
          <img src={profileImage} alt="Avatar" className="avatar" />
          <div className="username">{username}</div>
          <div className="nav-container">
            <div className="nav-item active" data-nav="library"
              onClick={() => window.navigateTo?.('library')}>
              <i className="fas fa-book"></i>
              <span className="nav-text">Библиотека</span>
            </div>
            <div className="nav-item" data-nav="marathons"
              onClick={() => window.navigateTo?.('marathons')}>
              <i className="fas fa-flag"></i>
              <span className="nav-text">Марафоны</span>
            </div>
            <div className="nav-item" onClick={() => window.logout?.()}>
              <i className="fas fa-sign-out-alt"></i>
              <span className="nav-text">Выйти</span>
            </div>
          </div>
          <div className="toggle-btn" onClick={() => window.toggleSidebar?.()}>
            <i className="fas fa-chevron-left"></i>
          </div>
        </div>

        <div className="content-wrapper">
          <div className="header">
            <div className="site-title">BookFace Admin</div>
          </div>

          <div className="content">
            {/* Library section */}
            <div id="libraryContent">
              <div className="search-container">
                <input
                  type="text"
                  id="bookSearch"
                  placeholder="Поиск по автору или названию..."
                  onKeyDown={(e) => e.key === 'Enter' && window.searchBooks?.(e)}
                />
                <button onClick={(e) => window.searchBooks?.(e)}>Поиск</button>
                <button className="show-all-btn" onClick={() => window.showAllBooks?.()}>Показать все</button>
                <button className="add-book-btn" onClick={() => window.showAddBookForm?.()}>Добавить книгу</button>
              </div>
              <div id="addBookForm">
                <h3>Добавить новую книгу</h3>
                <form id="bookForm" onSubmit={(e) => e.preventDefault()}>
                  <div className="form-group">
                    <label>Название книги</label>
                    <input type="text" id="bookTitle" required />
                  </div>
                  <div className="form-group">
                    <label>Автор</label>
                    <input type="text" id="bookAuthor" required />
                  </div>
                  <div className="form-group">
                    <label>Жанр</label>
                    <select id="bookGenre" required
                      onChange={(e) => window.checkOtherGenre?.(e.target)}>
                      <option value="">Выберите жанр</option>
                      <option value="Фантастика">Фантастика</option>
                      <option value="Детектив">Детектив</option>
                      <option value="Роман">Роман</option>
                      <option value="Биография">Биография</option>
                      <option value="Поэзия">Поэзия</option>
                      <option value="Драма">Драма</option>
                      <option value="Другое">Другое</option>
                    </select>
                    <input type="text" id="otherGenreInput"
                      style={{display:'none',marginTop:'5px'}} placeholder="Укажите жанр" />
                  </div>
                  <div className="form-group">
                    <label>Год издания</label>
                    <input type="number" id="bookYear" min="1000" max="2099" step="1" placeholder="Год" />
                  </div>
                  <div className="form-group">
                    <label>Описание</label>
                    <textarea id="bookDescription"></textarea>
                  </div>
                  <div className="form-group">
                    <label>Картинка</label>
                    <input type="file" id="bookImage" accept="image/*" />
                  </div>
                  <div className="form-group">
                    <label>PDF файл (книга)</label>
                    <input type="file" id="bookPdf" accept=".pdf" />
                  </div>
                  <div className="form-group">
                    <label>Аудиодорожки (аудиокнига)</label>
                    <div id="audioTracksQueue" className="audio-tracks-list"></div>
                    <button type="button" className="add-track-btn"
                      onClick={() => window.addAudioTrackRow?.()}>
                      <i className="fas fa-plus"></i> Добавить дорожку
                    </button>
                  </div>
                  <div className="form-actions">
                    <button type="button" className="submit-btn"
                      onClick={() => window.addBook?.()}>Добавить</button>
                    <button type="button" className="cancel-btn"
                      onClick={() => window.hideAddBookForm?.()}>Отмена</button>
                  </div>
                </form>
              </div>
              <div className="search-results" id="searchResults"></div>
            </div>

            {/* Marathons section */}
            <div id="marathonsContent" style={{display:'none'}}>
              <div className="marathon-sticky-header">
                <div className="marathons-header">
                  <button className="add-marathon-btn"
                    onClick={() => window.showAddMarathonForm?.()}>Добавить марафон</button>
                </div>
                <div className="marathon-tabs">
                  <button className="marathon-tab-button" data-marathon-tab="system"
                    onClick={() => window.openMarathonTab?.('system')}>Системные</button>
                  <button className="marathon-tab-button" data-marathon-tab="user"
                    onClick={() => window.openMarathonTab?.('user')}>Пользовательские</button>
                  <button className="marathon-tab-button" data-marathon-tab="pending"
                    onClick={() => window.openMarathonTab?.('pending')}>Предложенные</button>
                </div>
              </div>

              <div id="addMarathonForm">
                <h3>Добавить новый марафон</h3>
                <form id="marathonForm" onSubmit={(e) => e.preventDefault()}>
                  <div className="form-group">
                    <label>Название марафона</label>
                    <input type="text" id="marathonName" required />
                  </div>
                  <div className="form-group">
                    <label>Количество книг</label>
                    <input type="number" id="marathonBookCount" min="1" required />
                  </div>
                  <div className="form-group">
                    <label>Срок</label>
                    <div className="duration-selector">
                      <input type="number" id="marathonDurationValue" min="1" defaultValue="30" required />
                      <select id="marathonDurationUnit">
                        <option value="days">дней</option>
                        <option value="months">месяцев</option>
                        <option value="years">лет</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Описание</label>
                    <textarea id="marathonDescription"></textarea>
                  </div>
                  <div className="form-actions">
                    <button type="button" className="submit-btn"
                      onClick={() => window.addMarathon?.()}>Добавить</button>
                    <button type="button" className="cancel-btn"
                      onClick={() => window.hideAddMarathonForm?.()}>Отмена</button>
                  </div>
                </form>
              </div>

              <div id="systemMarathons" className="marathon-tab-content">
                <div className="marathon-list" id="systemMarathonsList"></div>
              </div>
              <div id="userMarathons" className="marathon-tab-content">
                <div className="marathon-list" id="userMarathonsList"></div>
              </div>
              <div id="pendingMarathons" className="marathon-tab-content active">
                <div className="marathon-list" id="pendingMarathonsList"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Marathon Modal */}
      <div id="editMarathonModal" className="modal">
        <div className="modal-content">
          <span className="close" onClick={() => window.hideEditMarathonModal?.()}>&times;</span>
          <h3>Редактировать марафон</h3>
          <form id="editMarathonForm" onSubmit={(e) => e.preventDefault()}>
            <input type="hidden" id="editMarathonId" />
            <div className="form-group">
              <label>Название марафона</label>
              <input type="text" id="editMarathonName" required />
            </div>
            <div className="form-group">
              <label>Количество книг</label>
              <input type="number" id="editMarathonBookCount" min="1" required />
            </div>
            <div className="form-group">
              <label>Срок</label>
              <div className="duration-selector">
                <input type="number" id="editMarathonDurationValue" min="1" required />
                <select id="editMarathonDurationUnit">
                  <option value="days">дней</option>
                  <option value="months">месяцев</option>
                  <option value="years">лет</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Описание</label>
              <textarea id="editMarathonDescription"></textarea>
            </div>
            <div className="form-actions">
              <button type="button" className="submit-btn"
                onClick={() => window.updateMarathon?.()}>Сохранить</button>
              <button type="button" className="cancel-btn"
                onClick={() => window.hideEditMarathonModal?.()}>Отмена</button>
            </div>
          </form>
        </div>
      </div>

      {/* Moderate Marathon Modal */}
      <div id="moderateMarathonModal" className="modal">
        <div className="modal-content">
          <span className="close" onClick={() => window.hideModerateMarathonModal?.()}>&times;</span>
          <h3>Просмотр марафона</h3>
          <div className="form-group">
            <label>Название марафона</label>
            <input type="text" id="moderateMarathonName" readOnly className="form-control" />
          </div>
          <div className="form-group">
            <label>Создатель</label>
            <input type="text" id="moderateMarathonCreator" readOnly className="form-control" />
          </div>
          <div className="form-group">
            <label>Количество книг</label>
            <input type="number" id="moderateMarathonBookCount" readOnly className="form-control" />
          </div>
          <div className="form-group">
            <label>Срок</label>
            <input type="text" id="moderateMarathonDuration" readOnly className="form-control" />
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea id="moderateMarathonDescription" readOnly className="form-control" rows="5"></textarea>
          </div>
          <div className="form-actions">
            <button type="button" className="submit-btn"
              onClick={() => window.approveMarathon?.()}>Одобрить</button>
            <button type="button" className="cancel-btn"
              onClick={() => window.rejectMarathon?.()}>Отклонить</button>
          </div>
        </div>
      </div>

      {/* Status message */}
      <div className="status-message" id="statusMessage"></div>

      {/* Edit Book Modal */}
      <div id="editBookModal">
        <button className="close-btn" onClick={() => window.hideEditBookModal?.()}>&times;</button>
        <h3>Редактировать книгу</h3>
        <form id="editBookForm" onSubmit={(e) => e.preventDefault()}>
          <input type="hidden" id="editBookId" />
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Название книги</label>
              <input type="text" id="editBookTitle" required />
            </div>
            <div className="form-group">
              <label>Автор</label>
              <input type="text" id="editBookAuthor" required />
            </div>
            <div className="form-group">
              <label>Год издания</label>
              <input type="number" id="editBookYear" min="1000" max="2099" step="1" placeholder="Год" />
            </div>
            <div className="form-group">
              <label>Жанр</label>
              <select id="editBookGenre" required
                onChange={(e) => window.checkOtherGenre?.(e.target)}>
                <option value="">Выберите жанр</option>
                <option value="Фантастика">Фантастика</option>
                <option value="Детектив">Детектив</option>
                <option value="Роман">Роман</option>
                <option value="Биография">Биография</option>
                <option value="Поэзия">Поэзия</option>
                <option value="Драма">Драма</option>
                <option value="Другое">Другое</option>
              </select>
              <input type="text" id="editOtherGenreInput"
                style={{display:'none',marginTop:'6px'}} placeholder="Укажите жанр" />
            </div>
            <div className="form-group">
              <label>Картинка</label>
              <input type="file" id="editBookImage" accept="image/*" />
            </div>
            <div className="form-group full-width">
              <label>Описание</label>
              <textarea id="editBookDescription"></textarea>
            </div>
            <div className="form-group full-width">
              <label>PDF файл</label>
              <div id="editBookPdfStatus"
                style={{fontSize:'13px',color:'#27ae60',marginBottom:'6px',display:'flex',alignItems:'center',gap:'5px'}}></div>
              <input type="file" id="editBookPdf" accept=".pdf" />
            </div>
            <div className="form-group full-width">
              <label>Аудиодорожки</label>
              <div id="editBookAudioTracks" className="audio-tracks-list"></div>
              <div style={{display:'flex',gap:'8px',marginTop:'8px',alignItems:'center',flexWrap:'wrap'}}>
                <input type="text" id="newTrackTitle" placeholder="Название дорожки"
                  style={{flex:1,minWidth:'120px'}} />
                <input type="file" id="newTrackFile" accept=".mp3,.wav,.ogg,.m4a"
                  style={{flex:1,minWidth:'120px'}} />
                <button type="button" className="add-track-btn"
                  onClick={() => window.uploadNewAudioTrack?.()}>
                  <i className="fas fa-upload"></i> Загрузить
                </button>
              </div>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="cancel-btn"
              onClick={() => window.hideEditBookModal?.()}>Отмена</button>
            <button type="button" className="submit-btn"
              onClick={() => window.updateBook?.()}>Сохранить</button>
          </div>
        </form>
      </div>
    </>
  )
}