import { Navigate, Outlet, useLocation } from "react-router"
import { LoaderCircle } from "lucide-react"
import { useAuth } from "./AuthProvider"

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <main className="center-screen">
        <LoaderCircle className="animate-spin" aria-label="Loading session" />
      </main>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
