import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { jelszoHash } from '../src/admin/jelszo.ts';
import { szerverLetrehozasa } from '../src/server.ts';

// Memóriabeli adatbázis, SMTP-jelszó nélkül nem megy ki levél. A próbajelszó minden futáskor új.
process.env.DB_PATH = ':memory:';
delete process.env.SMTP_JELSZO;
const JELSZO = `proba-${randomBytes(9).toString('base64url')}`;
process.env.ADMIN_FELHASZNALO = 'studio';
process.env.ADMIN_JELSZO_HASH = await jelszoHash(JELSZO);
console.warn = () => {};
console.log = () => {};

const szerver = szerverLetrehozasa();
let alap = '';
let ipSzam = 0;
const ujIp = () => `10.1.0.${++ipSzam}`;

before(async () => {
  await new Promise<void>((ok) => szerver.listen(0, '127.0.0.1', ok));
  alap = `http://127.0.0.1:${(szerver.address() as AddressInfo).port}`;
});
after(() => {
  szerver.closeAllConnections();
  szerver.close();
});

type Urlap = Record<string, string> | [string, string][];

function keres(utvonal: string, o: { suti?: string; urlap?: Urlap; eredet?: string | null; ip?: string } = {}) {
  const fejlecek: Record<string, string> = { 'X-Forwarded-For': `1.2.3.4, ${o.ip ?? '10.9.0.1'}` };
  if (o.suti) fejlecek.Cookie = o.suti;
  if (o.urlap) {
    fejlecek['Content-Type'] = 'application/x-www-form-urlencoded';
    if (o.eredet !== null) fejlecek.Origin = o.eredet ?? alap;
  }
  return fetch(alap + utvonal, { method: o.urlap ? 'POST' : 'GET', redirect: 'manual', headers: fejlecek, body: o.urlap ? new URLSearchParams(o.urlap).toString() : undefined });
}

async function belep(ip = ujIp()) {
  const valasz = await keres('/admin/belepes', { urlap: { felhasznalo: 'studio', jelszo: JELSZO, vissza: '/admin/' }, ip });
  assert.equal(valasz.status, 303);
  const suti = valasz.headers.get('set-cookie')!.split(';')[0];
  const oldal = await (await keres('/admin/', { suti })).text();
  const csrf = /name="csrf" value="([^"]+)"/.exec(oldal)![1];
  return { suti, csrf };
}

const szabad = async () => ((await (await fetch(`${alap}/api/szabad-idopontok`)).json()) as { napok: Record<string, string[]> }).napok;

test('beállított jelszó nélkül az admin nem érhető el', async () => {
  const hash = process.env.ADMIN_JELSZO_HASH;
  delete process.env.ADMIN_JELSZO_HASH;
  try {
    assert.equal((await keres('/admin/')).status, 503);
    assert.equal((await keres('/admin/belepes', { urlap: { felhasznalo: 'studio', jelszo: JELSZO } })).status, 503);
  } finally {
    process.env.ADMIN_JELSZO_HASH = hash;
  }
});

test('belépés nélkül a belépésre irányít, a stílus és a szkript viszont elérhető', async () => {
  const valasz = await keres('/admin/zarva');
  assert.equal(valasz.status, 303);
  assert.equal(valasz.headers.get('location'), '/admin/belepes?vissza=%2Fadmin%2Fzarva');
  assert.equal((await keres('/admin')).headers.get('location'), '/admin/');
  const css = await keres('/admin/admin.css');
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type')!, /text\/css/);
  assert.equal((await keres('/admin/admin.js')).status, 200);
  // Belépés nélkül POST sem megy át.
  assert.equal((await keres('/admin/beallitasok', { urlap: { hosszPerc: '30' } })).status, 303);
});

test('rossz jelszóra 401, a 6. próbálkozás 429, más címről viszont lehet belépni', async () => {
  const ip = ujIp();
  for (let i = 0; i < 5; i++) {
    const valasz = await keres('/admin/belepes', { urlap: { felhasznalo: 'studio', jelszo: 'rossz-jelszo-123' }, ip });
    assert.equal(valasz.status, 401);
    assert.match(await valasz.text(), /Hibás felhasználónév vagy jelszó/);
  }
  assert.equal((await keres('/admin/belepes', { urlap: { felhasznalo: 'studio', jelszo: JELSZO }, ip })).status, 429, 'jó jelszóval is');
  assert.equal((await keres('/admin/belepes', { urlap: { felhasznalo: 'masik', jelszo: JELSZO }, ip: ujIp() })).status, 401, 'rossz névvel');
  await belep(ujIp());
});

