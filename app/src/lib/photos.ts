// TATTOO APP: photos live in public/fotos (not on-chain), named after the
// artist or studio. See public/fotos/LEEME.md

export const slug = (name: string) =>
	name
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")

const photo = (prefix: string, name: string) =>
	`${import.meta.env.BASE_URL}fotos/${prefix}-${slug(name)}.jpg`

export const artistPhoto = (name: string) => photo("artista", name)
export const studioPhoto = (name: string) => photo("estudio", name)
export const homePhoto = (artistName: string) => photo("hogar", artistName)
