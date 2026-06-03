/**
 * Fetch interceptor — replaces Flask proxy layer.
 * Intercepts legacy Flask URLs (e.g. /get_all_books) and
 * redirects them to the FastAPI backend directly, injecting
 * X-User-ID and X-User-Role from localStorage (previously stored in Flask session).
 *
 * Also handles /logout by clearing localStorage and redirecting to /login.
 */
;(function () {
  const API_URL = window.__API_URL__ || (window.location.origin + '/api')

  function getAuthHeaders() {
    return {
      'X-User-ID':   localStorage.getItem('user_id')   || '',
      'X-User-Role': localStorage.getItem('role')       || '',
    }
  }

  /**
   * Mapping: Flask proxy path → FastAPI path resolver.
   * Each entry is [matchFn, resolveFn].
   * matchFn(url, options) → bool
   * resolveFn(url, options) → { url, options } with FastAPI destination
   */
  const routes = [
    // ── Books ──────────────────────────────────────────────────────────
    [
      (u) => u === '/get_all_books',
      (u, o) => ({ url: `${API_URL}/books`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u.startsWith('/get_book/'),
      (u, o) => {
        const id = u.split('/get_book/')[1]
        return { url: `${API_URL}/books/${id}`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u === '/add_book',
      (u, o) => ({ url: `${API_URL}/books`, options: { ...o, method: 'POST', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u === '/update_book',
      (u, o) => {
        // FormData — book_id is in the body; we need to extract it
        // We clone the FormData and get book_id from it
        const fd = o.body
        const bookId = fd instanceof FormData ? fd.get('book_id') : null
        if (bookId) {
          const newFd = new FormData()
          for (const [k, v] of fd.entries()) {
            if (k !== 'book_id') newFd.append(k, v)
          }
          return {
            url: `${API_URL}/books/${bookId}`,
            options: { ...o, method: 'PUT', body: newFd, headers: { ...getAuthHeaders(), ...(o.headers||{}) } },
          }
        }
        return { url: `${API_URL}/books/unknown`, options: { ...o, headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u.startsWith('/delete_book/'),
      (u, o) => {
        const id = u.split('/delete_book/')[1]
        return { url: `${API_URL}/books/${id}`, options: { ...o, method: 'DELETE', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u === '/upload_book_files',
      (u, o) => {
        const fd = o.body
        const bookId = fd instanceof FormData ? fd.get('book_id') : null
        return { url: `${API_URL}/books/${bookId}/upload-files`, options: { ...o, method: 'POST', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u.startsWith('/get_book_files/'),
      (u, o) => {
        const id = u.split('/get_book_files/')[1]
        return { url: `${API_URL}/books/${id}/files`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u.startsWith('/get_audio_tracks/'),
      (u, o) => {
        const id = u.split('/get_audio_tracks/')[1]
        return { url: `${API_URL}/books/${id}/audio-tracks`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u.startsWith('/add_audio_track/'),
      (u, o) => {
        const id = u.split('/add_audio_track/')[1]
        return { url: `${API_URL}/books/${id}/audio-tracks`, options: { ...o, method: 'POST', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => {
        // /delete_audio_track/<book_id>/<track_id>
        const m = u.match(/^\/delete_audio_track\/(\d+)\/(\d+)$/)
        return !!m
      },
      (u, o) => {
        const m = u.match(/^\/delete_audio_track\/(\d+)\/(\d+)$/)
        return { url: `${API_URL}/books/${m[1]}/audio-tracks/${m[2]}`, options: { ...o, method: 'DELETE', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u === '/search_books',
      (u, o) => ({ url: `${API_URL}/books/search`, options: { ...o, method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u === '/search_unified_books',
      (u, o) => ({ url: `${API_URL}/books/search`, options: { ...o, method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    // ── Tinder ────────────────────────────────────────────────────────
    [
      (u) => u === '/get_tinder_books',
      (u, o) => ({ url: `${API_URL}/books/tinder/books`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    // ── Favorites ─────────────────────────────────────────────────────
    [
      (u) => u === '/get_favorites',
      (u, o) => ({ url: `${API_URL}/books/favorites/list`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u === '/add_to_favorites',
      (u, o) => ({ url: `${API_URL}/books/favorites/add`, options: { ...o, method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u === '/remove_from_favorites',
      (u, o) => ({ url: `${API_URL}/books/favorites/remove`, options: { ...o, method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    // ── User book lists ────────────────────────────────────────────────
    [
      (u) => u.startsWith('/get_user_books'),
      (u, o) => ({ url: `${API_URL}/books/user/list${u.includes('?') ? u.substring(u.indexOf('?')) : ''}`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u === '/add_to_category',
      (u, o) => ({ url: `${API_URL}/books/user/add`, options: { ...o, method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u === '/move_to_category',
      (u, o) => ({ url: `${API_URL}/books/user/move`, options: { ...o, method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u === '/remove_from_library',
      (u, o) => ({ url: `${API_URL}/books/user/remove`, options: { ...o, method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u === '/edit_book',
      (u, o) => ({ url: `${API_URL}/books/user/update`, options: { ...o, method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u.startsWith('/get_book_info/'),
      (u, o) => {
        const id = u.split('/get_book_info/')[1]
        return { url: `${API_URL}/books/${id}`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    // ── Marathons ─────────────────────────────────────────────────────
    [
      (u) => u === '/get_all_marathons',
      (u, o) => ({ url: `${API_URL}/marathons`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u === '/get_system_marathons',
      (u, o) => ({ url: `${API_URL}/marathons/system`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u === '/get_active_marathons',
      (u, o) => ({ url: `${API_URL}/marathons/active`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u === '/get_completed_marathons',
      (u, o) => ({ url: `${API_URL}/marathons/completed`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u === '/get_my_marathons',
      (u, o) => ({ url: `${API_URL}/marathons/my`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u === '/get_pending_marathons',
      (u, o) => ({ url: `${API_URL}/marathons/pending`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u === '/get_user_marathons',
      (u, o) => ({ url: `${API_URL}/marathons/user`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u.startsWith('/get_marathon/'),
      (u, o) => {
        const id = u.split('/get_marathon/')[1]
        return { url: `${API_URL}/marathons/${id}`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u.startsWith('/get_marathon_for_moderation/'),
      (u, o) => {
        const id = u.split('/get_marathon_for_moderation/')[1]
        return { url: `${API_URL}/marathons/${id}`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u === '/add_marathon',
      (u, o) => ({ url: `${API_URL}/marathons`, options: { ...o, method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u === '/update_marathon',
      (u, o) => {
        let body = o.body
        let mid = null
        try {
          const parsed = typeof body === 'string' ? JSON.parse(body) : body
          mid = parsed.marathon_id
          const { marathon_id, ...rest } = parsed
          body = JSON.stringify(rest)
        } catch (_) {}
        return { url: `${API_URL}/marathons/${mid}`, options: { ...o, method: 'PUT', body, headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u.startsWith('/delete_marathon/'),
      (u, o) => {
        const id = u.split('/delete_marathon/')[1]
        return { url: `${API_URL}/marathons/${id}`, options: { ...o, method: 'DELETE', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u.startsWith('/approve_marathon/'),
      (u, o) => {
        const id = u.split('/approve_marathon/')[1]
        return { url: `${API_URL}/marathons/${id}/approve`, options: { ...o, method: 'POST', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u.startsWith('/reject_marathon/'),
      (u, o) => {
        const id = u.split('/reject_marathon/')[1]
        return { url: `${API_URL}/marathons/${id}/reject`, options: { ...o, method: 'DELETE', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u === '/join_marathon',
      (u, o) => {
        let mid = null
        try { mid = JSON.parse(o.body).marathon_id } catch (_) {}
        return { url: `${API_URL}/marathons/${mid}/join`, options: { ...o, method: 'POST', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u === '/leave_marathon',
      (u, o) => {
        let mid = null
        try { mid = JSON.parse(o.body).marathon_id } catch (_) {}
        return { url: `${API_URL}/marathons/${mid}/leave`, options: { ...o, method: 'POST', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u === '/update_marathon_progress',
      (u, o) => {
        let mid = null, body = o.body
        try {
          const parsed = JSON.parse(body)
          mid = parsed.marathon_id
        } catch (_) {}
        return { url: `${API_URL}/marathons/${mid}/progress`, options: { ...o, method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u.startsWith('/get_marathon_progress'),
      (u, o) => {
        const qs = u.includes('?') ? u.substring(u.indexOf('?')) : ''
        const params = new URLSearchParams(qs)
        const mid = params.get('marathon_id')
        return { url: `${API_URL}/marathons/${mid}/progress`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    // ── Profile ───────────────────────────────────────────────────────
    [
      (u) => u === '/get_profile_data',
      (u, o) => ({ url: `${API_URL}/profile`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u === '/update_profile',
      (u, o) => ({ url: `${API_URL}/profile`, options: { ...o, method: 'POST', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    // ── Reading/Audio progress ─────────────────────────────────────────
    [
      (u) => u === '/save_reading_progress',
      (u, o) => ({ url: `${API_URL}/users/progress/reading`, options: { ...o, method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u.startsWith('/get_reading_progress/'),
      (u, o) => {
        const id = u.split('/get_reading_progress/')[1]
        return { url: `${API_URL}/users/progress/reading/${id}`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    [
      (u) => u === '/save_audio_progress',
      (u, o) => ({ url: `${API_URL}/users/progress/audio`, options: { ...o, method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
    [
      (u) => u.startsWith('/get_audio_progress/'),
      (u, o) => {
        const id = u.split('/get_audio_progress/')[1]
        return { url: `${API_URL}/users/progress/audio/${id}`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    // ── PDF convert ───────────────────────────────────────────────────
    [
      (u) => u === '/convert_pdf_to_md',
      (u, o) => {
        let body = o.body, bookId = null
        try {
          const parsed = JSON.parse(body)
          bookId = parsed.book_id
        } catch (_) {}
        return { url: `${API_URL}/books/${bookId}/convert-to-md`, options: { ...o, method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    // ── Audio proxy ───────────────────────────────────────────────────
    [
      (u) => u.startsWith('/audio/'),
      (u, o) => {
        const filepath = u.substring('/audio/'.length)
        return { url: `${API_URL}/books/audio-proxy?path=${filepath}`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    // ── Debug (pass-through to avoid errors) ──────────────────────────
    [
      (u) => u.startsWith('/debug_get_book/'),
      (u, o) => {
        const id = u.split('/debug_get_book/')[1]
        return { url: `${API_URL}/books/${id}`, options: { ...o, method: 'GET', headers: { ...getAuthHeaders(), ...(o.headers||{}) } } }
      },
    ],
    // ── Import book from external API ─────────────────────────────────
    [
      (u) => u === '/import_book_from_api',
      (u, o) => ({ url: `${API_URL}/books/import`, options: { ...o, method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(o.headers||{}) } } }),
    ],
  ]

  // ── Special: /logout ──────────────────────────────────────────────────────
  const _origFetch = window.fetch.bind(window)

  window.fetch = function (input, options = {}) {
    const url = typeof input === 'string' ? input : input.url || input

    // Handle logout
    if (url === '/logout') {
      localStorage.removeItem('user_id')
      localStorage.removeItem('username')
      localStorage.removeItem('role')
      localStorage.removeItem('profile_image')
      window.location.href = '/login'
      // Return a fake response so callers don't crash
      return Promise.resolve(new Response('{}', { status: 200 }))
    }

    // Find matching route
    for (const [matchFn, resolveFn] of routes) {
      if (matchFn(url, options)) {
        const resolved = resolveFn(url, options)
        console.debug('[interceptor]', url, '->', resolved.url)
        return _origFetch(resolved.url, resolved.options).then(resp => {
          if (resp.status === 401) {
            console.warn('[interceptor] 401 — перенаправление на логин')
            localStorage.removeItem('user_id')
            window.location.href = '/login'
          }
          return resp
        })
      }
    }

    // No match — pass through
    return _origFetch(input, options)
  }
})()
