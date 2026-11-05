const LIMIT = 5;
const ABLAK_MS = 10 * 60 * 1000;
const kerelmek = new Map<string, number[]>();

// IP-nkénti korlát csak memóriában, így IP-cím nem kerül az adatbázisba.
export function korlatonBelul(ip: string, most: number) {
  for (const [kulcs, idok] of kerelmek) {
    const friss = idok.filter((t) => most - t < ABLAK_MS);
    if (friss.length > 0) kerelmek.set(kulcs, friss);
    else kerelmek.delete(kulcs);
  }
  const idok = kerelmek.get(ip) ?? [];
  if (idok.length >= LIMIT) return false;
  kerelmek.set(ip, [...idok, most]);
  return true;
}
