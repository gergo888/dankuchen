import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { szerverLetrehozasa } from '../src/server.ts';

// Memóriabeli adatbázis, és SMTP-jelszó nélkül nem megy ki levél.
process.env.DB_PATH = ':memory:';
delete process.env.SMTP_JELSZO;
console.warn = () => {};

const szerver = szerverLetrehozasa();
let alap = '';
let ipSzam = 0;

before(async () => {
  await new Promise<void>((ok) => szerver.listen(0, '127.0.0.1', ok));
  alap = `http://127.0.0.1:${(szerver.address() as AddressInfo).port}`;
});
after(() => {
  szerver.closeAllConnections();
  szerver.close();
});

// Minden kérés más IP-ről jön, hogy a korlátot csak az arra szánt teszt érje el.
const post = (adat: unknown, ip = `10.0.0.${++ipSzam}`, utvonal = '/api/foglalas') =>
  fetch(alap + utvonal, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `1.2.3.4, ${ip}` },
    body: typeof adat === 'string' ? adat : JSON.stringify(adat),
  });

const jo = (nap: string, ora: string, n: number) => ({
  nap,
  ora,
  nev: `Teszt ${n}`,
  telefon: `+36 20 000 ${String(n).padStart(4, '0')}`,
  email: `t${n}@example.hu`,
  adatkezeles: 'elfogadva',
});

const szabad = async () => (await (await fetch(`${alap}/api/szabad-idopontok`)).json()) as { hosszPerc: number; napok: Record<string, string[]> };

test('a szabad órák személyes adat nélkül, gyorsítótárazás nélkül jönnek', async () => {
  const valasz = await fetch(`${alap}/api/szabad-idopontok`);
  assert.equal(valasz.status, 200);
  assert.equal(valasz.headers.get('cache-control'), 'no-store');
  assert.match(valasz.headers.get('content-type')!, /application\/json/);
  const tartalom = (await valasz.json()) as object;
  assert.deepEqual(Object.keys(tartalom).sort(), ['hosszPerc', 'napok']);
});

test('az előtaggal és záró perjellel is működik, ahogy az Apache továbbítja', async () => {
  assert.equal((await fetch(`${alap}/dankuchen/api/szabad-idopontok`)).status, 200);
  assert.equal((await fetch(`${alap}/api/szabad-idopontok/`)).status, 200);
  assert.equal((await post('{nem json', undefined, '/dankuchen/api/foglalas')).status, 400);
});

test('ismeretlen útvonal és rossz metódus', async () => {
  assert.equal((await fetch(`${alap}/`)).status, 404);
  assert.equal((await fetch(`${alap}/api/valami`)).status, 404);
  assert.equal((await fetch(`${alap}/api/foglalas`)).status, 405);
  assert.equal((await post({}, undefined, '/api/szabad-idopontok')).status, 405);
});

test('hibás törzs és hiányzó mezők', async () => {
  assert.equal((await post('{nem json')).status, 400);
  assert.equal((await post('null')).status, 400);
  const valasz = await post({ nap: '2027-03-02' });
  assert.equal(valasz.status, 400);
  const { hiba, mezok } = (await valasz.json()) as { hiba: string; mezok: string[] };
  assert.equal(hiba, 'adat');
  assert.ok(mezok.includes('nev') && mezok.includes('adatkezeles'));
});

test('a túl nagy törzs 413, és a válasz eljut a klienshez', async () => {
  assert.equal((await post('x'.repeat(16 * 1024 + 1))).status, 413);
  assert.equal((await post({ ...jo('2027-03-02', '08:00', 1), uzenet: 'x'.repeat(2001) })).status, 400);
});

test('nem foglalható időpontra a szerver is elutasít', async () => {
  const ev = new Date().getFullYear();
  for (const [nap, ora] of [
    [`${ev}-12-25`, '08:00'],
    ['2020-01-07', '08:00'],
    [Object.keys((await szabad()).napok)[0], '16:00'],
    [Object.keys((await szabad()).napok)[0], '07:00'],
  ]) {
    const valasz = await post(jo(nap, ora, 2));
    assert.equal(valasz.status, 400, `${nap} ${ora}`);
    assert.deepEqual(await valasz.json(), { hiba: 'idopont' });
  }
});

test('a rejtett mezőt kitöltő robot sikert kap, de nem foglal', async () => {
  const nap = Object.keys((await szabad()).napok)[0];
  const ora = (await szabad()).napok[nap][0];
  assert.equal((await post({ ...jo(nap, ora, 3), _gotcha: 'robot' })).status, 201);
  assert.ok((await szabad()).napok[nap].includes(ora));
});

test('foglalás után az óra eltűnik, másodszor 409', async () => {
  const nap = Object.keys((await szabad()).napok)[1];
  const ora = (await szabad()).napok[nap][0];
  assert.equal((await post(jo(nap, ora, 4))).status, 201);
  assert.ok(!(await szabad()).napok[nap].includes(ora));
  const masodik = await post(jo(nap, ora, 5));
  assert.equal(masodik.status, 409);
  assert.deepEqual(await masodik.json(), { hiba: 'foglalt' });
});

test('egyidejű kérésekből pontosan egy nyer', async () => {
  const nap = Object.keys((await szabad()).napok)[2];
  const ora = (await szabad()).napok[nap][0];
  const valaszok = await Promise.all(Array.from({ length: 10 }, (_, i) => post(jo(nap, ora, 100 + i))));
  assert.equal(valaszok.filter((v) => v.status === 201).length, 1);
  assert.equal(valaszok.filter((v) => v.status === 409).length, 9);
});

test('egy e-mail címre legfeljebb a megengedett számú élő foglalás jut', async () => {
  const nap = Object.keys((await szabad()).napok)[3];
  const [a, b, c] = (await szabad()).napok[nap];
  assert.equal((await post(jo(nap, a, 6))).status, 201);
  assert.equal((await post(jo(nap, b, 6))).status, 201);
  const harmadik = await post(jo(nap, c, 6));
  assert.equal(harmadik.status, 429);
  assert.deepEqual(await harmadik.json(), { hiba: 'tul-sok-foglalas' });
});

test('az IP-korlát az X-Forwarded-For utolsó címére vonatkozik', async () => {
  const statuszok: number[] = [];
  for (let i = 0; i < 6; i++) statuszok.push((await post('{nem json', '10.9.9.9')).status);
  // A rossz JSON a korlát előtt kiszűrődik, így ez még nem számít próbálkozásnak.
  assert.deepEqual(statuszok, [400, 400, 400, 400, 400, 400]);
  for (let i = 0; i < 5; i++) assert.equal((await post({ nap: 'x' }, '10.9.9.9')).status, 400);
  const hatodik = await post({ nap: 'x' }, '10.9.9.9');
  assert.equal(hatodik.status, 429);
  assert.deepEqual(await hatodik.json(), { hiba: 'tul-sok-keres' });
  // Másik címről továbbra is mehet.
  assert.equal((await post({ nap: 'x' }, '10.9.9.10')).status, 400);
});
