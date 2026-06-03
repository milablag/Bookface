import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isLoggedIn, getSession } from './api.js'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import UserPage from './pages/UserPage.jsx'
import AdminPage from './pages/AdminPage.jsx'

function RequireAuth({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return children
}

function RequireAdmin({ children }) {
  const s = getSession()
  if (!isLoggedIn() || s.role !== 'admin') return <Navigate to="/login" replace />
  return children
}

function RequireUser({ children }) {
  const s = getSession()
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  if (s.role === 'admin') return <Navigate to="/admin" replace />
  return children
}

function IndexRedirect() {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  const s = getSession()
  return <Navigate to={s.role === 'admin' ? '/admin' : '/user'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IndexRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/user"
          element={
            <RequireUser>
              <UserPage />
            </RequireUser>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
