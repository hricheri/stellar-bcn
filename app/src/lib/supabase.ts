import { createClient } from "@supabase/supabase-js"

// TATTOO APP: private data (accounts, photos, trips, likes, visit requests and
// chat) lives in Supabase, protected per user. See supabase/migrations.

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined

/** False until PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are set in .env */
export const supabaseReady = !!url && !!key

export const supabase = createClient(
	url ?? "http://localhost:54321",
	key ?? "missing-key",
	// PKCE: email links come back with ?code=, which doesn't clash with the
	// HashRouter's #/ routes
	{ auth: { flowType: "pkce" } },
)

export interface Profile {
	id: string
	stellar_address: string | null
	name: string
	city: string
	instagram: string
	bio: string
	avatar_path: string | null
	wanted: string[]
}

export interface Trip {
	id: number
	user_id: string
	start_date: string
	end_date: string
	city: string
}

export interface VisitRequest {
	id: number
	guest: string
	host: string
	studio_id: number
	message: string
	start_date: string | null
	end_date: string | null
	status: "open" | "answered" | "closed"
	created_at: string
}

export interface ChatMessage {
	id: number
	sender: string
	recipient: string
	body: string
	created_at: string
	read_at: string | null
}

type Res = { data: unknown; error: { message: string } | null }

/** Throws Supabase errors so react-query and our forms can show them */
export const must = <R extends Res>(res: R): NonNullable<R["data"]> => {
	if (res.error) throw new Error(res.error.message)
	return res.data as NonNullable<R["data"]>
}

/** Same, for a row that may not exist (maybeSingle) */
export const maybe = <R extends Res>(res: R): R["data"] | null => {
	if (res.error) throw new Error(res.error.message)
	return res.data ?? null
}
