// Az admin felület felhasználónevének és jelszavának beállítása vagy cseréje. A szerveren, rootként:
//   node /opt/dankuchen/backend/admin-jelszo.ts
// Rejtett beírással kéri a jelszót, a scrypt-hash-t beírja a /etc/dankuchen/dankuchen.env fájlba,
// és újraindítja a szolgáltatást. Csere után minden korábbi belépés érvénytelen lesz.
//
// Fejlesztéshez a `--kiir` kapcsolóval csak kiírja a két sort, nem ír fájlba és nem indít újra:
//   node backend/admin-jelszo.ts --kiir
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { jelszoHash } from './src/admin/jelszo.ts';

const ENV_FAJL = process.env.ENV_FAJL ?? '/etc/dankuchen/dankuchen.env';
const csakKiir = process.argv.includes('--kiir');
const MIN_HOSSZ = 12;

// Nem terminálból (pl. csővezetékből) a teljes bemenet egyszerre jön, ezt soronként adja ki.
let bemenetSorai: Promise<string[]> | undefined;
const bemenet = () =>
  (bemenetSorai ??= new Promise((ok) => {
    let szoveg = '';
    process.stdin.on('data', (adat) => (szoveg += adat.toString()));
    process.stdin.on('end', () => ok(szoveg.split(/\r?\n/)));
  }));

// Egy sor beolvasása. Rejtett módban a beírt karakterek nem jelennek meg.
function kerdes(szoveg: string, rejtett = false) {
  return new Promise<string>((ok) => {
    process.stdout.write(szoveg);
    const be = process.stdin;
    if (!be.isTTY) {
      bemenet().then((sorok) => {
        process.stdout.write('\n');
        ok(sorok.shift() ?? '');
      });
      return;
    }
    be.setRawMode(true);
    be.resume();
    let ertek = '';
    const kezelo = (adat: Buffer) => {
      for (const karakter of adat.toString('utf-8')) {
        if (karakter === '\r' || karakter === '\n') {
          be.setRawMode(false);
          be.pause();
          be.off('data', kezelo);
          process.stdout.write('\n');
          return ok(ertek);
        }
        if (karakter === '\u0003') {
          process.stdout.write('\nMegszakítva.\n');
          process.exit(130);
        }
        if (karakter === '\u007f' || karakter === '\b') {
          if (ertek) {
            ertek = [...ertek].slice(0, -1).join('');
            if (!rejtett) process.stdout.write('\b \b');
          }
          continue;
        }
        ertek += karakter;
        if (!rejtett) process.stdout.write(karakter);
      }
    };
    be.on('data', kezelo);
  });
}

if (!csakKiir && !existsSync(ENV_FAJL)) {
  console.error(`Nem található: ${ENV_FAJL}. Rootként a szerveren kell futtatni, vagy fejlesztéshez a --kiir kapcsolóval.`);
  process.exit(1);
}

const felhasznalo = (await kerdes('Felhasználónév: ')).trim();
if (!/^[\w.@-]{3,64}$/.test(felhasznalo)) {
  console.error('A felhasználónév 3–64 karakter lehet: betű, szám, pont, kötőjel, aláhúzás, @.');
  process.exit(1);
}
const jelszo = await kerdes(`Jelszó (legalább ${MIN_HOSSZ} karakter): `, true);
if ([...jelszo].length < MIN_HOSSZ) {
  console.error(`A jelszó legalább ${MIN_HOSSZ} karakter legyen.`);
  process.exit(1);
}
if ((await kerdes('Jelszó még egyszer: ', true)) !== jelszo) {
  console.error('A két jelszó nem egyezik.');
  process.exit(1);
}

const sorok = { ADMIN_FELHASZNALO: felhasznalo, ADMIN_JELSZO_HASH: await jelszoHash(jelszo) };

if (csakKiir) {
  for (const [kulcs, ertek] of Object.entries(sorok)) console.log(`${kulcs}=${ertek}`);
  process.exit(0);
}

// A meglévő sorokat cseréli, a többit (DB_PATH, SMTP_JELSZO) változatlanul hagyja. A fájl jogosultsága marad.
let tartalom = readFileSync(ENV_FAJL, 'utf-8');
for (const [kulcs, ertek] of Object.entries(sorok)) {
  const minta = new RegExp(`^${kulcs}=.*$`, 'm');
  tartalom = minta.test(tartalom) ? tartalom.replace(minta, () => `${kulcs}=${ertek}`) : `${tartalom.replace(/\n?$/, '\n')}${kulcs}=${ertek}\n`;
}
writeFileSync(ENV_FAJL, tartalom);
console.log(`Elmentve: ${ENV_FAJL}`);

try {
  execFileSync('systemctl', ['restart', 'dankuchen'], { stdio: 'inherit' });
  console.log('A szolgáltatás újraindult, az új jelszóval már be lehet lépni.');
} catch {
  console.error('Az újraindítás nem sikerült. Indítsd újra kézzel: systemctl restart dankuchen');
  process.exit(1);
}
