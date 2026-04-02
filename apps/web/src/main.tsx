import "./index.css"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { useAuthStore } from "./hooks/useAuth"
import { AppRouter } from "./router"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function App() {
  const { user, login, logout } = useAuthStore()

  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter user={user} onLogin={login} onLogout={logout} />
    </QueryClientProvider>
  )
}

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
