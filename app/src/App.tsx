import { Navigate, NavLink, Outlet, Route, Routes } from "react-router-dom"
import ConnectAccount from "./components/ConnectAccount"
import ArtistPage from "./pages/ArtistPage"
import Calendar from "./pages/Calendar"
import ClientInvite from "./pages/ClientInvite"
import ClientReview from "./pages/ClientReview"
import Debug from "./pages/Debug"
import Explore from "./pages/Explore"
import Favorites from "./pages/Favorites"
import Profile from "./pages/Profile"
import SignIn from "./pages/SignIn"
import Stays from "./pages/Stays"

function App() {
	return (
		<Routes>
			<Route element={<AppLayout />}>
				<Route path="/" element={<Explore />} />
				<Route path="/artistas" element={<Navigate to="/" replace />} />
				<Route path="/artista/:address" element={<ArtistPage />} />
				<Route path="/favoritos" element={<Favorites />} />
				<Route path="/guest" element={<Stays side="guest" />} />
				<Route path="/studio" element={<Stays side="studio" />} />
				<Route path="/swaps" element={<Navigate to="/guest" replace />} />
				<Route path="/calendario" element={<Calendar />} />
				<Route path="/perfil" element={<Profile />} />
				<Route path="/entrar" element={<SignIn />} />
				<Route path="/publicar" element={<Navigate to="/perfil" replace />} />
				<Route path="/clientes" element={<ClientInvite />} />
				<Route path="/resena/:secret" element={<ClientReview />} />
				<Route path="/debug" element={<Debug />} />
				<Route path="/debug/:contractName" element={<Debug />} />
			</Route>
		</Routes>
	)
}

// Dock icons (heroicons outline, as in the Sprint 4 design)
const icons: Record<string, React.ReactNode> = {
	explore: (
		<>
			<path d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
			<path d="M3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 010 18M12 3a14.5 14.5 0 000 18" />
		</>
	),
	favorites: (
		<path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
	),
	swaps: (
		<path d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-9L21 3m0 0l-4.5 4.5M21 3H7.5" />
	),
	calendar: (
		<path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
	),
	studio: <path d="M2.25 21h19.5M3.75 21V8.25L12 3l8.25 5.25V21M9 21v-6h6v6" />,
	publish: <path d="M12 4.5v15m7.5-7.5h-15" />,
	qr: (
		<path d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
	),
	profile: (
		<path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
	),
}

const dock = [
	{ to: "/", icon: "explore", label: "Explore" },
	{ to: "/favoritos", icon: "favorites", label: "Favorites" },
	{ to: "/calendario", icon: "calendar", label: "Calendar" },
	{ to: "/guest", icon: "swaps", label: "Guest" },
	{ to: "/studio", icon: "studio", label: "Studio" },
	{ to: "/perfil", icon: "profile", label: "Profile" },
]

const Dock = () => (
	<nav className="dock" aria-label="Navigation">
		{dock.map((d) => (
			<NavLink
				key={d.to}
				to={d.to}
				end={d.to === "/"}
				title={d.label}
				className={({ isActive }) => `dock-item${isActive ? " active" : ""}`}
			>
				<svg
					width="20"
					height="20"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					{icons[d.icon]}
				</svg>
				<span className="dock-label">{d.label}</span>
			</NavLink>
		))}
	</nav>
)

const AppLayout = () => (
	<>
		<header className="ts-header">
			<NavLink to="/" className="ts-logo">
				Tattoo Swap <span>on Stellar</span>
			</NavLink>
			<ConnectAccount />
		</header>
		<main className="ts-main">
			<Outlet />
		</main>
		<Dock />
	</>
)

export default App
