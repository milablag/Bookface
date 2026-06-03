import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setSession, isLoggedIn, getSession, BASE_URL } from '../api.js'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isLoggedIn()) {
      const s = getSession()
      navigate(s.role === 'admin' ? '/admin' : '/user', { replace: true })
    }
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      })
      if (res.ok) {
        const user = await res.json()
        setSession(user)
        navigate(user.role === 'admin' ? '/admin' : '/user', { replace: true })
      } else {
        const data = await res.json()
        setError(data.detail || 'Ошибка авторизации')
      }
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <div className="login-container">
      <h2>Авторизация</h2>
      {error && <div className="flash-messages">{error}</div>}
      <form id="loginForm" onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="email">E-mail:</label>
          <input type="email" id="email" name="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="input-group">
          <label htmlFor="password">Пароль:</label>
          <input type="password" id="password" name="password" required
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit">Войти</button>
      </form>
      <div className="links">
        Нет аккаунта?{' '}
        <a href="/register" onClick={(e) => { e.preventDefault(); navigate('/register') }}>
          Зарегистрируйтесь
        </a>
      </div>
    </div>
  )
}
