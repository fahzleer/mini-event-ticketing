import type { LoginInput, RegisterInput, User } from "@repo/types"
import { useMutation } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { authApi } from "../api/client"

type AuthMessage = { type: "LOGIN"; user: User } | { type: "LOGOUT" }

const authChannel = new BroadcastChannel("auth")

export function useAuthStore() {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("user")
    return stored ? (JSON.parse(stored) as User) : null
  })

  useEffect(() => {
    const handler = (e: MessageEvent<AuthMessage>) => {
      if (e.data.type === "LOGOUT") {
        setUser(null)
      } else if (e.data.type === "LOGIN") {
        setUser(e.data.user)
      }
    }
    authChannel.addEventListener("message", handler)
    return () => authChannel.removeEventListener("message", handler)
  }, [])

  const login = (token: string, userData: User) => {
    localStorage.setItem("token", token)
    localStorage.setItem("user", JSON.stringify(userData))
    setUser(userData)
    authChannel.postMessage({ type: "LOGIN", user: userData } satisfies AuthMessage)
  }

  const logout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setUser(null)
    authChannel.postMessage({ type: "LOGOUT" } satisfies AuthMessage)
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
