import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { BinaryLike, ScryptOptions } from 'node:crypto';

// A jelszó scrypt-hash-e `scrypt:N:r:p:só:hash` alakban (base64url), `$` nélkül, hogy a systemd
// EnvironmentFile-ban se kelljen escape-elni. Az N = 2^15 kb. 32 MB memóriát és 50–100 ms-ot igényel.
const N = 2 ** 15;
const R = 8;
const P = 1;
const HOSSZ = 32;

const scryptAsync = (jelszo: BinaryLike, so: BinaryLike, hossz: number, opciok: ScryptOptions) =>
  new Promise<Buffer>((ok, hiba) => scrypt(jelszo, so, hossz, opciok, (err, kulcs) => (err ? hiba(err) : ok(kulcs))));

const opciok = (n: number, r: number, p: number) => ({ N: n, r, p, maxmem: 256 * n * r + 1024 * 1024 });

export async function jelszoHash(jelszo: string) {
  const so = randomBytes(16);
  const kulcs = await scryptAsync(jelszo.normalize('NFC'), so, HOSSZ, opciok(N, R, P));
  return ['scrypt', N, R, P, so.toString('base64url'), kulcs.toString('base64url')].join(':');
}

export async function jelszoEllenorzes(jelszo: string, tarolt: string) {
  const [tipus, n, r, p, so, hash] = tarolt.split(':');
  if (tipus !== 'scrypt' || !so || !hash) return false;
  const vart = Buffer.from(hash, 'base64url');
  const kulcs = await scryptAsync(jelszo.normalize('NFC'), Buffer.from(so, 'base64url'), vart.length, opciok(Number(n), Number(r), Number(p)));
  return timingSafeEqual(kulcs, vart);
}

export const ervenyesHash = (s: string | undefined) => /^scrypt:\d+:\d+:\d+:[\w-]+:[\w-]+$/.test(s ?? '');
