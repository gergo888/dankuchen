// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site: 'https://dankuchenkaposvar.hu',
  // sitemap-index.xml a keresőknek. A köszönőoldal kimarad, a 404-es oldalt az integráció magától kihagyja.
  integrations: [sitemap({ filter: (oldal) => !oldal.includes('/koszonjuk/') })],
  // Alkönyvtárba telepítéshez: BASE_PATH=/alkonyvtar npm run build
  base: process.env.BASE_PATH || '/',
  // A kevés CSS a HTML-be kerül, így az oldal kirajzolása nem vár külön letöltésre.
  build: { inlineStylesheets: 'always' },
  // A fejlesztői szerver csak helyben figyel. A cím rögzített, mert a VPS-en a „localhost” az IPv6-os ::1-re
  // oldódik fel, és akkor az SSH-alagút (127.0.0.1:4321) nem érné el. Lásd: README, Fejlesztés a VPS-en.
  server: { host: '127.0.0.1', port: 4321 },
  vite: {
    server: {
      // A foglalási API és az admin felület külön alkalmazás (backend/), fejlesztéskor ide kerülnek a kérései.
      proxy: { '/api': 'http://127.0.0.1:4322', '/admin': 'http://127.0.0.1:4322' },
      // A böngészőben futó script a ../shared mappából importál.
      fs: { allow: ['..'] },
    },
  },
});
