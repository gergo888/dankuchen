// A shared/studio.json adatai gépileg olvasható formában: telefonlink és strukturált adat (JSON-LD).
// Ha egy mező formátuma nem a várt, a build hibával leáll, így hibás adat nem kerülhet ki az oldalra.
import studio from '../../../shared/studio.json';

function rosszFormatum(mezo: string, ertek: string): never {
  throw new Error(`shared/studio.json: a(z) „${mezo}” mező formátuma nem várt: „${ertek}”`);
}

// "06 20 222 6486" → "+36202226486"
export function nemzetkoziTelefon(szam = studio.telefon) {
  const tiszta = szam.replace(/[\s()/-]/g, '');
  if (/^\+36\d{8,9}$/.test(tiszta)) return tiszta;
  if (/^06\d{8,9}$/.test(tiszta)) return `+36${tiszta.slice(2)}`;
  return rosszFormatum('telefon', szam);
}

// "7400 Kaposvár, Dombóvári út 1." → PostalAddress
function postacim(cim = studio.cim) {
  const m = cim.match(/^(\d{4}) ([^,]+), (.+)$/);
  if (!m) return rosszFormatum('cim', cim);
  return { '@type': 'PostalAddress', postalCode: m[1], addressLocality: m[2], streetAddress: m[3], addressCountry: 'HU' };
}

const NAPOK: [string, string][] = [
  ['hétfő', 'Monday'],
  ['kedd', 'Tuesday'],
  ['szerda', 'Wednesday'],
  ['csütörtök', 'Thursday'],
  ['péntek', 'Friday'],
  ['szombat', 'Saturday'],
  ['vasárnap', 'Sunday'],
];

// { napok: "Hétfő–péntek", ido: "8:00–16:00" } → OpeningHoursSpecification
function nyitvatartas() {
  return studio.nyitvatartas.map(({ napok, ido }) => {
    const [tol, ig = tol] = napok.toLowerCase().split(/\s*[–-]\s*/);
    const i = NAPOK.findIndex(([n]) => n === tol);
    const j = NAPOK.findIndex(([n]) => n === ig);
    if (i < 0 || j < i) return rosszFormatum('nyitvatartas.napok', napok);
    const t = ido.match(/^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})$/);
    if (!t) return rosszFormatum('nyitvatartas.ido', ido);
    return {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: NAPOK.slice(i, j + 1).map(([, angol]) => angol),
      opens: `${t[1].padStart(2, '0')}:${t[2]}`,
      closes: `${t[3].padStart(2, '0')}:${t[4]}`,
    };
  });
}

// "2.399.000 Ft" → 2399000
export function forintAr(ar: string) {
  const m = ar.match(/^(\d{1,3}(?:\.\d{3})*) Ft$/);
  if (!m) throw new Error(`Nem várt árformátum: „${ar}” (pl. "2.399.000 Ft")`);
  return Number(m[1].replace(/\./g, ''));
}

export const STUDIO_ID = (honlap: string) => `${honlap}#studio`;

// A stúdió mint helyi üzlet. Minden oldalra kerül, hogy a keresők és az AI-k egy szereplőként kezeljék.
export function uzletAdat({ honlap, kep, logo }: { honlap: string; kep: string; logo: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FurnitureStore',
    '@id': STUDIO_ID(honlap),
    name: studio.nev,
    url: honlap,
    telephone: nemzetkoziTelefon(),
    email: studio.email,
    address: postacim(),
    openingHoursSpecification: nyitvatartas(),
    hasMap: studio.terkepLink,
    image: kep,
    logo,
    brand: { '@type': 'Brand', name: 'DANKÜCHEN' },
    parentOrganization: { '@type': 'Organization', name: studio.uzemelteto },
  };
}

export function weboldalAdat(honlap: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: studio.nev,
    url: honlap,
    inLanguage: 'hu',
    publisher: { '@id': STUDIO_ID(honlap) },
  };
}
