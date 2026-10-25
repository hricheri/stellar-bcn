import  { type Keypair } from "@stellar/stellar-sdk"
import {
	fetchBalances,
	type MappedBalances,
	onWalletChange,
	signTransaction,
} from "@stellar-scaffold/app-lib"
import { createContext, useCallback, useEffect, useMemo, useState } from "react"
import {
	createDemoAccount,
	demoSigner,
	forgetDemoAccount,
	loadDemoAccount,
} from "../lib/demoAccount"

/**
 * A good-enough implementation of deepEqual.
 *
 * Used in this file to compare MappedBalances.
 *
 * Should maybe add & use a new dependency instead, if needed elsewhere.
 */
function deepEqual<T>(a: T, b: T): boolean {
	if (a === b) {
		return true
	}

	const bothAreObjects =
		a && b && typeof a === "object" && typeof b === "object"

	return Boolean(
		bothAreObjects &&
		Object.keys(a).length === Object.keys(b).length &&
		Object.entries(a).every(([k, v]) => deepEqual(v, b[k as keyof T])),
	)
}

export interface WalletContextType {
	address?: string
	balances: MappedBalances
	isPending: boolean
	networkPassphrase?: string
	signTransaction: typeof signTransaction
	updateBalances: () => Promise<void>
	/** TATTOO APP: true when signing with the in-browser demo account */
	isDemo: boolean
	startDemo: () => Promise<void>
	stopDemo: () => void
}

export const WalletContext = // @ts-ignore
	createContext<WalletContextType>({
		isPending: true,
		balances: {},
		updateBalances: async () => {},
		signTransaction,
		isDemo: false,
		startDemo: async () => {},
		stopDemo: () => {},
	})

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
	const [balances, setBalances] = useState<MappedBalances>({})
	const [address, setAddress] = useState<string>()
	const [networkPassphrase, setNetworkPassphrase] = useState<string>()
	const [isPending, setIsPending] = useState(true)
	const [walletAddress, setWalletAddress] = useState<string>()
	const [demo, setDemo] = useState<Keypair | undefined>(loadDemoAccount)

	const updateBalances = useCallback(async () => {
		if (!address) {
			setBalances({})
			return
		}

		const newBalances = await fetchBalances(address)
		setBalances((prev) => {
			if (deepEqual(newBalances, prev)) return prev
			return newBalances
		})
	}, [address])

	// Refetch on address change (via `updateBalances`' identity) and on network
	// change — the same address holds different balances per network.
	useEffect(() => {
		void updateBalances()
	}, [updateBalances, networkPassphrase])

	// Subscribe to wallet state. Gets values immediately and on every subsequent
	// change: connect, disconnect, and the wallet switching networks.
	useEffect(() => {
		return onWalletChange((state) => {
			setWalletAddress(state.address)
			setNetworkPassphrase(state.networkPassphrase)
			setIsPending(false)
		})
	}, [])

	// A connected wallet wins over the demo account
	useEffect(() => {
		const next = walletAddress ?? demo?.publicKey()
		setAddress(next)
		if (!next) setBalances({})
	}, [walletAddress, demo])

	const startDemo = useCallback(async () => {
		setIsPending(true)
		try {
			setDemo(await createDemoAccount())
		} finally {
			setIsPending(false)
		}
	}, [])

	const stopDemo = useCallback(() => {
		forgetDemoAccount()
		setDemo(undefined)
	}, [])

	const isDemo = !walletAddress && !!demo

	const contextValue = useMemo(
		() => ({
			address,
			networkPassphrase,
			balances,
			updateBalances,
			isPending,
			signTransaction: (isDemo && demo
				? demoSigner(demo)
				: signTransaction) as typeof signTransaction,
			isDemo,
			startDemo,
			stopDemo,
		}),
		[
			address,
			networkPassphrase,
			balances,
			updateBalances,
			isPending,
			isDemo,
			demo,
			startDemo,
			stopDemo,
		],
	)

	return <WalletContext value={contextValue}>{children}</WalletContext>
}
