// @ts-check
import { defineConfig } from 'astro/config';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site: 'https://dankuchenkaposvar.hu',
  // Alkönyvtárba telepítéshez: BASE_PATH=/alkonyvtar npm run build
  base: process.env.BASE_PATH || '/',
  // A kevés CSS a HTML-be kerül, így az oldal kirajzolása nem vár külön letöltésre.
  build: { inlineStylesheets: 'always' },
  vite: {
    server: {
      // A foglalási API külön alkalmazás (backend/), fejlesztéskor ide kerülnek a kérései.
      proxy: { '/api': 'http://127.0.0.1:4322' },
      // A böngészőben futó script a ../shared mappából importál.
      fs: { allow: ['..'] },
    },
  },
});
