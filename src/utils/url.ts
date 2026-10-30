// Belső hivatkozás az Astro `base` beállításával (pl. /dankuchen alkönyvtárba telepítéskor).
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const url = (path: string) => `${base}${path}`;
