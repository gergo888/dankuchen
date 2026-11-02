// Az adatbázis napi mentése, a 14 legutóbbi marad. A `dankuchen-mentes.timer` indítja.
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MEGORZOTT = 14;
const DB = process.env.DB_PATH ?? '/var/lib/dankuchen/foglalasok.db';
const MAPPA = process.env.MENTES_MAPPA ?? join(dirname(DB), 'mentesek');

if (!existsSync(DB)) {
  console.log('Még nincs adatbázis, nincs mit menteni.');
  process.exit(0);
}

mkdirSync(MAPPA, { recursive: true });
const cel = join(MAPPA, `foglalasok-${new Date().toISOString().slice(0, 10)}.db`);
rmSync(cel, { force: true });

const db = new DatabaseSync(DB);
db.prepare('VACUUM INTO ?').run(cel);
db.close();

const fajlok = readdirSync(MAPPA).filter((f) => /^foglalasok-.*\.db$/.test(f)).sort().reverse();
for (const f of fajlok.slice(MEGORZOTT)) rmSync(join(MAPPA, f));
console.log(`Mentve: ${cel}`);
