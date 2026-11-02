// Parancssori segéd a foglalásokhoz, mert nincs admin felület:
//   sudo -u dankuchen node /opt/dankuchen/foglalasok.mjs lista        közelgő foglalások azonosítóval
//   sudo -u dankuchen node /opt/dankuchen/foglalasok.mjs lista mind   minden tárolt foglalás, a lemondottak is
//   sudo -u dankuchen node /opt/dankuchen/foglalasok.mjs torol 12     egy foglalás végleges törlése (törlési kérelemre)
// Lemondáshoz nem ez kell, hanem a `lemondottFoglalasok` lista a foglalas.json-ban.
import { DatabaseSync } from 'node:sqlite';

const DB = process.env.DB_PATH ?? '/var/lib/dankuchen/foglalasok.db';
const [parancs, ertek] = process.argv.slice(2);
const db = new DatabaseSync(DB);

if (parancs === 'lista') {
  const ma = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Budapest' }).format(new Date());
  const sorok =
    ertek === 'mind'
      ? db.prepare('SELECT * FROM foglalas ORDER BY nap, ora').all()
      : db.prepare('SELECT * FROM foglalas WHERE lemondva IS NULL AND nap >= ? ORDER BY nap, ora').all(ma);
  for (const s of sorok) {
    console.log(`${s.id}\t${s.nap} ${s.ora}\t${s.nev}\t${s.telefon}\t${s.email}${s.telepules ? `\t${s.telepules}` : ''}${s.lemondva ? '\tLEMONDVA' : ''}`);
    if (s.uzenet) console.log(`\t${s.uzenet.replace(/\s+/g, ' ')}`);
  }
  console.log(`${sorok.length} foglalás`);
} else if (parancs === 'torol' && /^\d+$/.test(ertek ?? '')) {
  const { changes } = db.prepare('DELETE FROM foglalas WHERE id = ?').run(Number(ertek));
  console.log(changes ? `A(z) ${ertek}. foglalás törölve.` : `Nincs ${ertek}. azonosítójú foglalás.`);
} else {
  console.error('Használat: foglalasok.mjs lista [mind] | torol <azonosító>');
  process.exit(1);
}
