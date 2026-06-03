import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setSession, isLoggedIn, BASE_URL } from '../api.js'

function validateField(value, rules) {
  let isValid = true
  let hintParts = []
  if (rules.minLength) {
    const ok = value.length >= rules.minLength
    if (!ok) isValid = false
    hintParts.push({ ok, text: `Минимум ${rules.minLength} символов` })
  }
  if (rules.maxLength) {
    const ok = value.length <= rules.maxLength
    if (!ok) isValid = false
    hintParts.push({ ok, text: `Максимум ${rules.maxLength} символов` })
  }
  if (rules.pattern) {
    const ok = rules.pattern.test(value)
    if (!ok) isValid = false
    hintParts.push({ ok, text: 'Только буквы, цифры и подчеркивание (_)' })
  }
  if (rules.requireNumber) {
    const ok = /\d/.test(value)
    if (!ok) isValid = false
    hintParts.push({ ok, text: 'Хотя бы одна цифра' })
  }
  if (rules.requireUpper) {
    const ok = /[A-ZА-Я]/.test(value)
    if (!ok) isValid = false
    hintParts.push({ ok, text: 'Хотя бы одна заглавная буква' })
  }
  return { isValid, hintParts }
}

function HintBox({ parts, active }) {
  if (!parts.length) return null
  return (
    <div className={'hint' + (active ? ' active' : '')}>
      {parts.map((p, i) => (
        <div key={i} style={{ color: p.ok ? '#2e7d32' : '#c62828' }}>• {p.text}</div>
      ))}
    </div>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [fields, setFields] = useState({ username: '', email: '', password: '', confirm: '' })
  const [focus, setFocus] = useState({})
  const [errors, setErrors] = useState([])
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (isLoggedIn()) navigate('/user', { replace: true })
  }, [navigate])

  const rules = {
    username: { minLength: 3, maxLength: 20, pattern: /^[a-zA-Z0-9_]+$/ },
    email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    password: { minLength: 8, requireNumber: true, requireUpper: true },
  }

  const vUsername = validateField(fields.username, rules.username)
  const vEmail = validateField(fields.email, rules.email)
  const vPassword = validateField(fields.password, rules.password)
  const passwordMatch = fields.password && fields.confirm && fields.password === fields.confirm

  async function handleSubmit(e) {
    e.preventDefault()
    setErrors([])
    if (!vUsername.isValid) { setErrors(['Проверьте имя пользователя']); return }
    if (!vEmail.isValid) { setErrors(['Некорректный email']); return }
    if (!vPassword.isValid) { setErrors(['Пароль не соответствует требованиям']); return }
    if (!passwordMatch) { setErrors(['Пароли не совпадают']); return }
    try {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: fields.username, email: fields.email, password: fields.password }),
      })
      if (res.ok) {
        const user = await res.json()
        setSession({ ...user, role: 'user' })
        navigate('/user', { replace: true })
      } else {
        const data = await res.json()
        setErrors([data.detail || 'Ошибка регистрации'])
      }
    } catch (err) {
      setErrors([String(err)])
    }
  }

  function field(name) {
    return {
      value: fields[name],
      onChange: (e) => setFields((f) => ({ ...f, [name]: e.target.value })),
      onFocus: () => setFocus((f) => ({ ...f, [name]: true })),
      onBlur: () => setFocus((f) => ({ ...f, [name]: false })),
    }
  }

  return (
    <div className="register-container">
      <h2>Регистрация</h2>
      {errors.map((msg, i) => <div key={i} className="alert alert-error">{msg}</div>)}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      <form id="registerForm" onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="username">Имя пользователя:</label>
          <input type="text" id="username" name="username" required
            minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+"
            className={fields.username ? (vUsername.isValid ? 'valid' : 'invalid') : ''}
            {...field('username')} />
          <HintBox parts={vUsername.hintParts} active={focus.username} />
        </div>
        <div className="input-group">
          <label htmlFor="email">Email:</label>
          <input type="email" id="email" name="email" required
            className={fields.email ? (vEmail.isValid ? 'valid' : 'invalid') : ''}
            {...field('email')} />
          <HintBox parts={[{ ok: vEmail.isValid, text: 'В формате example@domain.com' }]} active={focus.email} />
        </div>
        <div className="input-group">
          <label htmlFor="password">Пароль:</label>
          <input type="password" id="password" name="password" required minLength={8}
            className={fields.password ? (vPassword.isValid ? 'valid' : 'invalid') : ''}
            {...field('password')} />
          <HintBox parts={vPassword.hintParts} active={focus.password} />
        </div>
        <div className="input-group">
          <label htmlFor="confirm-password">Подтвердите пароль:</label>
          <input type="password" id="confirm-password" name="confirm_password" required
            className={fields.confirm ? (passwordMatch ? 'valid' : 'invalid') : ''}
            value={fields.confirm}
            onChange={(e) => setFields((f) => ({ ...f, confirm: e.target.value }))}
            onFocus={() => setFocus((f) => ({ ...f, confirm: true }))}
            onBlur={() => setFocus((f) => ({ ...f, confirm: false }))} />
          <HintBox parts={[{ ok: passwordMatch, text: 'Пароли должны совпадать' }]} active={focus.confirm} />
        </div>
        <button type="submit">Зарегистрироваться</button>
      </form>
      <div className="links">
        Уже есть аккаунт?{' '}
        <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login') }}>Войдите</a>
      </div>
    </div>
  )
}
