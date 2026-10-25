import { tattooGuestSpot } from "@stellar-scaffold/app-lib/clients"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { type Profile } from "../lib/supabase"
import { useProfiles } from "./useProfiles"
import { useWallet } from "./useWallet"

// TATTOO APP: reads and writes of the tattoo_guest_spot contract

const ERROR_MESSAGES: Record<number, string> = {
	1: "First create your artist profile.",
	2: "You already have a profile.",
	3: "That studio doesn't exist.",
	4: "That studio is already booked.",
	5: "You can't book your own studio.",
	6: "That booking doesn't exist.",
	7: "Only those who took part in the stay can do this.",
	8: "The stay has to be completed before reviewing.",
	9: "The stay was already completed.",
	10: "You already reviewed this stay.",
	11: "The score has to be from 1 to 5.",
	12: "The end date has to be after the start date.",
	13: "This QR isn't valid.",
	14: "This QR was already used to leave a review.",
	15: "That QR was already registered.",
	16: "This QR isn't valid.",
	17: "Studio + home unlocks with 3 reviews averaging 4 or more.",
	19: "The booking isn't in the right state for this.",
	20: "Messages must have between 1 and 280 characters.",
	21: "You can only write to your matches or to artists you have a booking with.",
	22: "That studio doesn't exist.",
	23: "Only the studio's artists can do this.",
}

