import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"

/** Pages with members' details: only for signed-in artists */
export const RequireLogin = ({ children }: { children: React.ReactNode }) => {
	const { ready, loading, session } = useAuth()
	const location = useLocation()
	if (!ready) return <>{children}</>
	if (loading) return <div className="empty-state">Loading...</div>
	if (!session)
		return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
	return <>{children}</>
}
