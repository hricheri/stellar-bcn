// TATTOO APP: gives the demo artists of environments.toml (wilo, alma,
// cora...) a real account, so you can sign in as them and test both sides
// of a guest spot.
//
//   node scripts/demo-accounts.mjs you@gmail.com
//
// Each artist gets you+wilo@gmail.com, you+alma@gmail.com... (Gmail delivers
// them all to you) with the password below. Their account uses the same
// Stellar key that `npm start` made for them, so their studios, dates and
// reviews come along. Needs "Confirm email" turned off in Supabase while it
// runs.

import { execSync } from "node:child_process"
import { Keypair } from "@stellar/stellar-sdk"
import { createClient } from "@supabase/supabase-js"

const URL =
	process.env.VITE_SUPABASE_URL || "https://biudyszuzgpmtjfpiezu.supabase.co"
const KEY =
	process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
	"sb_publishable_hjBJdPpPWSvTKlqHFQ1aTA_OPLa847k"
const PASSWORD = "tattoo-demo-2026"

const ARTISTS = [
	["wilo", "Wilo", "Barcelona", "@wilo.tattoo"],
	["alma", "Alma", "Barcelona", "@alma.tattoo"],
	["cora", "Cora", "Barcelona", "@cora.tattoo"],
	["stacey", "Stacey", "Perth", "@stacey.tattoo"],
	["roro", "Roro", "Perth", "@roro.tattoo"],
	["boban", "Boban", "Barcelona", "@boban.tattoo"],
	["zeze", "Zeze", "Lisbon", "@zeze.tattoo"],
	["ina", "Ina", "Berlin", "@ina.tattoo"],
	["julim", "Julim", "Berlin", "@julim.tattoo"],
]

const email = process.argv[2]
if (!email?.includes("@")) {
	console.log("Write your email after the command, e.g.:")
	console.log("  node scripts/demo-accounts.mjs you@gmail.com")
	process.exit(1)
}
const [user, domain] = email.split("@")

const must = ({ data, error }) => {
	if (error) throw new Error(error.message)
	return data
}

// Scaffold keeps the project's keys in .config/stellar. Newer Stellar CLIs
// have `keys secret`, older ones `keys show`.
const secretOf = (id) => {
	let last
	for (const dir of [".config/stellar", ".stellar", ""])
		for (const sub of ["secret", "show"]) {
			const cmd = `stellar keys ${sub} ${id}${dir ? ` --config-dir ${dir}` : ""}`
			try {
				const out = execSync(cmd, {
					encoding: "utf8",
					stdio: ["ignore", "pipe", "pipe"],
				})
				const key = out.match(/S[A-Z2-7]{55}/)?.[0]
				if (key) return key
			} catch (e) {
				last = String(e.stderr || e.message)
					.trim()
					.split("\n")
					.pop()
			}
		}
	throw new Error(`No key for ${id}: ${last ?? "not found"}`)
}

const rows = []
for (const [id, name, city, instagram] of ARTISTS) {
	const login = `${user}+${id}@${domain}`
	try {
		const secret = secretOf(id)
		const address = Keypair.fromSecret(secret).publicKey()

		const sb = createClient(URL, KEY, { auth: { persistSession: false } })
		let { data } = await sb.auth.signInWithPassword({
			email: login,
			password: PASSWORD,
		})
		if (!data.session) {
			data = must(await sb.auth.signUp({ email: login, password: PASSWORD }))
			if (!data.session)
				throw new Error(
					'Supabase asked to confirm the email. Turn off "Confirm email" and run this again.',
				)
		}
		const uid = data.session.user.id

		const profile = must(
			await sb.from("profiles").select("id").eq("id", uid).maybeSingle(),
		)
		if (!profile)
			must(await sb.from("profiles").insert({ id: uid, name, city, instagram }))
		const wallet = must(
			await sb.from("wallets").select("id").eq("id", uid).maybeSingle(),
		)
		if (!wallet) must(await sb.from("wallets").insert({ id: uid, secret }))
		must(await sb.rpc("claim_my_address", { address }))

		rows.push({ artist: name, email: login, password: PASSWORD })
	} catch (e) {
		rows.push({ artist: name, email: login, password: `ERROR: ${e.message}` })
	}
}
console.table(rows)
