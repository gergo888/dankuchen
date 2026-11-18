import nodemailer from 'nodemailer';
import studio from '../../shared/studio.json' with { type: 'json' };
import type { Beallitasok } from './beallitasok.ts';
import type { FoglalasAdatok } from './db.ts';
import { napFelirat, oraFelirat, utcIdopont } from '../../shared/idopontok.ts';

export interface Foglalas extends FoglalasAdatok {
  id: number;
}

const icsSzoveg = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsIdo = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// Az RFC 5545 szerint egy sor legfeljebb 75 bájt, a folytatósor szóközzel kezdődik.
function icsSor(sor: string) {
  const reszek: string[] = [];
  let aktualis = '';
  let bajt = 0;
  for (const karakter of sor) {
    const hossz = Buffer.byteLength(karakter);
    if (bajt + hossz > 74) {
      reszek.push(aktualis);
      aktualis = ' ';
      bajt = 1;
    }
    aktualis += karakter;
    bajt += hossz;
  }
  reszek.push(aktualis);
  return reszek.join('\r\n');
}

// Lemondáskor ugyanazzal az azonosítóval, `METHOD:CANCEL` értékkel megy, így a naptárprogramok többsége törli az eseményt.
export function naptarFajl(f: Foglalas, sz: Beallitasok, cim: string, leiras: string, most: Date, lemondas = false) {
  const kezdes = utcIdopont(f.nap, f.ora);
  const vege = new Date(kezdes.getTime() + sz.hosszPerc * 60 * 1000);
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//DANKUCHEN Kaposvar//Idopontfoglalas//HU',
      lemondas ? 'METHOD:CANCEL' : 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:foglalas-${f.id}@dankuchen-kaposvar`,
      ...(lemondas ? ['SEQUENCE:1', 'STATUS:CANCELLED'] : []),
      `DTSTAMP:${icsIdo(most)}`,
      `DTSTART:${icsIdo(kezdes)}`,
      `DTEND:${icsIdo(vege)}`,
      `SUMMARY:${icsSzoveg(cim)}`,
      `DESCRIPTION:${icsSzoveg(leiras)}`,
      `LOCATION:${icsSzoveg(`${studio.nev}, ${studio.cim}`)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .map(icsSor)
      .join('\r\n') + '\r\n'
  );
}

const KOVETKEZO_FOGLALAS = '/idopontfoglalas/';

// A levelek közös részei. A tárgyba a név szó szerint kerül, a benne lévő jelek nem helyettesítődnek.
function levelAlap(f: Foglalas, sz: Beallitasok) {
  const idopont = `${napFelirat(f.nap)}, ${oraFelirat(f.ora, sz.hosszPerc)}`;
  return {
    idopont,
    felado: { name: sz.email.feladoNev, address: sz.email.felado },
    targy: (sablon: string) => sablon.replace(/\{(idopont|nev)\}/g, (_, kulcs) => (kulcs === 'nev' ? f.nev : idopont)),
  };
}

// A látogatónak és a stúdiónak küldött levél. Sima szöveg, így a beírt adatok nem értelmeződnek HTML-ként.
export function levelek(f: Foglalas, sz: Beallitasok, most: Date) {
  const { idopont, felado, targy } = levelAlap(f, sz);
  const melleklet = (cim: string, leiras: string) => [
    { filename: 'idopont.ics', content: naptarFajl(f, sz, cim, leiras, most), contentType: 'text/calendar; charset=utf-8; method=PUBLISH' },
  ];

  const latogatoSzoveg = [
    `Kedves ${f.nev}!`,
    '',
    'Lefoglaltuk az időpontodat látványtervezésre.',
    '',
    `Időpont: ${idopont}`,
    `Helyszín: ${studio.nev}, ${studio.cim}`,
    `Térkép: ${studio.terkepLink}`,
    '',
    'Mit hozz magaddal?',
    ...studio.mitHozzMagaddal.map((t) => `- ${t}`),
    '',
    `Ha mégsem tudsz jönni, kérjük, jelezd a ${studio.telefon} telefonszámon.`,
    '',
    'Üdvözlettel:',
    studio.nev,
  ].join('\n');

  const studioSzoveg = [
    `Foglalás azonosítója: ${f.id}`,
    `Időpont: ${idopont}`,
    '',
    `Név: ${f.nev}`,
    `Telefon: ${f.telefon}`,
    `E-mail: ${f.email}`,
    `Település: ${f.telepules || '–'}`,
    '',
    'Üzenet:',
    f.uzenet || '–',
    '',
    `Részletek és lemondás: ${sz.oldalCim}/admin/foglalas/${f.id}`,
  ].join('\n');

  return {
    latogato: {
      from: felado,
      to: f.email,
      subject: targy(sz.email.targyLatogatonak),
      text: latogatoSzoveg,
      attachments: melleklet('Látványtervezés – DANKÜCHEN Kaposvár', `Telefon: ${studio.telefon}`),
    },
    studio: {
      from: felado,
      to: sz.ertesitesiCimek,
      replyTo: f.email,
      subject: targy(sz.email.targyStudionak),
      text: studioSzoveg,
      attachments: melleklet(`Látványtervezés: ${f.nev}`, `Telefon: ${f.telefon}\nE-mail: ${f.email}\nÜzenet: ${f.uzenet || '–'}`),
    },
  };
}

