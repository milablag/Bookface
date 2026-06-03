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

export default function UserPage() {
  const session = getSession()
  const initialised = useRef(false)
  const [username, setUsername] = useState(session.username || 'Пользователь')
  const [profileImage, setProfileImage] = useState(session.profile_image || '/static/ava.jpg')

  useEffect(() => {
    window.__API_URL__ = (import.meta.env.VITE_API_URL || '/api')
    document.body.setAttribute('data-session-id', session.user_id || '')
    if (initialised.current) return
    initialised.current = true
    loadScript('/static/js/proxy-interceptor.js?v=5', 'script-interceptor')
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js', 'script-marked'))
      .then(() => loadScript('/static/js/user.js?v=5', 'script-user'))
      .then(() => {
        window.initUserPage?.()
        return loadScript('/static/js/pdf_viewer.js', 'script-pdf-viewer')
      })
      .catch((e) => {
        console.error('[UserPage] script load error:', e)
        window.initUserPage?.()
      })
    return () => {
      initialised.current = false
      removeScript('script-user')
      removeScript('script-pdf-viewer')
    }
  }, [])

  useEffect(() => {
    function onProfile(e) {
      const data = e.detail || {}
      if (data.username) setUsername(data.username)
      if (data.profile_image) setProfileImage(data.profile_image)
    }
    window.addEventListener('bf:profileLoaded', onProfile)
    return () => window.removeEventListener('bf:profileLoaded', onProfile)
  }, [])

  return (
    <>
      <div className="app-container" data-session-id={session.user_id || ''}>
        <div className="sidebar" id="sidebar">
          <img src={profileImage} alt="Avatar" className="avatar" />
          <div className="username">{username}</div>
          <div className="nav-container">
            <div className="nav-item" data-nav="edit_profile" onClick={() => window.navigateTo?.('edit_profile')}>
              <i className="fas fa-user-edit"></i>
              <span className="nav-text">Личный кабинет</span>
            </div>
            <div className="nav-item active" data-nav="library" onClick={() => window.navigateTo?.('library')}>
              <i className="fas fa-book"></i>
              <span className="nav-text">Моя библиотека</span>
            </div>
            <div className="nav-item" data-nav="favorites" onClick={() => window.navigateTo?.('favorites')}>
              <i className="fas fa-star"></i>
              <span className="nav-text">Избранное</span>
            </div>
            <div className="nav-item" data-nav="marathons" onClick={() => window.navigateTo?.('marathons')}>
              <i className="fas fa-flag"></i>
              <span className="nav-text">Марафоны</span>
            </div>
            <div className="nav-item" data-nav="tinder" onClick={() => window.navigateTo?.('tinder')}>
              <i className="fas fa-heart"></i>
              <span className="nav-text">Книжный тиндер</span>
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
          {/* Header — только название, без поиска */}
          <div className="header">
            <div className="site-title">BookFace</div>
          </div>

          <div className="content">
            {/* Личный кабинет */}
            <div id="edit_profile-content" className="tab-content">
              <form id="editProfileForm" onSubmit={(e) => { e.preventDefault(); window.updateProfile?.(e) }}>
                <input type="file" id="editProfileImage" name="profile_image" accept="image/*"
                  onChange={(e) => window.updateAvatarPreview?.(e)} />
                <div className="profile-form-header">
                  <div className="profile-avatar-wrap">
                    <img id="profileAvatarPreview" className="profile-avatar-preview"
                      src="/static/ava.jpg" alt="Аватар"
                      onClick={() => document.getElementById('editProfileImage').click()} />
                    <label className="profile-avatar-edit-label" htmlFor="editProfileImage" title="Изменить фото">
                      <i className="fas fa-camera"></i>
                    </label>
                  </div>
                  <div className="profile-form-title" id="profileFormUsername">Мой профиль</div>
                </div>
                <div className="profile-form-body">
                  <div className="form-section-label"><i className="fas fa-user"></i> Основные данные</div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="editUsername"><i className="fas fa-at"></i> Имя пользователя</label>
                      <input type="text" id="editUsername" name="username" placeholder="Введите имя..." />
                    </div>
                    <div className="form-group">
                      <label htmlFor="editEmail"><i className="fas fa-envelope"></i> Email</label>
                      <input type="email" id="editEmail" name="email" placeholder="your@email.com" />
                    </div>
                  </div>
                  <div className="form-section-label"><i className="fas fa-lock"></i> Смена пароля</div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="currentPassword"><i className="fas fa-key"></i> Текущий пароль</label>
                      <input type="password" id="currentPassword" name="current_password" placeholder="Текущий пароль" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="editPassword"><i className="fas fa-shield-alt"></i> Новый пароль</label>
                      <input type="password" id="editPassword" name="password" placeholder="Новый пароль" />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="button" onClick={() => window.cancelEdit?.()}>
                      <i className="fas fa-times"></i> Отменить
                    </button>
                    <button type="submit">
                      <i className="fas fa-check"></i> Сохранить изменения
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Библиотека — поиск внутри вкладки, над табами, как в Flask */}
            <div id="library-content" className="tab-content active">
              <div className="search-container">
                <input type="text" id="bookSearch" placeholder="Поиск по автору или названию..."
                  onKeyDown={(e) => e.key === 'Enter' && window.searchBooks?.(e)} />
                <button onClick={(e) => window.searchBooks?.(e)}>Поиск</button>
              </div>
              <div className="search-results" id="searchResults"></div>
              <div className="tabs">
                <button className="tab-button active" onClick={() => window.openTab?.('planned')}>Планирую</button>
                <button className="tab-button" onClick={() => window.openTab?.('reading')}>Читаю</button>
                <button className="tab-button" onClick={() => window.openTab?.('read')}>Прочитано</button>
              </div>
              <div id="planned" className="tab-content active">
                <h3>Запланированные книги</h3>
                <div className="book-list" id="plannedBooks"></div>
              </div>
              <div id="reading" className="tab-content">
                <h3>Читаю сейчас</h3>
                <div className="book-list" id="readingBooks"></div>
              </div>
              <div id="read" className="tab-content">
                <h3>Прочитанные книги</h3>
                <div className="book-list" id="readBooks"></div>
              </div>
            </div>

            {/* Избранное */}
            <div id="favorites-content" className="tab-content">
              <div className="search-results" id="favoritesBooks"></div>
            </div>

            {/* Марафоны */}
            <div id="marathons-content" className="tab-content">
              <div className="marathons-header">
                <div className="tabs">
                  <button className="tab-button active" onClick={() => window.openMarathonTab?.('all')}>Все</button>
                  <button className="tab-button" onClick={() => window.openMarathonTab?.('my')}>Мои</button>
                  <button className="tab-button" onClick={() => window.openMarathonTab?.('active')}>Активные</button>
                  <button className="tab-button" onClick={() => window.openMarathonTab?.('completed')}>Завершенные</button>
                  <button className="add-marathon-btn" onClick={() => window.showAddMarathonForm?.()}>Добавить марафон</button>
                </div>
              </div>
              <div id="addMarathonForm" style={{ display: 'none', marginTop: '20px' }}>
                <h3>Добавить новый марафон</h3>
                <form id="marathonForm" onSubmit={(e) => { e.preventDefault(); window.addMarathon?.(e) }}>
                  <div className="form-group"><label>Название марафона</label><input type="text" id="marathonName" required /></div>
                  <div className="form-group"><label>Количество книг</label><input type="number" id="marathonBookCount" min="1" defaultValue="1" required /></div>
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
                  <div className="form-group"><label>Описание</label><textarea id="marathonDescription" rows="4"></textarea></div>
                  <div className="form-actions">
                    <button type="submit" className="submit-btn">Добавить</button>
                    <button type="button" className="cancel-btn" onClick={() => window.hideAddMarathonForm?.()}>Отмена</button>
                  </div>
                </form>
              </div>
              <div id="allMarathons" className="tab-content active"><div className="marathon-list" id="allMarathonsList"></div></div>
              <div id="myMarathons" className="tab-content"><div className="marathon-list" id="myMarathonsList"></div></div>
              <div id="activeMarathons" className="tab-content"><div className="marathon-list" id="activeMarathonsList"></div></div>
              <div id="completedMarathons" className="tab-content"><div className="marathon-list" id="completedMarathonsList"></div></div>
            </div>

            {/* Тиндер */}
            <div id="tinder-content" className="tab-content">
              <div className="tinder-container">
                <div className="tinder-card" id="currentBook"></div>
                <div className="tinder-actions">
                  <button className="tinder-like" onClick={() => window.likeBook?.()}><i className="fas fa-heart"></i></button>
                  <button className="tinder-dislike" onClick={() => window.dislikeBook?.()}><i className="fas fa-times"></i></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="status-message" id="statusMessage"></div>

      {/* Аудиоплеер */}
      <div id="audioPlayerContainer" style={{position:'fixed',bottom:0,left:0,right:0,background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)',color:'white',display:'none',zIndex:1000}}>
        <div id="playlistPanel" style={{display:'none',borderBottom:'1px solid rgba(255,255,255,0.1)',maxHeight:'220px',overflowY:'auto',padding:'8px 20px'}}>
          <div style={{fontSize:'12px',color:'#ffd93d',fontWeight:'bold',marginBottom:'6px'}}>СОДЕРЖАНИЕ</div>
          <div id="playlistItems"></div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'14px',flexWrap:'wrap',justifyContent:'center',padding:'13px 20px'}}>
          <button id="closeAudioPlayer" style={{background:'none',border:'none',color:'#ff6b6b',fontSize:'22px',cursor:'pointer'}}>✕</button>
          <div style={{minWidth:'190px',textAlign:'left'}}>
            <div id="audioBookTitle" style={{fontSize:'13px',color:'#ffd93d',fontWeight:'bold'}}>Название книги</div>
            <div id="audioBookAuthor" style={{fontSize:'11px',opacity:0.7}}>Автор</div>
            <div id="audioTrackLabel" style={{fontSize:'11px',color:'#a8dadc'}}></div>
          </div>
          <button id="togglePlaylistBtn" onClick={() => window.togglePlaylistPanel?.()} style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'white',borderRadius:'6px',padding:'6px 11px',cursor:'pointer'}}>
            <i className="fas fa-list-ul"></i> <span id="playlistCountLabel">0 дор.</span>
          </button>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <button id="prevTrackBtn" style={{background:'none',border:'none',color:'white',fontSize:'18px',cursor:'pointer'}}><i className="fas fa-step-backward"></i></button>
            <button id="rewindBackBtn" style={{background:'none',border:'none',color:'white',fontSize:'18px',cursor:'pointer'}}><i className="fas fa-backward"></i></button>
            <button id="playPauseBtn" style={{background:'#ffd93d',border:'none',color:'#1a1a2e',width:'46px',height:'46px',borderRadius:'50%',fontSize:'22px',cursor:'pointer'}}>
              <i id="playPauseIcon" className="fas fa-play"></i>
            </button>
            <button id="rewindForwardBtn" style={{background:'none',border:'none',color:'white',fontSize:'18px',cursor:'pointer'}}><i className="fas fa-forward"></i></button>
            <button id="nextTrackBtn" style={{background:'none',border:'none',color:'white',fontSize:'18px',cursor:'pointer'}}><i className="fas fa-step-forward"></i></button>
          </div>
          <div style={{flex:1,minWidth:'180px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <span id="currentTime" style={{fontSize:'11px'}}>0:00</span>
              <div style={{flex:1,height:'5px',background:'rgba(255,255,255,0.2)',borderRadius:'3px',cursor:'pointer'}} id="progressBarContainer">
                <div id="progressBar" style={{height:'100%',width:'0%',background:'#ffd93d',borderRadius:'3px'}}></div>
              </div>
              <span id="totalTime" style={{fontSize:'11px'}}>0:00</span>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <i className="fas fa-volume-up" style={{fontSize:'14px'}}></i>
            <input type="range" id="volumeControl" min="0" max="100" defaultValue="70" style={{width:'75px'}} />
          </div>
        </div>
        <audio id="globalAudioPlayer" style={{display:'none'}}></audio>
      </div>

      {/* Читалка */}
      <div id="readerModal" className="reader-modal" style={{display:'none'}}>
        <div className="reader-container">
          <div className="reader-toolbar">
            <div className="reader-toolbar-left">
              <button onClick={() => window.closeReader?.()} className="close-btn"><i className="fas fa-times"></i></button>
              <div className="reader-info">
                <strong id="readerBookTitle">Книга</strong>
                <span id="readerBookAuthor" style={{opacity:0.8}}></span>
              </div>
            </div>
            <div className="reader-toolbar-center">
              <button onClick={() => window.changeFontSize?.(-1)}><i className="fas fa-font"></i>-</button>
              <button onClick={() => window.changeFontSize?.(1)}><i className="fas fa-font"></i>+</button>
              <button onClick={() => window.toggleViewMode?.()}><i className="fas fa-columns"></i></button>
              <button onClick={() => window.showGoToPageDialog?.()}><i className="fas fa-search"></i></button>
              <div className="reader-progress"><div className="reader-progress-bar" id="readerProgressBar"></div></div>
              <span id="readerPercentage" style={{fontSize:'12px'}}>0%</span>
            </div>
            <div className="reader-toolbar-right"><span id="readerPageInfo">0 / 0</span></div>
          </div>
          <div className="reader-content">
            <div id="readerLoading" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'20px'}}>
              <i className="fas fa-spinner fa-pulse" style={{fontSize:'48px',color:'#8b3a2a'}}></i>
              <p id="loadingProgress">Загрузка книги...</p>
              <div style={{width:'300px',height:'4px',background:'#e0d5c5',borderRadius:'2px',overflow:'hidden'}}>
                <div style={{width:'50%',height:'100%',background:'#8b3a2a',animation:'loading 1s ease-in-out infinite'}}></div>
              </div>
            </div>
            <div id="readerPagesContainer" className="two-pages" style={{display:'none',width:'100%',height:'100%'}}>
              <div id="leftPage" className="reader-page left-page"><div className="page-content"></div></div>
              <div id="rightPage" className="reader-page right-page"><div className="page-content"></div></div>
            </div>
          </div>
          <div className="reader-nav">
            <button onClick={() => window.prevPage?.()} id="readerPrevBtn"><i className="fas fa-chevron-left"></i> Назад</button>
            <span>← → или стрелки</span>
            <button onClick={() => window.nextPage?.()} id="readerNextBtn">Вперед <i className="fas fa-chevron-right"></i></button>
          </div>
        </div>
      </div>

      <div id="editBookModal" style={{display:"none",position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.45)",alignItems:"center",justifyContent:"center"}}>
        <div className="modal-content">
          <button className="close-modal-btn" onClick={() => window.closeEditBookModal?.()}><i className="fas fa-times"></i></button>
          <h3><i className="fas fa-edit"></i> Редактировать книгу</h3>
          <input type="hidden" id="editBookId" />
          <div className="form-group"><label>Название</label><input type="text" id="editBookTitle" placeholder="Название книги" /></div>
          <div className="form-group"><label>Автор</label><input type="text" id="editBookAuthor" placeholder="Автор" /></div>
          <div className="form-group"><label>Жанр</label><input type="text" id="editBookGenre" placeholder="Жанр" /></div>
          <div className="form-group"><label>Год издания</label><input type="number" id="editBookYear" placeholder="Год" min="1000" max="2100" /></div>
          <div className="form-group"><label>Описание</label><textarea id="editBookDescription" placeholder="Краткое описание книги..."></textarea></div>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={() => window.closeEditBookModal?.()}>Отмена</button>
            <button className="btn-save" onClick={() => window.saveEditedBook?.()}><i className="fas fa-check"></i> Сохранить</button>
          </div>
        </div>
      </div>

      <style>{`@keyframes loading{0%{width:0%}50%{width:70%}100%{width:100%}}`}</style>
    </>
  )
}
