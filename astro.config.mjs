// @ts-check
import { defineConfig } from 'astro/config';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // Az éles domain beállítása után ide kerül (pl. 'https://dankuchenexkluzivstudio-kaposvar.hu').
  // site: 'https://example.hu',
  // Alkönyvtárba telepítéshez: BASE_PATH=/dankuchen npm run build
  base: process.env.BASE_PATH || '/',
});
