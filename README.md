# Tattoo Swap · on Stellar

> **EN:** A global network for traveling tattoo artists to find (or lend) studio space in other cities, with an **on-chain reputation** that can only be earned through real stays and real clients. Reviews live in a Soroban contract on Stellar Testnet. Nobody can delete them, and only people who actually took part can write them. Client reviews use one-time QR codes checked with Stellar's **native Poseidon (BN254)** host function.

![Network](https://img.shields.io/badge/network-testnet-9945FF?style=for-the-badge)
![Built with](https://img.shields.io/badge/built%20with-Soroban-000000?style=for-the-badge)
![Track](https://img.shields.io/badge/HackMeridian-Genesis%20·%20Stellar%20Unlocked-d2f05f?style=for-the-badge)

---

## El problema

Lxs tatuadorxs viajan para trabajar como *guest artists*, pero:

- **Encontrar estudio en otra ciudad es caro y depende de contactos.** Mientras tanto, el propio estudio (y muchas veces el hogar) queda vacío durante el viaje.
- **No existe una reputación confiable.** Las conductas peligrosas y depredadoras en el mundo del tatuaje no quedan registradas y pasan desapercibidas, lo que pone en riesgo a la comunidad. Las reseñas de las plataformas tradicionales se pueden borrar, comprar o inventar.

## Para quién

- **Tatuadorxs que viajan** y buscan un estudio equipado en otra ciudad, en sus fechas.
- **Tatuadorxs con estudio** que quieren prestarlo (o intercambiarlo) mientras viajan.
- **Clientes**, que pueden dejar una reseña verificada sin instalar nada.

## La propuesta

1. **Match por porcentaje.** Indicas ciudad, fechas y qué necesitas (mobiliario, insumos básicos y adicionales), y cada estudio aparece con su % de match y con lo que **tiene**, lo que **falta** y los **extras**.
2. **Reputación on-chain.** Host y guest se reseñan mutuamente, una vez cada unx y solo después de una estancia completada. Lxs clientes reseñan con un QR de un solo uso.
3. **Nuevxs vs. establecidxs.** Con 3 o más reseñas y un promedio de 4 o más, unx artista pasa a ser *establecidx* y desbloquea el intercambio **estudio + hogar**.
4. **Favoritos, swaps y calendario en una sola pantalla.** Matches en un carrusel circular con tarjetas que se dan vuelta para chatear, lista de swaps con acciones pendientes y un calendario con disponibilidad, propuestas y deadlines (por ejemplo, la gráfica de *guest artist* una semana antes).

---

## Cómo se usa Stellar (arquitectura)

```
┌──────────────────────────┐        ┌───────────────────────────────────────────┐
│  Frontend (React + Vite)  │        │  Contrato Soroban: tattoo_guest_spot      │
│                           │  RPC   │                                           │
│  · Explorar (% de match)  │ ─────▶ │  Perfiles · Estudios · Reservas           │
│  · Favoritos/Swaps/Agenda │        │  Likes → Match · Chat entre matches       │
│  · QR para clientes       │        │  Reseñas host/guest/cliente               │
│  · Wallet o cuenta prueba │        │  Invitaciones Poseidon (BN254)            │
└──────────────────────────┘        │  Sin dinero: los swaps no son monetarios  │
                                     └───────────────────────────────────────────┘
```

| Pieza de Stellar | Para qué la usamos |
|---|---|
| **Contrato Soroban** (`contracts/tattoo-guest-spot`) | Toda la lógica: perfiles, estudios, reservas, likes y match, chat y reseñas. |
| **Poseidon nativo (host function BN254, Protocol 25)** | El artista registra `Poseidon(secreto)`, y el secreto solo viaja dentro del QR. Al reseñar, el contrato recalcula el hash on-chain y quema la invitación. No se puede inventar ni reutilizar un QR. Usa el crate oficial [`soroban-poseidon`](https://github.com/stellar/rs-soroban-poseidon), compatible con circomlib (lo validamos en los tests con el vector `Poseidon([1])`). |
| **Eventos de contrato** | `SpotPublished`, `SpotBooked`, `ReviewLeft`, `Matched` y `HomeSwapUnlocked`, para rastrear la actividad en exploradores. |
| **Wallets** | [Stellar Wallets Kit](https://stellarwalletskit.dev/) (Freighter, xBull, etc.) o una **cuenta de prueba** creada en el navegador y fondeada con Friendbot, para que jurado y clientes prueben sin instalar nada. |

### Contrato en testnet

| | |
|---|---|
| Contract ID | `PENDIENTE` (se completa tras el primer `npm start`) |
| Explorador | `https://stellar.expert/explorer/testnet/contract/<ID>` |
| Transacciones de ejemplo | Ver la sección [Evidencia on-chain](#evidencia-on-chain) |

### Funciones principales

| Función | Quién | Qué hace |
|---|---|---|
| `register_artist` | artista | Crea el perfil (nombre, ciudad, Instagram) |
| `publish_spot` | host | Publica (desde su perfil) las fechas en que su estudio queda libre, con equipamiento e insumos y opción **estudio + hogar** (solo si es establecidx) |
| `book_spot` | guest | Reserva fechas ya publicadas: quedan confirmadas al instante |
| `propose_dates` | guest | Propone fechas nuevas en el estudio de otrx artista |
| `confirm_booking` / `decline_booking` | host | Acepta o rechaza las fechas propuestas |
| `mark_promo_sent` | host o guest | Marca la gráfica de *guest artist* como publicada |
| `complete_stay` | host | Cierra la estancia y habilita las reseñas |
| `review_artist` | host o guest | Reseña mutua: 1 a 5 estrellas, etiquetas y comentario; una por lado |
| `like_artist` / `list_likes` | artista | Like; si es mutuo, es **match** |
| `send_message` / `list_messages` | matches | Chat corto (280 caracteres), solo entre matches o artistas con una reserva compartida |
| `create_client_invite` / `review_by_client` | artista / cliente | QR de un solo uso verificado con Poseidon |
| `get_reputation` | cualquiera | Promedio, cantidad de reseñas y si desbloqueó estudio + hogar |

---

## Instalación

Requisitos: [Node.js](https://nodejs.org) 22 LTS, [Rust](https://rustup.rs) con `rustup target add wasm32v1-none`, [Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli) y Scaffold Stellar (`cargo install --locked stellar-scaffold-cli`).

```bash
git clone https://github.com/hricheri/stellar-bcn.git
cd stellar-bcn
npm install
cp app/.env.example app/.env
npm start
```

El primer `npm start` hace todo esto solo:

1. Crea y fondea en testnet las cuentas `me`, `bea`, `cata` y `dani`.
2. Compila y despliega `tattoo_guest_spot`.
3. Carga **datos de ejemplo** (bloque `after_deploy` de `environments.toml`): 4 artistas, estudios en Berlín, CDMX, Lisboa y Barcelona, tres estancias completas con reseñas (Dani y Cata quedan *establecidxs*), una reserva pendiente en tu estudio, likes y un mensaje.
4. Levanta la app en `http://localhost:5173`.

### Variables de entorno (`app/.env`)

| Variable | Valor |
|---|---|
| `STELLAR_SCAFFOLD_ENV` | `development` |
| `PUBLIC_STELLAR_NETWORK` | `TESTNET` |
| `PUBLIC_STELLAR_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |
| `PUBLIC_STELLAR_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `PUBLIC_STELLAR_HORIZON_URL` | `https://horizon-testnet.stellar.org` |

### Tests del contrato

```bash
cargo test -p tattoo-guest-spot
```

---

## Demo

**URL pública:** `PENDIENTE`

1. Toca **Probar sin wallet** (o conecta Freighter en testnet) y crea tu perfil.
2. **Explorar:** indica ciudad, fechas e insumos, y mira el % de match de cada estudio.
3. **Artistas:** compara nuevxs y establecidxs y dale ♡ a alguien.
4. **Favoritos → Swaps → Calendario:** da vuelta una tarjeta para chatear, propón fechas, confirma y marca la gráfica. El calendario muestra todo junto.
5. **QR:** genera un QR para un cliente, ábrelo en otra pestaña o en el móvil y deja una reseña sin wallet.
6. Cada acción enlaza su transacción en **stellar.expert**.

### Evidencia on-chain

`PENDIENTE`: links a transacciones de la demo en testnet.

---

## Punto de partida y trabajo hecho en HackMeridian

- **Plantilla:** [taller-stellar-bcn](https://github.com/janijesse/taller-stellar-bcn) (Barcelona Builder HQ), basada en Scaffold Stellar. Aporta el andamiaje (build, deploy, wallet, cliente TypeScript generado) y contratos de ejemplo, que quedaron **desactivados** en `environments.toml`.
- **Trabajo previo de la autora:** el concepto y el diseño visual de Tattoo Swap (paleta lavanda + lima, tarjetas de estudio y hogar, insumos que tiene o faltan) vienen de un proyecto académico anterior en Laravel ([Sprint-4---Tattoo-app](https://github.com/hricheri/Sprint-4---Tattoo-app)). **No se reutilizó código** de ese proyecto.
- **Construido durante el evento** (ver historial de commits): el contrato `tattoo-guest-spot` completo y sus tests, la integración con Poseidon, el % de match, la pantalla unificada Favoritos + Swaps + Calendario, las reseñas con QR, la cuenta de prueba sin wallet y los datos de ejemplo.

## Uso de IA

Este proyecto se construyó con asistencia de **Claude (Anthropic)**, siguiendo las reglas del evento:

- **La autora (Hui) definió** la idea, el problema, las reglas de negocio (match por ciudad, fechas e insumos; nuevxs vs. establecidxs; estudio + hogar por reputación; reseñas de clientes vía QR) y la reestructuración de Favoritos, Swaps y Calendario, y revisó el resultado.
- **Claude generó** la mayor parte del código del contrato, los tests, el frontend y este README.

## Próximos pasos

- Mensajes cifrados de extremo a extremo y guardados fuera de la cadena (hoy el chat es público en testnet).
- Verificación de identidad de clientes (credenciales verificables o pruebas ZK de pertenencia, con BN254).
- Reportes de conductas peligrosas con moderación comunitaria.
- Fotos de estudio y hogar, mapa y notificaciones.
- Mainnet.

---

Hecho con [Scaffold Stellar](https://developers.stellar.org/docs/tools/scaffold-stellar) para HackMeridian.
