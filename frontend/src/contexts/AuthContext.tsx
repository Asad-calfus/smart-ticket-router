import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"
import { api, ApiError } from "../services/api"
import type { CurrentUser } from "../types"

interface AuthContextValue {
  user: CurrentUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name: string, location?: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const currentUser = await api.me()
      setUser(currentUser)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    // Session restoration on load: an HttpOnly cookie may already be valid
    // from a previous visit — /api/auth/me tells us if so.
    refresh().finally(() => setIsLoading(false))
  }, [refresh])

  async function login(email: string, password: string) {
    const currentUser = await api.login({ email, password })
    setUser(currentUser)
  }

  async function signup(email: string, password: string, name: string, location?: string) {
    const currentUser = await api.signup({ email, password, name, location })
    setUser(currentUser)
  }

  async function logout() {
    try {
      await api.logout()
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        throw err
      }
    } finally {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