/** Turns a contract `Result` (or a thrown simulation error) into a friendly message */
export function friendlyError(e: unknown): string {
	const raw =
		e && typeof e === "object" && "error" in e
			? (e as { error: { message?: string } }).error
			: e
	const text = raw instanceof Error ? raw.message : String(raw)
	const code = Number(/Error\(Contract, #(\d+)\)/.exec(text)?.[1])
	return ERROR_MESSAGES[code] ?? text
}

interface MaybeResult<T> {
	isErr?: () => boolean
	unwrap?: () => T
	unwrapErr?: () => { message: string }
}

/** Unwraps a value that may be a contract `Result<T>` */
function unwrap<T>(value: T | MaybeResult<T>): T {
	const r = value as MaybeResult<T>
	if (typeof r?.isErr === "function" && r.unwrap && r.unwrapErr) {
		if (r.isErr()) {
			const err = r.unwrapErr()
			throw new Error(ERROR_MESSAGES[Number(err.message)] ?? err.message)
		}
		return r.unwrap()
	}
	return value as T
}

export const useSpots = () =>
	useQuery({
		queryKey: ["spots"],
		queryFn: async () => (await tattooGuestSpot.list_spots()).result,
	})

export const useContacts = (address?: string) =>
	useQuery({
		queryKey: ["contacts", address],
		enabled: !!address,
		queryFn: async () =>
			(await tattooGuestSpot.list_contacts({ artist: address! })).result,
	})

export const useStudios = () =>
	useQuery({
		queryKey: ["studios"],
		queryFn: async () => (await tattooGuestSpot.list_studios()).result,
	})

export const useStudioReviews = (studioId?: number) =>
	useQuery({
		queryKey: ["studio-reviews", studioId],
		enabled: !!studioId,
		queryFn: async () =>
			(await tattooGuestSpot.list_studio_reviews({ studio_id: studioId! }))
				.result,
	})

/** Reviews an artist wrote: about other artists and about studios */
export const useReviewsBy = (address?: string) => {
	const artists = useArtists()
	const studios = useStudios()
	return useQuery({
		queryKey: [
			"reviews-by",
			address,
			artists.data?.length,
			studios.data?.length,
		],
		enabled: !!address && !!artists.data && !!studios.data,
		queryFn: async () => {
			const [aboutArtists, aboutStudios] = await Promise.all([
				Promise.all(
					artists.data!.map(async (a) =>
						(await tattooGuestSpot.list_reviews({ artist: a.address })).result
							.filter((r) => r.from === address)
							.map((review) => ({ review, about: a.name, studio: false })),
					),
				),
				Promise.all(
					studios.data!.map(async (s) =>
						(
							await tattooGuestSpot.list_studio_reviews({ studio_id: s.id })
						).result
							.filter((r) => r.from === address)
							.map((review) => ({
								review,
								about: `${s.name} (${s.city})`,
								studio: true,
							})),
					),
				),
			])
			return [...aboutArtists.flat(), ...aboutStudios.flat()].sort(
				(x, y) => Number(y.review.timestamp) - Number(x.review.timestamp),
			)
		},
	})
}

type Artist = Awaited<
	ReturnType<typeof tattooGuestSpot.list_artists>
>["result"][number]

/** Name, city and Instagram can be edited in the account (Supabase) */
const withProfile = (a: Artist, p?: Profile): Artist =>
	p
		? {
				...a,
				name: p.name || a.name,
				city: p.city || a.city,
				instagram: p.instagram || a.instagram,
			}
		: a

export const useArtists = () => {
	const profiles = useProfiles().data
	const select = useCallback(
		(list: Artist[]) =>
			profiles
				? list.map((a) => withProfile(a, profiles.get(a.address)))
				: list,
		[profiles],
	)
	return useQuery({
		queryKey: ["artists"],
		queryFn: async () => (await tattooGuestSpot.list_artists()).result,
		select,
	})
}

export const useArtist = (address?: string) => {
	const profiles = useProfiles().data
	const select = useCallback(
		(a: Artist | null) =>
			a && profiles ? withProfile(a, profiles.get(a.address)) : a,
		[profiles],
	)
	return useQuery({
		queryKey: ["artist", address],
		enabled: !!address,
		queryFn: async () =>
			(await tattooGuestSpot.get_artist({ artist: address! })).result ?? null,
		select,
	})
}

export const useReviews = (address?: string) =>
	useQuery({
		queryKey: ["reviews", address],
		enabled: !!address,
		queryFn: async () =>
			(await tattooGuestSpot.list_reviews({ artist: address! })).result,
	})

export const useBookings = (address?: string) =>
	useQuery({
		queryKey: ["bookings", address],
		enabled: !!address,
		queryFn: async () =>
			(await tattooGuestSpot.list_bookings({ artist: address! })).result,
	})

export const useMessages = (me?: string, other?: string, live = false) =>
	useQuery({
		queryKey: ["messages", me, other],
		enabled: !!me && !!other,
		refetchInterval: live ? 6000 : false,
		queryFn: async () =>
			(await tattooGuestSpot.list_messages({ a: me!, b: other! })).result,
	})

type Client = typeof tattooGuestSpot

/**
 * Returns `send(build)`: builds a transaction with the connected account,
 * signs it (wallet or demo account), submits it and refreshes every query.
 * Resolves with the contract's return value and the transaction hash.
 */
export function useSend() {
	const { address, signTransaction, updateBalances } = useWallet()
	const queryClient = useQueryClient()

	return useCallback(
		async <T>(
			build: (
				client: Client,
				address: string,
				opts: { publicKey: string },
			) => Promise<{
				signAndSend: (o: {
					signTransaction: typeof signTransaction
				}) => Promise<{
					result: T
					sendTransactionResponse?: { hash: string }
				}>
			}>,
		) => {
			if (!address) throw new Error("Sign in first.")
			try {
				const tx = await build(tattooGuestSpot, address, { publicKey: address })
				const sent = await tx.signAndSend({ signTransaction })
				const value = unwrap(sent.result)
				await queryClient.invalidateQueries()
				void updateBalances()
				return { value, hash: sent.sendTransactionResponse?.hash }
			} catch (e) {
				throw new Error(friendlyError(e))
			}
		},
		[address, signTransaction, queryClient, updateBalances],
	)
}

export const txLink = (hash?: string) =>
	hash ? `https://stellar.expert/explorer/testnet/tx/${hash}` : undefined
