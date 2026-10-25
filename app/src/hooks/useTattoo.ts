import { tattooGuestSpot } from "@stellar-scaffold/app-lib/clients"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { useWallet } from "./useWallet"

// TATTOO APP: lecturas y escrituras del contrato tattoo_guest_spot

const ERROR_MESSAGES: Record<number, string> = {
	1: "Primero crea tu perfil de artista.",
	2: "Ya tienes un perfil creado.",
	3: "Ese estudio no existe.",
	4: "Ese estudio ya está reservado.",
	5: "No puedes reservar tu propio estudio.",
	6: "Esa reserva no existe.",
	7: "Solo quienes participaron de la estancia pueden hacer esto.",
	8: "La estancia tiene que estar completada antes de reseñar.",
	9: "La estancia ya estaba completada.",
	10: "Ya dejaste tu reseña para esta estancia.",
	11: "El puntaje tiene que ser de 1 a 5.",
	12: "La fecha de fin tiene que ser posterior a la de inicio.",
	13: "Este QR no es válido.",
	14: "Este QR ya se usó para dejar una reseña.",
	15: "Ese QR ya estaba registrado.",
	16: "Este QR no es válido.",
	17: "Estudio + hogar se desbloquea con 3 reseñas y promedio 4 o más.",
	19: "La reserva no está en el estado correcto para esto.",
	20: "El mensaje tiene que tener entre 1 y 280 caracteres.",
	21: "Solo puedes escribir a tus matches o a artistas con quienes tienes una reserva.",
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

export const useArtists = () =>
	useQuery({
		queryKey: ["artists"],
		queryFn: async () => (await tattooGuestSpot.list_artists()).result,
	})

export const useArtist = (address?: string) =>
	useQuery({
		queryKey: ["artist", address],
		enabled: !!address,
		queryFn: async () =>
			(await tattooGuestSpot.get_artist({ artist: address! })).result ?? null,
	})

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

export const useLikes = (address?: string) =>
	useQuery({
		queryKey: ["likes", address],
		enabled: !!address,
		queryFn: async () =>
			(await tattooGuestSpot.list_likes({ artist: address! })).result,
	})

/** Every artist's likes, to know who liked me */
export const useAllLikes = (addresses: string[]) =>
	useQuery({
		queryKey: ["all-likes", addresses],
		enabled: addresses.length > 0,
		queryFn: async () => {
			const entries = await Promise.all(
				addresses.map(
					async (a) =>
						[
							a,
							(await tattooGuestSpot.list_likes({ artist: a })).result,
						] as const,
				),
			)
			return new Map(entries)
		},
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
			if (!address)
				throw new Error("Conecta tu wallet o usa una cuenta de prueba.")
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
