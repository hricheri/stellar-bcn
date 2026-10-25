import { Keypair } from "@stellar/stellar-sdk"
import { basicNodeSigner } from "@stellar/stellar-sdk/contract"
import { fundAccount, networkPassphrase } from "@stellar-scaffold/app-lib"

// TATTOO APP: cuenta de prueba guardada en el navegador, para que jurado y
// clientes puedan usar la app en testnet sin instalar una wallet.
const KEY = "tattoo-demo-secret"

const read = (): Keypair | undefined => {
	try {
		const secret = localStorage.getItem(KEY)
		return secret ? Keypair.fromSecret(secret) : undefined
	} catch {
		return undefined
	}
}

export const loadDemoAccount = read

export async function createDemoAccount(): Promise<Keypair> {
	const existing = read()
	if (existing) return existing
	const kp = Keypair.random()
	const funded = await fundAccount(kp.publicKey())
	if (!funded.ok) throw new Error(funded.message)
	try {
		localStorage.setItem(KEY, kp.secret())
	} catch {
		// private mode: the account lives only for this tab
	}
	return kp
}

/** Enter with the secret key of an existing testnet account (e.g. a seeded artist) */
export function importDemoAccount(secret: string): Keypair {
	const kp = Keypair.fromSecret(secret.trim())
	try {
		localStorage.setItem(KEY, kp.secret())
	} catch {
		// private mode: the account lives only for this tab
	}
	return kp
}

export const forgetDemoAccount = () => {
	try {
		localStorage.removeItem(KEY)
	} catch {
		// nothing stored
	}
}

export const demoSigner = (kp: Keypair) =>
	basicNodeSigner(kp, networkPassphrase).signTransaction
