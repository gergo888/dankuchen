import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { ervenyesHash } from './jelszo.ts';

// A belépés adatai a szerveren, a /etc/dankuchen/dankuchen.env fájlban (backend/admin-jelszo.ts írja).
export interface Hitelesites {
  felhasznalo: string;
  jelszoHash: string;
}

export function hitelesitesBeallitasa(): Hitelesites | null {
  const felhasznalo = process.env.ADMIN_FELHASZNALO?.trim();
  const jelszoHash = process.env.ADMIN_JELSZO_HASH?.trim();
  return felhasznalo && ervenyesHash(jelszoHash) ? { felhasznalo, jelszoHash: jelszoHash! } : null;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest();

// Állandó idejű összehasonlítás: a hash-ek mindig egyforma hosszúak.
export const egyezik = (a: string, b: string) => timingSafeEqual(sha256(a), sha256(b));

// A jelszó vagy a felhasználónév cseréjekor minden korábbi munkamenet érvénytelen lesz.
const ujjlenyomat = (h: Hitelesites) => sha256(`${h.felhasznalo}\n${h.jelszoHash}`).toString('hex').slice(0, 32);
const tokenHash = (token: string) => sha256(token).toString('hex');

export const SUTI = '__Host-dk_admin';
const ERVENYES_MS = 14 * 24 * 3600 * 1000;
// Naponta legfeljebb egyszer újítja meg a lejáratot, hogy ne írjon minden kérésnél.
const MEGUJITAS_MS = 24 * 3600 * 1000;

// A SameSite=Lax miatt az értesítő levél admin-linkje is bejelentkezve nyílik meg. A POST-okat a
// CSRF-token és az Origin ellenőrzése védi.
export const sutiFejlec = (token: string) => `${SUTI}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ERVENYES_MS / 1000}`;
export const sutiTorloFejlec = `${SUTI}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function munkamenetLetrehozasa(db: DatabaseSync, h: Hitelesites, most: Date) {
  const token = randomBytes(32).toString('base64url');
  const csrf = randomBytes(24).toString('base64url');
  db.prepare('DELETE FROM munkamenet WHERE lejar < ? OR ujjlenyomat != ?').run(most.toISOString(), ujjlenyomat(h));
  db.prepare('INSERT INTO munkamenet (token_hash, csrf, ujjlenyomat, lejar) VALUES (?, ?, ?, ?)').run(
    tokenHash(token),
    csrf,
    ujjlenyomat(h),
    new Date(most.getTime() + ERVENYES_MS).toISOString(),
  );
  return token;
}

// A munkamenet CSRF-tokenje, vagy `null`, ha a süti érvénytelen vagy lejárt. A `megujitva` jelzi, hogy a sütit is újra kell küldeni.
export function munkamenetEllenorzes(db: DatabaseSync, h: Hitelesites, token: string, most: Date) {
  const sor = db.prepare('SELECT csrf, ujjlenyomat, lejar FROM munkamenet WHERE token_hash = ?').get(tokenHash(token)) as
    | { csrf: string; ujjlenyomat: string; lejar: string }
    | undefined;
  if (!sor || sor.ujjlenyomat !== ujjlenyomat(h) || new Date(sor.lejar).getTime() <= most.getTime()) return null;
  const megujitva = new Date(sor.lejar).getTime() - most.getTime() < ERVENYES_MS - MEGUJITAS_MS;
  if (megujitva) {
    db.prepare('UPDATE munkamenet SET lejar = ? WHERE token_hash = ?').run(new Date(most.getTime() + ERVENYES_MS).toISOString(), tokenHash(token));
  }
  return { csrf: sor.csrf, megujitva };
}

export function munkamenetTorlese(db: DatabaseSync, token: string) {
  db.prepare('DELETE FROM munkamenet WHERE token_hash = ?').run(tokenHash(token));
}

export function sutiOlvasasa(req: IncomingMessage) {
  for (const resz of (req.headers.cookie ?? '').split(';')) {
    const [nev, ...ertek] = resz.trim().split('=');
    if (nev === SUTI) return ertek.join('=') || null;
  }
  return null;
}

// Az űrlap csak a saját oldalunkról jöhet. Az Apache mögött az eredeti domain az X-Forwarded-Host fejlécben van.
export function azonosEredet(req: IncomingMessage) {
  const eredet = req.headers.origin;
  if (!eredet || eredet === 'null') return false;
  const host = req.headers['x-forwarded-host']?.toString().split(',').pop()?.trim() || req.headers.host;
  try {
    return new URL(eredet).host === host;
  } catch {
    return false;
  }
}

export const keresIp = (req: IncomingMessage) => req.headers['x-forwarded-for']?.toString().split(',').pop()?.trim() || req.socket.remoteAddress || 'ismeretlen';

// Sikertelen belépések korlátja, csak memóriában: IP-nként 15 percenként 5, összesen óránként 30.
const IP_LIMIT = 5;
const IP_ABLAK_MS = 15 * 60 * 1000;
const OSSZ_LIMIT = 30;
const OSSZ_ABLAK_MS = 60 * 60 * 1000;
const hibasIpk = new Map<string, number[]>();
let hibasOsszes: number[] = [];

function takaritas(most: number) {
  for (const [ip, idok] of hibasIpk) {
    const friss = idok.filter((t) => most - t < IP_ABLAK_MS);
    if (friss.length > 0) hibasIpk.set(ip, friss);
    else hibasIpk.delete(ip);
  }
  hibasOsszes = hibasOsszes.filter((t) => most - t < OSSZ_ABLAK_MS);
}

export function belepesEngedett(ip: string, most: number) {
  takaritas(most);
  return (hibasIpk.get(ip)?.length ?? 0) < IP_LIMIT && hibasOsszes.length < OSSZ_LIMIT;
}

export function hibasBelepes(ip: string, most: number) {
  hibasIpk.set(ip, [...(hibasIpk.get(ip) ?? []), most]);
  hibasOsszes.push(most);
}

export function sikeresBelepes(ip: string) {
  hibasIpk.delete(ip);
}