// A stúdió lemondta az időpontot. Az indoklás (ha van) szó szerint kerül a levélbe.
export function lemondoLevel(f: Foglalas, sz: Beallitasok, indok: string, most: Date) {
  const { idopont, felado, targy } = levelAlap(f, sz);
  const szoveg = [
    `Kedves ${f.nev}!`,
    '',
    `Sajnos le kellett mondanunk a látványtervezési időpontodat: ${idopont}.`,
    ...(indok ? ['', indok] : []),
    '',
    `Új időpontot itt foglalhatsz: ${sz.oldalCim}${KOVETKEZO_FOGLALAS}`,
    `Vagy hívj minket: ${studio.telefon}`,
    '',
    'Elnézést a kellemetlenségért!',
    '',
    'Üdvözlettel:',
    studio.nev,
  ].join('\n');
  return {
    from: felado,
    to: f.email,
    subject: targy(sz.email.targyLemondas),
    text: szoveg,
    attachments: [
      {
        filename: 'idopont.ics',
        content: naptarFajl(f, sz, 'Látványtervezés – DANKÜCHEN Kaposvár', 'Lemondva', most, true),
        contentType: 'text/calendar; charset=utf-8; method=CANCEL',
      },
    ],
  };
}

export type KuldesEredmeny = 'elkuldve' | 'nincs-smtp' | 'hiba';

// A levelek sorban, egy kapcsolaton mennek ki. A hiba csak a naplóba kerül, a foglalás ettől érvényes marad.
async function kuldes(sz: Beallitasok, leiras: string, uzenetek: { nev: string; level: object }[]): Promise<KuldesEredmeny> {
  const jelszo = process.env.SMTP_JELSZO;
  if (!jelszo) {
    console.warn(`[foglalas] nincs SMTP_JELSZO, ${leiras} levelei nem mentek ki`);
    return 'nincs-smtp';
  }
  const kuldo = nodemailer.createTransport({
    host: sz.email.smtpHost,
    port: sz.email.smtpPort,
    secure: sz.email.smtpPort === 465,
    name: sz.email.szerverNev,
    auth: { user: sz.email.felhasznalo, pass: jelszo },
    connectionTimeout: 15000,
    socketTimeout: 30000,
  });
  const eredmenyek = await Promise.allSettled(uzenetek.map((u) => kuldo.sendMail(u.level)));
  let hibas = false;
  eredmenyek.forEach((e, i) => {
    if (e.status === 'rejected') {
      hibas = true;
      console.error(`[foglalas] ${leiras} ${uzenetek[i].nev} levele nem ment ki:`, e.reason?.message);
    }
  });
  return hibas ? 'hiba' : 'elkuldve';
}

// Webes foglalás: visszaigazolás a látogatónak, értesítés a stúdiónak.
export function levelekKuldese(f: Foglalas, sz: Beallitasok, most: Date) {
  const { latogato, studio: studioLevel } = levelek(f, sz, most);
  return kuldes(sz, `a(z) ${f.id}. foglalás`, [
    { nev: 'látogatói', level: latogato },
    { nev: 'stúdió', level: studioLevel },
  ]);
}

// Telefonos foglalás: csak a látogató kap visszaigazolást, a stúdió maga rögzítette.
export function visszaigazolasKuldese(f: Foglalas, sz: Beallitasok, most: Date) {
  return kuldes(sz, `a(z) ${f.id}. foglalás`, [{ nev: 'látogatói', level: levelek(f, sz, most).latogato }]);
}

export function lemondoLevelKuldese(f: Foglalas, sz: Beallitasok, indok: string, most: Date) {
  return kuldes(sz, `a(z) ${f.id}. foglalás lemondásának`, [{ nev: 'látogatói', level: lemondoLevel(f, sz, indok, most) }]);
}
