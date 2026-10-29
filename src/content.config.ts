import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Konyhamodellek: egy md fájl = egy modell (src/content/konyhak/*.md)
const konyhak = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/konyhak' }),
  schema: ({ image }) =>
    z.object({
      nev: z.string(),
      alcim: z.string(),
      // Egy modell több csoportba is tartozhat (pl. fogantyús és vidékies).
      csoportok: z.array(z.enum(['fogantyu-nelkuli', 'fogantyus', 'videkies', 'kis-meretu'])).min(1),
      sorrend: z.number(),
      fooldalon: z.boolean().default(false),
      kep: image(),
      kepLeiras: z.string(),
      galeria: z
        .array(z.object({ kep: image(), leiras: z.string() }))
        .default([]),
    }),
});

// Szolgáltatások: Látványtervezés, Kiszállítás, Helyszíni szerelés
const szolgaltatasok = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/szolgaltatasok' }),
  schema: z.object({
    cim: z.string(),
    sorrend: z.number(),
    ikon: z.enum(['terv', 'szallitas', 'szereles']),
  }),
});

// Okos részletek (fiókok, sarokszekrény stb.) a Konyhák oldalon
const reszletek = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/reszletek' }),
  schema: ({ image }) =>
    z.object({
      cim: z.string(),
      sorrend: z.number(),
      kep: image(),
      kepLeiras: z.string(),
    }),
});

// Hosszabb szövegblokkok (pl. Lamelló bemutatkozás)
const szovegek = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/szovegek' }),
  schema: z.object({
    cim: z.string(),
  }),
});

export const collections = { konyhak, szolgaltatasok, reszletek, szovegek };
