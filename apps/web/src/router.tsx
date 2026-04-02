import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import type { User } from "@repo/types"
import { PrivateRoute } from "./components/PrivateRoute"
import { Dashboard } from "./pages/Dashboard"
import { EventDetail } from "./pages/EventDetail"
import { EventList } from "./pages/EventList"
import { Login } from "./pages/Login"
import { Register } from "./pages/Register"

type Props = {
  user: User | null
  onLogin: (token: string, user: User) => void
  onLogout: () => void
}

export function AppRouter({ user, onLogin, onLogout }: Props) {
  return (
    <BrowserRouter>
      {/* Navbar */}
      <nav className="border-b bg-white px-4 py-3 flex justify-between items-center">
        <a href="/" className="font-bold text-lg">
          🎟 Mini Ticketing
        </a>
        <div className="flex gap-4 items-center text-sm">
          {user ? (
            <>
              <a href="/dashboard" className="text-gray-700 hover:text-blue-600">
                Dashboard
              </a>
              <button type="button" onClick={onLogout} className="text-gray-500 hover:text-red-600">
                Log out
              </button>
            </>
          ) : (
            <>
              <a href="/login" className="text-gray-700 hover:text-blue-600">
                Log in
              </a>
              <a
                href="/register"
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Sign up
              </a>
            </>
          )}
        </div>
      </nav>

      {/* Routes */}
      <Routes>
        <Route path="/login" element={<Login onLogin={onLogin} />} />
        <Route path="/register" element={<Register onLogin={onLogin} />} />

        <Route element={<PrivateRoute />}>
          <Route path="/" element={<EventList />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route
            path="/dashboard"
            element={user ? <Dashboard user={user} /> : <Navigate to="/login" replace />}
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
