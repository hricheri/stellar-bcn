![Stellar](https://img.shields.io/badge/Stellar-black?style=for-the-badge)

```
╔══════════════════════════════════════════╗
║                                            ║
║       🕹️   BARCELONA BUILDER HQ   🕹️      ║
║                                            ║
╚══════════════════════════════════════════╝
```

![Network](https://img.shields.io/badge/network-testnet-9945FF?style=for-the-badge)
![Built with](https://img.shields.io/badge/built%20with-Soroban-000000?style=for-the-badge)
![Scaffold](https://img.shields.io/badge/Scaffold%20Stellar-grey?style=for-the-badge)
![Status](https://img.shields.io/badge/status-ready%20to%20hack-brightgreen?style=for-the-badge)

---

👉 **Antes del taller, sigue la [guía de preparación](docs/preparacion.md).**

---

## Qué es esto?

Este repositorio es el punto de partida del taller, no el proyecto final. Viene con un contrato de ejemplo ya funcionando de punta a punta (desplegado en testnet y conectado al frontend) para que no empieces de cero. A partir de ahí, es tuyo para modificar y convertir en lo que se te ocurra.

---

## Instalación

```bash
git clone https://github.com/janijesse/taller-stellar-bcn.git
cd taller-stellar-bcn
npm install
cp app/.env.example app/.env
npm start
```

La primera vez, todo se prepara solo: tu cuenta de testnet, el contrato compilado y desplegado, y el frontend disponible en:

```
[vite] ➜  Local:   http://localhost:5173/
```

---

## El contrato de ejemplo

**Guess the Number**: adivina un número del 1 al 10, con XLM de testnet de por medio:

```
┌─────────────────────────────────────────┐
│  1. El contrato elige un número 1-10     │
│  2. Adivinas                             │
│  3. Fallas  → pierdes 1 XLM (de prueba)  │
│  4. Aciertas → te llevas todo el pozo    │
└─────────────────────────────────────────┘
```

Se puede jugar desde el navegador (con una wallet conectada) o directo desde la terminal, sin wallet.

---

## Modificar el contrato

Vive en `contracts/guess-the-number/src/lib.rs`. Con `npm start` corriendo, cualquier cambio ahí se recompila y redespliega solo, y el frontend se actualiza, sin comandos extra. No hace falta que salga perfecto: esto es una base para experimentar, no un producto terminado.

---

## Stack técnico

```
contrato  →  Rust + Soroban
frontend  →  React + Vite
red       →  Stellar Testnet
base      →  Scaffold Stellar
```

---

## Estructura del proyecto

```
taller-stellar-bcn/
├── contracts/
│   └── guess-the-number/   ← tu punto de partida
├── app/                    ← el frontend
│   ├── .env                ← tu config local (no se sube)
│   └── .env.example
├── environments.toml        ← qué red y qué cuenta usar
└── package.json
```

---

## Problemas comunes

**La pantalla no carga la primera vez** → espera a que la terminal diga `Successfully generated client for: guess_the_number`, luego refresca.

**No tienes wallet** → puedes jugar igual desde la terminal, invocando el contrato directamente.

---

## Créditos

Base construida sobre [Scaffold Stellar](https://developers.stellar.org/docs/tools/scaffold-stellar), para Barcelona Builder HQ.
