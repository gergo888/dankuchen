import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beallitasok, ellenoriz } from '../src/lib/foglalas/beallitasok.ts';
import { aktivFoglalasok, foglal, foglaltOrak, lemondasok, megnyitas, regiekTorlese } from '../src/lib/foglalas/db.ts';
import { levelek, naptarFajl } from '../src/lib/foglalas/email.ts';
import {
  alapertelmezettNap,
  ervenyesIdopont,
  foglalhatoIdopontok,
  maiNap,
  napFelirat,
  oraFelirat,
  szabadIdopontok,
  unnepnapok,
  utcIdopont,
  type IdopontSzabalyok,
} from '../src/lib/foglalas/idopontok.ts';
import { urlapEllenorzes } from '../src/lib/foglalas/urlap.ts';

const SZABALYOK: IdopontSzabalyok = {
  hetNapjai: [1, 2, 3, 4, 5],
  kezdoOrak: ['08:00', '09:00', '15:00'],
  legkorabbanNapMulva: 1,
  legkesobbNapMulva: 56,
  pihenonapok: [],
  zarvaIdoszakok: [],
  zartOrak: [],
};
// 2027. március 1., hétfő, délelőtt
const MOST = new Date('2027-03-01T09:00:00Z');

const foglalasAdat = (nap = '2027-03-02', ora = '08:00') => ({
  nap,
  ora,
  nev: 'Teszt Elek',
  telefon: '+36 20 123 4567',
  email: 'teszt@example.hu',
  telepules: '',
  uzenet: '',
});

test('a mozgó ünnepek a húsvét dátumából jönnek', () => {
  const u = unnepnapok(2027);
  for (const nap of ['2027-03-26', '2027-03-29', '2027-05-17']) assert.ok(u.has(nap), nap);
  const u2026 = unnepnapok(2026);
  for (const nap of ['2026-04-03', '2026-04-06', '2026-05-25']) assert.ok(u2026.has(nap), nap);
});

test('a fix ünnepek benne vannak', () => {
  const u = unnepnapok(2027);
  for (const nap of ['01-01', '03-15', '05-01', '08-20', '10-23', '11-01', '12-25', '12-26']) assert.ok(u.has(`2027-${nap}`), nap);
  assert.equal(u.size, 11);
});

test('ünnepnapra és hétvégére nem lehet foglalni, nyitvatartási napra igen', () => {
  assert.ok(ervenyesIdopont('2027-03-02', '08:00', MOST, SZABALYOK), 'kedd');
  assert.ok(!ervenyesIdopont('2027-03-06', '08:00', MOST, SZABALYOK), 'szombat');
  assert.ok(!ervenyesIdopont('2027-03-07', '08:00', MOST, SZABALYOK), 'vasárnap');
  assert.ok(!ervenyesIdopont('2027-03-15', '08:00', MOST, SZABALYOK), 'március 15.');
  assert.ok(!ervenyesIdopont('2027-03-26', '08:00', MOST, SZABALYOK), 'nagypéntek');
  assert.ok(!ervenyesIdopont('2027-03-29', '08:00', MOST, SZABALYOK), 'húsvéthétfő');
});

test('nyitvatartáson kívüli és hibás időpont nem érvényes', () => {
  assert.ok(!ervenyesIdopont('2027-03-02', '07:00', MOST, SZABALYOK));
  assert.ok(!ervenyesIdopont('2027-03-02', '16:00', MOST, SZABALYOK));
  assert.ok(!ervenyesIdopont('2027-03-02', '8:00', MOST, SZABALYOK));
  assert.ok(!ervenyesIdopont('2027-02-31', '08:00', MOST, SZABALYOK));
  assert.ok(!ervenyesIdopont('nem-datum', '08:00', MOST, SZABALYOK));
});

