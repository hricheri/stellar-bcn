import {
	connectWallet,
	profileModal,
	shortAddress,
} from "@stellar-scaffold/app-lib"
import { useWallet } from "../hooks/useWallet"

export const WalletButton = () => {
	const { address, isPending, balances, isDemo, startDemo, stopDemo } =
		useWallet()

	if (!address) {
		return (
			<div className="wallet-connected">
				<button
					className="btn-ghost"
					onClick={() => void startDemo()}
					disabled={isPending}
					title="Crea una cuenta de testnet en este navegador"
				>
					Probar sin wallet
				</button>
				<button
					className="btn-primary"
					onClick={() => void connectWallet()}
					disabled={isPending}
				>
					{isPending ? "Cargando..." : "Conectar wallet"}
				</button>
			</div>
		)
	}

	return (
		<div className="wallet-connected" style={{ opacity: isPending ? 0.6 : 1 }}>
			<span className="wallet-balance">
				{balances?.xlm?.balance ?? "-"} XLM
			</span>

			{isDemo ? (
				<button
					className="wallet-profile"
					onClick={stopDemo}
					title="Salir de la cuenta de prueba"
				>
					Prueba · {shortAddress(address)} ✕
				</button>
			) : (
				<button className="wallet-profile" onClick={() => void profileModal()}>
					{shortAddress(address)}
				</button>
			)}
		</div>
	)
}
