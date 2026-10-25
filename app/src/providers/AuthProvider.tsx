import { type Session } from "@supabase/supabase-js"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createContext, useCallback, useEffect, useMemo, useState } from "react"
import { useWallet } from "../hooks/useWallet"
import {
	createDemoAccount,
	forgetDemoAccount,
	loadDemoAccount,
} from "../lib/demoAccount"
import {
	maybe,
	must,
	type Profile,
	supabase,
	supabaseReady,
} from "../lib/supabase"

// TATTOO APP: accounts with email and password (Supabase). Each account gets
// its own Stellar key, created by the app and kept in the account, so the
// artist signs reputation on Stellar without ever dealing with a wallet.

export interface AuthContextType {
	/** Supabase is configured in .env */
	ready: boolean
	session: Session | null
	/** Still restoring the session */
	loading: boolean
	userId?: string
	profile?: Profile | null
	signIn: (email: string, password: string) => Promise<void>
	signUp: (email: string, password: string) => Promise<"confirm" | "in">
	signOut: () => Promise<void>
	resetPassword: (email: string) => Promise<void>
	deleteAccount: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType>({
	ready: false,
	session: null,
	loading: false,
	signIn: async () => {},
	signUp: async () => "in",
	signOut: async () => {},
	resetPassword: async () => {},
	deleteAccount: async () => {},
})

/** Loads (or creates) the account's Stellar key and links it to the profile */
async function ensureWallet(userId: string) {
	const row = maybe(
		await supabase
			.from("wallets")
			.select("secret")
			.eq("id", userId)
			.maybeSingle(),
	)
	if (row) return row.secret as string

	// First time: reuse the key this browser already had, or make a new one
	const kp = loadDemoAccount() ?? (await createDemoAccount())
	must(
		await supabase.from("wallets").insert({ id: userId, secret: kp.secret() }),
	)
	return kp.secret()
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
	const queryClient = useQueryClient()
	const { enterWithSecret, stopDemo } = useWallet()
	const [session, setSession] = useState<Session | null>(null)
	const [loading, setLoading] = useState(supabaseReady)
	const userId = session?.user.id

	useEffect(() => {
		if (!supabaseReady) return
		void supabase.auth.getSession().then(({ data }) => {
			setSession(data.session)
			setLoading(false)
		})
		const { data } = supabase.auth.onAuthStateChange((_event, s) =>
			setSession(s),
		)
		return () => data.subscription.unsubscribe()
	}, [])

	// Sign Stellar transactions with the account's own key
	useEffect(() => {
		if (!userId) return
		let cancelled = false
		void ensureWallet(userId)
			.then((secret) => {
				if (!cancelled) enterWithSecret(secret)
			})
			.catch((e: Error) => console.error("Stellar key:", e.message))
		return () => {
			cancelled = true
		}
	}, [userId, enterWithSecret])

	const profile = useQuery({
		queryKey: ["profile", userId],
		enabled: !!userId,
		queryFn: async () =>
			maybe(
				await supabase
					.from("profiles")
					.select("*")
					.eq("id", userId!)
					.maybeSingle(),
			) as Profile | null,
	})

	const signIn = useCallback(async (email: string, password: string) => {
		must(await supabase.auth.signInWithPassword({ email, password }))
	}, [])

	const signUp = useCallback(async (email: string, password: string) => {
		const data = must(
			await supabase.auth.signUp({
				email,
				password,
				options: { emailRedirectTo: window.location.origin },
			}),
		)
		return data.session ? "in" : "confirm"
	}, [])

	const signOut = useCallback(async () => {
		await supabase.auth.signOut()
		forgetDemoAccount()
		stopDemo()
		queryClient.clear()
	}, [stopDemo, queryClient])

	const resetPassword = useCallback(async (email: string) => {
		must(
			await supabase.auth.resetPasswordForEmail(email, {
				redirectTo: window.location.origin,
			}),
		)
	}, [])

	const deleteAccount = useCallback(async () => {
		if (!userId) return
		// Photos first (Storage API), then the account and everything linked
		const files = must(
			await supabase.storage.from("photos").list(userId, { limit: 1000 }),
		)
		if (files.length)
			must(
				await supabase.storage
					.from("photos")
					.remove(files.map((f) => `${userId}/${f.name}`)),
			)
		must(await supabase.rpc("delete_my_account"))
		await signOut()
	}, [userId, signOut])

	const value = useMemo(
		() => ({
			ready: supabaseReady,
			session,
			loading,
			userId,
			profile: profile.data,
			signIn,
			signUp,
			signOut,
			resetPassword,
			deleteAccount,
		}),
		[
			session,
			loading,
			userId,
			profile.data,
			signIn,
			signUp,
			signOut,
			resetPassword,
			deleteAccount,
		],
	)

	return <AuthContext value={value}>{children}</AuthContext>
}