test('az időablakon kívülre nem lehet foglalni', () => {
  assert.ok(!ervenyesIdopont('2027-03-01', '15:00', MOST, SZABALYOK), 'ma');
  assert.ok(!ervenyesIdopont('2027-02-26', '08:00', MOST, SZABALYOK), 'múlt');
  assert.ok(ervenyesIdopont('2027-04-26', '08:00', MOST, SZABALYOK), 'az 56. nap');
  assert.ok(!ervenyesIdopont('2027-04-27', '08:00', MOST, SZABALYOK), 'az 57. nap');
});

test('aznapi foglalásnál a már elmúlt órák nem választhatók', () => {
  const sz = { ...SZABALYOK, legkorabbanNapMulva: 0 };
  // 09:00 UTC = 10:00 magyar idő
  assert.deepEqual(foglalhatoIdopontok(MOST, sz)['2027-03-01'], ['15:00']);
});

test('a pihenőnap, a zárva tartás és a zárt óra nem foglalható', () => {
  const sz = {
    ...SZABALYOK,
    pihenonapok: ['2027-03-02'],
    zarvaIdoszakok: [{ tol: '2027-03-03', ig: '2027-03-04' }],
    zartOrak: [{ nap: '2027-03-05', ora: '09:00' }],
  };
  assert.ok(!ervenyesIdopont('2027-03-02', '08:00', MOST, sz));
  assert.ok(!ervenyesIdopont('2027-03-03', '08:00', MOST, sz));
  assert.ok(!ervenyesIdopont('2027-03-04', '08:00', MOST, sz));
  assert.ok(ervenyesIdopont('2027-03-05', '08:00', MOST, sz));
  assert.ok(!ervenyesIdopont('2027-03-05', '09:00', MOST, sz));
  assert.deepEqual(foglalhatoIdopontok(MOST, sz)['2027-03-05'], ['08:00', '15:00']);
});

