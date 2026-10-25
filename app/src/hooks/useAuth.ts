import { use } from "react"
import { AuthContext } from "../providers/AuthProvider"

export const useAuth = () => use(AuthContext)
