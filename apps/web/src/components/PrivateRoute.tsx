import { Navigate, Outlet } from "react-router"

export function PrivateRoute() {
  const token = localStorage.getItem("token")
  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}
