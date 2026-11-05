import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../api/auth'
import { clearAllConsultationDrafts } from '../hooks/useConsultationDraft'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const storedUser  = localStorage.getItem('auth_user')
    const storedToken = localStorage.getItem('auth_token')
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (_) {
        localStorage.removeItem('auth_user')
      }
      // The stored copy is only a quick first paint. Always re-read the real
      // profile (name, role, photo, ...) from the database through the API.
      authApi.me()
        .then(({ data }) => {
          if (data?.user) {
            localStorage.setItem('auth_user', JSON.stringify(data.user))
            setUser(data.user)
          }
        })
        .catch(() => { /* 401 is handled by the axios interceptor; offline keeps the stored copy */ })
    }
    setLoading(false)
  }, [])

  const login = async (credentials) => {
    const { data } = await authApi.login(credentials)
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('auth_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  const register = async (formData) => {
    const { data } = await authApi.register(formData)
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('auth_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch (_) {
      // Ignore — clear locally regardless
    } finally {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      clearAllConsultationDrafts()   // unfinished consultation drafts contain patient details
      setUser(null)
    }
  }

  const updateUser = (updatedUserData) => {
    setUser(prev => {
      const merged = { ...prev, ...updatedUserData }
      localStorage.setItem('auth_user', JSON.stringify(merged))
      return merged
    })
  }

  const refreshUser = async () => {
    try {
      const { data } = await authApi.me()
      if (data?.user) {
        localStorage.setItem('auth_user', JSON.stringify(data.user))
        setUser(data.user)
        return data.user
      }
    } catch (_) {
      // ignore
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