test('a süti és a válaszok biztonsági beállításai', async () => {
  const valasz = await keres('/admin/belepes', { urlap: { felhasznalo: 'studio', jelszo: JELSZO, vissza: '/admin/' }, ip: ujIp() });
  const suti = valasz.headers.get('set-cookie')!;
  assert.match(suti, /^__Host-dk_admin=[\w-]{40,};/);
  for (const jelzo of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax']) assert.ok(suti.includes(jelzo), jelzo);

  const oldal = await keres('/admin/', { suti: suti.split(';')[0] });
  assert.equal(oldal.status, 200);
  assert.match(oldal.headers.get('content-security-policy')!, /default-src 'none'.*frame-ancestors 'none'/);
  assert.equal(oldal.headers.get('x-frame-options'), 'DENY');
  assert.equal(oldal.headers.get('cache-control'), 'no-store');
  assert.equal(oldal.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(oldal.headers.get('referrer-policy'), 'same-origin');
});

test('belépés után csak admin-útvonalra irányít vissza', async () => {
  const hova = async (vissza: string) =>
    (await keres('/admin/belepes', { urlap: { felhasznalo: 'studio', jelszo: JELSZO, vissza }, ip: ujIp() })).headers.get('location');
  assert.equal(await hova('/admin/zarva'), '/admin/zarva');
  assert.equal(await hova('https://gonosz.example/'), '/admin/');
  assert.equal(await hova('//gonosz.example/admin/'), '/admin/');
  assert.equal(await hova('/admin/\\gonosz.example'), '/admin/');
});

test('CSRF-token nélkül, idegen vagy hiányzó Origin fejléccel a POST elutasítva', async () => {
  const { suti, csrf } = await belep();
  const urlap = { csrf, muvelet: 'pihenonap-hozzaad', pihenonap: '2099-01-05' };
  assert.equal((await keres('/admin/zarva', { suti, urlap: { ...urlap, csrf: 'rossz' } })).status, 403);
  assert.equal((await keres('/admin/zarva', { suti, urlap, eredet: 'https://gonosz.example' })).status, 403);
  assert.equal((await keres('/admin/zarva', { suti, urlap, eredet: null })).status, 403);
  assert.ok(!(await (await keres('/admin/zarva', { suti })).text()).includes('2099'), 'nem mentette el');
  // Az Apache mögött az eredeti domain az X-Forwarded-Host fejlécben jön.
  const apacheMogott = await fetch(`${alap}/admin/zarva`, {
    method: 'POST',
    redirect: 'manual',
    headers: { Cookie: suti, 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://dankuchenkaposvar.hu', 'X-Forwarded-Host': 'dankuchenkaposvar.hu' },
    body: new URLSearchParams(urlap).toString(),
  });
  assert.equal(apacheMogott.status, 303);
  assert.equal((await keres('/admin/zarva', { suti, urlap: { csrf, muvelet: 'pihenonap-torol', nap: '2099-01-05' } })).status, 303);
});

test('telefonos foglalás: az óra a weboldalon foglalt lesz, a név escape-elve jelenik meg', async () => {
  const { suti, csrf } = await belep();
  const [nap, orak] = Object.entries(await szabad())[0];
  const ora = orak[0];
  const urlap = { csrf, nap, ora, nev: '<script>alert(1)</script> Kiss', telefon: '+36 20 999 0001', email: '', telepules: '', uzenet: 'Hívott telefonon' };

  const valasz = await keres('/admin/uj', { suti, urlap });
  assert.equal(valasz.status, 303);
  assert.match(valasz.headers.get('location')!, /^\/admin\/foglalas\/\d+\?uzenet=felveve$/);
  assert.ok(!(await szabad())[nap]?.includes(ora));

  const lista = await (await keres('/admin/', { suti })).text();
  assert.ok(lista.includes('&lt;script&gt;alert(1)&lt;/script&gt; Kiss'));
  assert.ok(!lista.includes('<script>alert'));
  assert.match(lista, /telefonos/);

  // Ugyanarra az órára másodszor nem lehet.
  assert.equal((await keres('/admin/uj', { suti, urlap })).status, 409);
  // Hibás adatnál mezőnkénti hiba, és nem rögzít.
  const hibas = await keres('/admin/uj', { suti, urlap: { ...urlap, ora: orak[1], nev: '', telefon: 'x' } });
  assert.equal(hibas.status, 400);
  const szoveg = await hibas.text();
  assert.match(szoveg, /Add meg a nevet/);
  assert.match(szoveg, /Érvényes telefonszám kell/);
  assert.ok((await szabad())[nap].includes(orak[1]));
  // Múltbeli napra nem lehet.
  assert.equal((await keres('/admin/uj', { suti, urlap: { ...urlap, nap: '2020-01-07' } })).status, 400);
  assert.match(await (await keres('/admin/uj?nap=2020-01-07', { suti })).text(), /Mai vagy későbbi napot válassz/);
  for (const rossz of ['2027-02-31', 'x', '[object Object]']) {
    const valasz = await keres(`/admin/uj?nap=${encodeURIComponent(rossz)}`, { suti });
    assert.equal(valasz.status, 200, rossz);
    assert.match(await valasz.text(), /Mai vagy későbbi napot válassz/);
  }
});

test('lemondás után az óra újra szabad, és a foglalás a lemondottak között van', async () => {
  const { suti, csrf } = await belep();
  const [nap, orak] = Object.entries(await szabad())[1];
  const ora = orak[0];
  const webes = await fetch(`${alap}/api/foglalas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ujIp() },
    body: JSON.stringify({ nap, ora, nev: 'Lemondandó Lili', telefon: '+36 20 999 0002', email: 'lili@example.hu', adatkezeles: 'elfogadva' }),
  });
  assert.equal(webes.status, 201);
  assert.ok(!(await szabad())[nap]?.includes(ora));

  const sor = (await (await keres('/admin/', { suti })).text()).split('<li class="foglalas">').find((s) => s.includes('Lemondandó Lili'))!;
  const id = /href="\/admin\/foglalas\/(\d+)"/.exec(sor)![1];
  const reszletek = await (await keres(`/admin/foglalas/${id}`, { suti })).text();
  assert.match(reszletek, /lili@example\.hu/);
  assert.match(reszletek, /name="ertesites" value="igen" checked/);

  const valasz = await keres(`/admin/foglalas/${id}/lemondas`, { suti, urlap: { csrf, indok: 'Közbejött egy szerelés.', ertesites: 'igen' } });
  assert.equal(valasz.status, 303);
  // SMTP-jelszó nélkül a levél nem megy ki, és ezt az admin jelzi.
  assert.equal(valasz.headers.get('location'), `/admin/foglalas/${id}?uzenet=lemondva.nincs-smtp`);
  assert.ok((await szabad())[nap].includes(ora));
  assert.match(await (await keres(`/admin/foglalas/${id}?uzenet=lemondva.nincs-smtp`, { suti })).text(), /A foglalás lemondva.*Levél nem ment ki/);
  assert.match(await (await keres('/admin/?nezet=lemondott', { suti })).text(), /Lemondandó Lili/);
  assert.ok(!(await (await keres('/admin/', { suti })).text()).includes('Lemondandó Lili'));
  // Másodszori lemondás nem változtat semmin.
  assert.equal((await keres(`/admin/foglalas/${id}/lemondas`, { suti, urlap: { csrf } })).headers.get('location'), `/admin/foglalas/${id}`);
  assert.equal((await keres('/admin/foglalas/999999', { suti })).status, 404);
});

test('zárva tartás: azonnal érvényes a weboldalon, és jelzi az érintett foglalásokat', async () => {
  const { suti, csrf } = await belep();
  const napok = Object.entries(await szabad());
  const [zartNap] = napok[2];
  const [oraNap, orak] = napok[3];
  const zarva = (urlap: Record<string, string>) => keres('/admin/zarva', { suti, urlap: { csrf, ...urlap } });

  // Egy élő foglalás a lezárandó napon.
  const foglalas = await keres('/admin/uj', { suti, urlap: { csrf, nap: zartNap, ora: napok[2][1][0], nev: 'Érintett Endre', telefon: '+36 20 999 0003', email: '' } });
  assert.equal(foglalas.status, 303);

  assert.equal((await zarva({ muvelet: 'idoszak-hozzaad', tol: zartNap, ig: zartNap, ok: 'Leltár' })).status, 303);
  assert.equal((await szabad())[zartNap], undefined);
  const oldal = await (await keres('/admin/zarva', { suti })).text();
  assert.match(oldal, /Leltár/);
  assert.match(oldal, /Zárva tartott időpontra eső élő foglalások[^]*Érintett Endre/);

  assert.equal((await zarva({ muvelet: 'ora-hozzaad', zartnap: oraNap, ora: orak[0], okora: 'Bemérés' })).status, 303);
  assert.ok(!(await szabad())[oraNap].includes(orak[0]));
  assert.equal((await zarva({ muvelet: 'ora-hozzaad', zartnap: oraNap, ora: '23:00' })).status, 400, 'nem kezdő óra');

  // Hibás időszak nem kerül be.
  assert.equal((await zarva({ muvelet: 'idoszak-hozzaad', tol: '2099-03-05', ig: '2099-03-01' })).status, 400);

  assert.equal((await zarva({ muvelet: 'idoszak-torol', tol: zartNap, ig: zartNap })).status, 303);
  assert.equal((await zarva({ muvelet: 'ora-torol', nap: oraNap, ora: orak[0] })).status, 303);
  assert.ok((await szabad())[oraNap].includes(orak[0]));
  assert.ok((await szabad())[zartNap].length > 0);
  assert.ok(!(await (await keres('/admin/zarva', { suti })).text()).includes('Érintett Endre'));
});

test('beállítások: a módosítás azonnal érvényes, hibás értéket nem ment', async () => {
  const { suti, csrf } = await belep();
  const mezok = (valtozas: Record<string, string> = {}): [string, string][] => [
    ['csrf', csrf],
    ['hetNapjai', '1'],
    ['hetNapjai', '3'],
    ['kezdoOrak', valtozas.kezdoOrak ?? '9:00, 10:00'],
    ['hosszPerc', valtozas.hosszPerc ?? '90'],
    ['legkorabbanNapMulva', '1'],
    ['legkesobbNapMulva', '30'],
    ['maxAktivFoglalas', '2'],
    ['ertesitesiCimek', valtozas.ertesitesiCimek ?? 'a@example.hu\nb@example.hu'],
  ];

  const hibas = await keres('/admin/beallitasok', { suti, urlap: mezok({ hosszPerc: '', ertesitesiCimek: 'nem-email' }) });
  assert.equal(hibas.status, 400);
  const hibaOldal = await hibas.text();
  assert.match(hibaOldal, /érvénytelen e-mail cím/);
  assert.match(hibaOldal, /id="hosszPerc"[^>]*aria-invalid="true"/);
  assert.equal((await (await fetch(`${alap}/api/szabad-idopontok`)).json()).hosszPerc, 60, 'nem mentette');

  assert.equal((await keres('/admin/beallitasok', { suti, urlap: mezok() })).status, 303);
  const api = (await (await fetch(`${alap}/api/szabad-idopontok`)).json()) as { hosszPerc: number; napok: Record<string, string[]> };
  assert.equal(api.hosszPerc, 90);
  for (const [nap, orak] of Object.entries(api.napok)) {
    assert.ok([1, 3].includes(new Date(`${nap}T00:00:00Z`).getUTCDay()), nap);
    assert.ok(orak.every((o) => ['09:00', '10:00'].includes(o)), orak.join());
  }
  const oldal = await (await keres('/admin/beallitasok?uzenet=mentve', { suti })).text();
  assert.match(oldal, /value="09:00, 10:00"/);
  assert.match(oldal, /A beállítások elmentve/);
});

test('kilépés és jelszócsere után a munkamenet érvénytelen', async () => {
  const { suti, csrf } = await belep();
  const kilepes = await keres('/admin/kilepes', { suti, urlap: { csrf } });
  assert.equal(kilepes.headers.get('location'), '/admin/belepes');
  assert.match(kilepes.headers.get('set-cookie')!, /Max-Age=0/);
  assert.equal((await keres('/admin/', { suti })).status, 303);

  const masik = await belep();
  const hash = process.env.ADMIN_JELSZO_HASH;
  process.env.ADMIN_JELSZO_HASH = await jelszoHash('egy-masik-jelszo-123');
  try {
    assert.equal((await keres('/admin/', { suti: masik.suti })).status, 303);
  } finally {
    process.env.ADMIN_JELSZO_HASH = hash;
  }
});