test('a „ma” a magyar idő szerint értendő, az év végi határon is', () => {
  assert.equal(maiNap(new Date('2026-12-31T22:59:00Z')), '2026-12-31');
  assert.equal(maiNap(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
  assert.equal(maiNap(new Date('2027-07-15T22:30:00Z')), '2027-07-16');
});

test('a helyi időből helyes UTC lesz télen és nyáron', () => {
  assert.equal(utcIdopont('2027-01-15', '08:00').toISOString(), '2027-01-15T07:00:00.000Z');
  assert.equal(utcIdopont('2027-07-15', '08:00').toISOString(), '2027-07-15T06:00:00.000Z');
});

test('az alapértelmezett nap a holnapi, vagy az utána következő első szabad nap', () => {
  assert.equal(alapertelmezettNap(['2027-03-02', '2027-03-03'], MOST), '2027-03-02', 'holnap szabad');
  assert.equal(alapertelmezettNap(['2027-03-03', '2027-03-04'], MOST), '2027-03-03', 'holnap nem foglalható');
  assert.equal(alapertelmezettNap(['2027-03-01', '2027-03-02'], MOST), '2027-03-02', 'a mai nap is választható');
  assert.equal(alapertelmezettNap(['2027-03-01'], MOST), '2027-03-01', 'csak a mai nap maradt');
  // 23:30 UTC már a következő nap Magyarországon
  assert.equal(alapertelmezettNap(['2027-01-01', '2027-01-02'], new Date('2026-12-31T23:30:00Z')), '2027-01-02');
});

test('feliratok', () => {
  assert.equal(napFelirat('2026-11-03'), '2026. november 3., kedd');
  assert.equal(oraFelirat('08:00', 60), '8:00–9:00');
  assert.equal(oraFelirat('15:30', 45), '15:30–16:15');
});

test('a szabad órák közül a foglaltak eltűnnek', () => {
  const szabad = szabadIdopontok(MOST, SZABALYOK, [{ nap: '2027-03-02', ora: '08:00' }]);
  assert.deepEqual(szabad['2027-03-02'], ['09:00', '15:00']);
  const teli = szabadIdopontok(MOST, SZABALYOK, SZABALYOK.kezdoOrak.map((ora) => ({ nap: '2027-03-02', ora })));
  assert.equal(teli['2027-03-02'], undefined);
});

test('ugyanarra az órára nem lehet kétszer foglalni, lemondás után igen', () => {
  const db = megnyitas(':memory:');
  const id = foglal(db, foglalasAdat(), MOST);
  assert.equal(id, 1);
  assert.equal(foglal(db, foglalasAdat(), MOST), null);
  assert.deepEqual(foglaltOrak(db, '2027-03-01').map((f) => ({ ...f })), [{ nap: '2027-03-02', ora: '08:00' }]);

  assert.equal(lemondasok(db, [1], MOST), 1);
  assert.equal(foglaltOrak(db, '2027-03-01').length, 0);
  // Az elutasított próbálkozás is elhasznál egy azonosítót, ezért nem feltétlenül a következő szám jön.
  assert.ok(foglal(db, foglalasAdat(), MOST)! > 1);

  // A listában maradt azonosító az újraindításkor sem érinti az új foglalást.
  assert.equal(lemondasok(db, [1], MOST), 0);
  assert.equal(foglaltOrak(db, '2027-03-01').length, 1);
});

test('törölt foglalás azonosítója nem kerül újra kiosztásra', () => {
  const db = megnyitas(':memory:');
  foglal(db, foglalasAdat(), MOST);
  db.prepare('DELETE FROM foglalas WHERE id = 1').run();
  assert.equal(foglal(db, foglalasAdat(), MOST), 2);
});

test('az aktív foglalások számolása e-mail és telefonszám szerint', () => {
  const db = megnyitas(':memory:');
  foglal(db, foglalasAdat('2027-03-02', '08:00'), MOST);
  foglal(db, { ...foglalasAdat('2027-03-02', '09:00'), email: 'masik@example.hu', telefon: '06 30 111 2222' }, MOST);
  assert.equal(aktivFoglalasok(db, 'TESZT@example.hu', '+36 70 000 0000', '2027-03-01'), 1);
  assert.equal(aktivFoglalasok(db, 'uj@example.hu', '+36 (20) 123-4567', '2027-03-01'), 1);
  assert.equal(aktivFoglalasok(db, 'uj@example.hu', '+36 70 000 0000', '2027-03-01'), 0);
  assert.equal(aktivFoglalasok(db, 'teszt@example.hu', '+36 20 123 4567', '2027-03-03'), 0, 'múltbeli nem számít');
});

test('a 2 évnél régebbi foglalások törlődnek', () => {
  const db = megnyitas(':memory:');
  foglal(db, foglalasAdat('2025-03-03'), new Date('2025-02-01T10:00:00Z'));
  foglal(db, foglalasAdat('2027-03-02'), MOST);
  assert.equal(regiekTorlese(db, MOST), 1);
  assert.equal(foglaltOrak(db, '2000-01-01').length, 1);
});

test('az űrlap ellenőrzése', () => {
  const jo = { ...foglalasAdat(), adatkezeles: 'elfogadva' };
  assert.deepEqual(urlapEllenorzes(jo).hibak, []);
  assert.deepEqual(urlapEllenorzes({ ...jo, nev: '  ' }).hibak, ['nev']);
  assert.deepEqual(urlapEllenorzes({ ...jo, nev: 'Teszt\r\nBcc: x@example.hu' }).hibak, ['nev']);
  assert.deepEqual(urlapEllenorzes({ ...jo, telefon: 'abc' }).hibak, ['telefon']);
  assert.deepEqual(urlapEllenorzes({ ...jo, email: 'nem-email' }).hibak, ['email']);
  assert.deepEqual(urlapEllenorzes({ ...jo, uzenet: 'x'.repeat(2001) }).hibak, ['uzenet']);
  assert.deepEqual(urlapEllenorzes({ ...jo, adatkezeles: undefined }).hibak, ['adatkezeles']);
  assert.deepEqual(urlapEllenorzes({ ...jo, nev: 42 }).hibak, ['nev']);
});

test('a foglalas.json érvényes, és van értesítési cím', () => {
  assert.ok(beallitasok.email.ertesitesiCimek.length >= 1);
});

test('a hibás beállítás nem megy át az ellenőrzésen', () => {
  const hibas = (valtozas: object) => assert.throws(() => ellenoriz({ ...beallitasok, ...valtozas }));
  hibas({ pihenonapok: ['2027-02-31'] });
  hibas({ zarvaIdoszakok: [{ tol: '2027-03-05', ig: '2027-03-01' }] });
  hibas({ zartOrak: [{ nap: '2027-03-05', ora: '20:00' }] });
  hibas({ kezdoOrak: ['8:00'] });
  hibas({ hetNapjai: [9] });
  hibas({ email: { ...beallitasok.email, ertesitesiCimek: [] } });
  hibas({ email: { ...beallitasok.email, ertesitesiCimek: ['nem-email'] } });
  hibas({ email: { ...beallitasok.email, szerverNev: 'fabutorwebaruhaz' } });
  hibas({ email: { ...beallitasok.email, feladoNev: '' } });
  hibas({ email: { ...beallitasok.email, targyLatogatonak: '' } });
  hibas({ email: { ...beallitasok.email, targyStudionak: 'Foglalás: {datum}' } });
});

test('a feladó neve és a levelek tárgya a beállításokból jön', () => {
  const sz = {
    ...beallitasok,
    email: { ...beallitasok.email, feladoNev: 'Próba Stúdió', felado: 'a@example.hu', targyLatogatonak: 'Időpontod: {idopont}', targyStudionak: '{nev} foglalt: {idopont}, {nev}' },
  };
  const { latogato, studio } = levelek({ ...foglalasAdat(), nev: 'Kiss $& {idopont}', id: 1 }, sz, MOST);
  assert.deepEqual(latogato.from, { name: 'Próba Stúdió', address: 'a@example.hu' });
  assert.deepEqual(studio.from, { name: 'Próba Stúdió', address: 'a@example.hu' });
  assert.equal(latogato.subject, 'Időpontod: 2027. március 2., kedd, 8:00–9:00');
  // A név szó szerint kerül a tárgyba, a benne lévő jelek nem helyettesítődnek.
  assert.equal(studio.subject, 'Kiss $& {idopont} foglalt: 2027. március 2., kedd, 8:00–9:00, Kiss $& {idopont}');
});

test('a levelek minden értesítési címre mennek, a látogató nem látja őket', () => {
  const sz = { ...beallitasok, email: { ...beallitasok.email, ertesitesiCimek: ['a@example.hu', 'b@example.hu'] } };
  const { latogato, studio } = levelek({ ...foglalasAdat(), id: 42 }, sz, MOST);
  assert.deepEqual(studio.to, ['a@example.hu', 'b@example.hu']);
  assert.equal(studio.replyTo, 'teszt@example.hu');
  assert.match(studio.text, /Foglalás azonosítója: 42/);
  assert.equal(latogato.to, 'teszt@example.hu');
  assert.ok(!JSON.stringify(latogato).includes('b@example.hu'));
  assert.match(latogato.text, /2027\. március 2\., kedd, 8:00–9:00/);
});

test('a naptárfájl UTC időt használ, és a sorai nem hosszabbak 75 bájtnál', () => {
  const ics = naptarFajl({ ...foglalasAdat(), id: 7 }, beallitasok, 'Látványtervezés, ékezetekkel; '.repeat(5), 'Első sor\nMásik sor', MOST);
  assert.match(ics, /DTSTART:20270302T070000Z\r\n/);
  assert.match(ics, /DTEND:20270302T080000Z\r\n/);
  assert.match(ics, /UID:foglalas-7@/);
  assert.match(ics, /Első sor\\nMásik/);
  for (const sor of ics.split('\r\n')) assert.ok(Buffer.byteLength(sor) <= 75, sor);
});
