import { z } from 'astro/zod';
import adatok from '../../data/foglalas.json' with { type: 'json' };
import { ervenyesNapFormatum } from './idopontok.ts';

const nap = z.string().refine(ervenyesNapFormatum, 'ÉÉÉÉ-HH-NN formátumú, létező dátum kell');
const ora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'ÓÓ:PP formátum kell');
const targy = z.string().min(1).refine((s) => !/\{(?!idopont\}|nev\})/.test(s), 'csak {idopont} és {nev} helyettesítő használható');

const sema = z
  .object({
    hetNapjai: z.array(z.number().int().min(0).max(6)).min(1),
    kezdoOrak: z.array(ora).min(1),
    hosszPerc: z.number().int().positive(),
    legkorabbanNapMulva: z.number().int().min(0),
    legkesobbNapMulva: z.number().int().positive(),
    maxAktivFoglalas: z.number().int().positive(),
    pihenonapok: z.array(nap),
    zarvaIdoszakok: z.array(z.object({ tol: nap, ig: nap, ok: z.string().optional() })),
    zartOrak: z.array(z.object({ nap, ora, ok: z.string().optional() })),
    lemondottFoglalasok: z.array(z.number().int().positive()),
    email: z.object({
      smtpHost: z.string().min(1),
      smtpPort: z.number().int().positive(),
      szerverNev: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i, 'teljes domainnév kell, pl. pelda.hu'),
      felhasznalo: z.string().min(1),
      feladoNev: z.string().min(1),
      felado: z.email(),
      ertesitesiCimek: z.array(z.email()).min(1),
      targyLatogatonak: targy,
      targyStudionak: targy,
    }),
    mitHozzMagaddal: z.array(z.string().min(1)),
  })
  .superRefine((sz, ctx) => {
    if (sz.legkesobbNapMulva < sz.legkorabbanNapMulva) {
      ctx.addIssue({ code: 'custom', path: ['legkesobbNapMulva'], message: 'nem lehet kisebb a legkorabbanNapMulva értékénél' });
    }
    sz.zarvaIdoszakok.forEach((z_, i) => {
      if (z_.ig < z_.tol) ctx.addIssue({ code: 'custom', path: ['zarvaIdoszakok', i], message: 'az „ig” nem lehet a „tol” előtt' });
    });
    sz.zartOrak.forEach((z_, i) => {
      if (!sz.kezdoOrak.includes(z_.ora)) ctx.addIssue({ code: 'custom', path: ['zartOrak', i, 'ora'], message: 'nincs ilyen kezdő óra' });
    });
  });

export type Beallitasok = z.infer<typeof sema>;

// Hibás JSON-nal nem indul el a foglalás: a `deploy/telepit.sh` a tesztek miatt fel sem tölti.
export const ellenoriz = (ertek: unknown): Beallitasok => sema.parse(ertek);

export const beallitasok = ellenoriz(adatok);
