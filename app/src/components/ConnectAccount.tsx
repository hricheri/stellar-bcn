import React from "react"
import NetworkPill from "./NetworkPill"
import { WalletButton } from "./WalletButton"

const ConnectAccount: React.FC = () => {
	return (
		<div className="connect-account">
			<NetworkPill />
			<WalletButton />
		</div>
	)
}

export default ConnectAccount
