import { z } from 'zod';
import { ervenyesNapFormatum } from '../../shared/idopontok.ts';
import adatok from '../foglalas.json' with { type: 'json' };

const nap = z.string().refine(ervenyesNapFormatum, 'ÉÉÉÉ-HH-NN formátumú, létező dátum kell');
const ora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'ÓÓ:PP formátum kell, pl. 08:00');
const ok = z.string().max(200).optional();
const targy = z.string().min(1).refine((s) => !/\{(?!idopont\}|nev\})/.test(s), 'csak {idopont} és {nev} helyettesítő használható');

// Az adminban szerkeszthető foglalási beállítások. Az adatbázisban vannak, a változás azonnal érvényes.
const foglalasiSema = z
  .object({
    hetNapjai: z.array(z.number().int().min(0).max(6)).min(1, 'legalább egy nap kell'),
    kezdoOrak: z.array(ora).min(1, 'legalább egy kezdő óra kell'),
    hosszPerc: z.number().int().min(15, 'legalább 15 perc').max(480, 'legfeljebb 480 perc'),
    legkorabbanNapMulva: z.number().int().min(0, 'nem lehet negatív'),
    legkesobbNapMulva: z.number().int().min(1, 'legalább 1').max(366, 'legfeljebb 366'),
    maxAktivFoglalas: z.number().int().min(1, 'legalább 1'),
    pihenonapok: z.array(nap),
    zarvaIdoszakok: z.array(z.object({ tol: nap, ig: nap, ok })),
    zartOrak: z.array(z.object({ nap, ora, ok })),
    ertesitesiCimek: z.array(z.email('érvénytelen e-mail cím')).min(1, 'legalább egy cím kell'),
  })
  .superRefine((sz, ctx) => {
    if (sz.legkesobbNapMulva < sz.legkorabbanNapMulva) {
      ctx.addIssue({ code: 'custom', path: ['legkesobbNapMulva'], message: 'nem lehet kisebb, mint ahány nap múlva legkorábban lehet foglalni' });
    }
    if (new Set(sz.kezdoOrak).size !== sz.kezdoOrak.length) ctx.addIssue({ code: 'custom', path: ['kezdoOrak'], message: 'egy óra csak egyszer szerepelhet' });
    sz.zarvaIdoszakok.forEach((z_, i) => {
      if (z_.ig < z_.tol) ctx.addIssue({ code: 'custom', path: ['zarvaIdoszakok', i], message: 'az „ig” nem lehet a „tól” előtt' });
    });
    sz.zartOrak.forEach((z_, i) => {
      if (!sz.kezdoOrak.includes(z_.ora)) ctx.addIssue({ code: 'custom', path: ['zartOrak', i, 'ora'], message: `a lezárt ${z_.nap} ${z_.ora} óra nem kezdő óra` });
    });
  });

export type FoglalasiBeallitasok = z.infer<typeof foglalasiSema>;

export const foglalasiEllenorzes = (ertek: unknown): FoglalasiBeallitasok => foglalasiSema.parse(ertek);

// Mezőnkénti hibaüzenetek az admin űrlapjaihoz, vagy `null`, ha az érték érvényes.
export function foglalasiHibak(ertek: unknown): Record<string, string> | null {
  const eredmeny = foglalasiSema.safeParse(ertek);
  if (eredmeny.success) return null;
  const hibak: Record<string, string> = {};
  for (const hiba of eredmeny.error.issues) hibak[String(hiba.path[0] ?? '')] ??= hiba.message;
  return hibak;
}

// Üres adatbázisnál ezekkel indul a foglalás. Utána csak az adminban módosíthatók.
export const ALAPERTEKEK: FoglalasiBeallitasok = foglalasiEllenorzes({
  hetNapjai: [1, 2, 3, 4, 5],
  kezdoOrak: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
  hosszPerc: 60,
  legkorabbanNapMulva: 1,
  legkesobbNapMulva: 56,
  maxAktivFoglalas: 2,
  pihenonapok: ['2026-12-24'],
  zarvaIdoszakok: [],
  zartOrak: [],
  ertesitesiCimek: ['szabo.gergely@lamello.hu', 'dan@lamello.hu'],
});

// A foglalas.json: a levélküldés technikai beállításai, telepítéssel módosíthatók.
const technikaiSema = z.object({
  oldalCim: z.url().refine((u) => !u.endsWith('/'), 'perjel nélkül kell, pl. https://pelda.hu'),
  email: z.object({
    smtpHost: z.string().min(1),
    smtpPort: z.number().int().positive(),
    szerverNev: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i, 'teljes domainnév kell, pl. pelda.hu'),
    felhasznalo: z.string().min(1),
    feladoNev: z.string().min(1),
    felado: z.email(),
    targyLatogatonak: targy,
    targyStudionak: targy,
    targyLemondas: targy,
  }),
});

export type TechnikaiBeallitasok = z.infer<typeof technikaiSema>;
export type Beallitasok = FoglalasiBeallitasok & TechnikaiBeallitasok;

// Hibás JSON-nal nem indul el a foglalás: a `deploy/telepit.sh` a tesztek miatt fel sem tölti.
export const technikaiEllenorzes = (ertek: unknown): TechnikaiBeallitasok => technikaiSema.parse(ertek);

export const technikai = technikaiEllenorzes(adatok);
