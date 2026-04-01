import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { authApi } from "../api/client"
import type { LoginInput, RegisterInput, User } from "@repo/types"

export function useAuthStore() {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("user")
    return stored ? (JSON.parse(stored) as User) : null
  })

  const login = (token: string, userData: User) => {
    localStorage.setItem("token", token)
    localStorage.setItem("user", JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setUser(null)
  }

  return { user, login, logout, isAuthenticated: !!user }
}

export function useRegister(onSuccess: (token: string, user: User) => void) {
  return useMutation({
    mutationFn: (data: RegisterInput) => authApi.register(data),
    onSuccess: ({ token, user }) => onSuccess(token, user),
  })
}

export function useLogin(onSuccess: (token: string, user: User) => void) {
  return useMutation({
    mutationFn: (data: LoginInput) => authApi.login(data),
    onSuccess: ({ token, user }) => onSuccess(token, user),
  })
}
