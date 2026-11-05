// @ts-check
import { defineConfig } from 'astro/config';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // Az éles domain beállítása után ide kerül (pl. 'https://dankuchenexkluzivstudio-kaposvar.hu').
  // site: 'https://example.hu',
  // Alkönyvtárba telepítéshez: BASE_PATH=/dankuchen npm run build
  base: process.env.BASE_PATH || '/',
  vite: {
    server: {
      // A foglalási API külön alkalmazás (backend/), fejlesztéskor ide kerülnek a kérései.
      proxy: { '/api': 'http://127.0.0.1:4322' },
      // A böngészőben futó script a ../shared mappából importál.
      fs: { allow: ['..'] },
    },
  },
});
