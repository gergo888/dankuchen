// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';

// SHARP_NELKUL=1: olyan gépen, ahol a sharp nem fut (pl. x86-64-v2 nélküli régi CPU),
// a képek optimalizálás nélkül jelennek meg. Éles buildhez ne használd.
const sharpNelkul = process.env.SHARP_NELKUL === '1';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // Az éles domain beállítása után ide kerül (pl. 'https://dankuchen-kaposvar.hu').
  // site: 'https://example.hu',
  ...(sharpNelkul && { image: { service: passthroughImageService() } }),
});
