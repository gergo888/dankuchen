import nodemailer from 'nodemailer';
import studio from '../../data/studio.json' with { type: 'json' };
import type { Beallitasok } from './beallitasok.ts';
import type { FoglalasAdatok } from './db.ts';
import { napFelirat, oraFelirat, utcIdopont } from './idopontok.ts';

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

export function naptarFajl(f: Foglalas, sz: Beallitasok, cim: string, leiras: string, most: Date) {
  const kezdes = utcIdopont(f.nap, f.ora);
  const vege = new Date(kezdes.getTime() + sz.hosszPerc * 60 * 1000);
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//DANKUCHEN Kaposvar//Idopontfoglalas//HU',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:foglalas-${f.id}@dankuchen-kaposvar`,
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

// A látogatónak és a stúdiónak küldött levél. Sima szöveg, így a beírt adatok nem értelmeződnek HTML-ként.
export function levelek(f: Foglalas, sz: Beallitasok, most: Date) {
  const idopont = `${napFelirat(f.nap)}, ${oraFelirat(f.ora, sz.hosszPerc)}`;
  const felado = { name: sz.email.feladoNev, address: sz.email.felado };
  const targy = (sablon: string) => sablon.replace(/\{(idopont|nev)\}/g, (_, kulcs) => (kulcs === 'nev' ? f.nev : idopont));
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
    ...sz.mitHozzMagaddal.map((t) => `- ${t}`),
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
    `Lemondáskor az azonosítót (${f.id}) a foglalas.json lemondottFoglalasok listájába kell felvenni, a látogatót pedig értesíteni kell.`,
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
      to: sz.email.ertesitesiCimek,
      replyTo: f.email,
      subject: targy(sz.email.targyStudionak),
      text: studioSzoveg,
      attachments: melleklet(`Látványtervezés: ${f.nev}`, `Telefon: ${f.telefon}\nE-mail: ${f.email}\nÜzenet: ${f.uzenet || '–'}`),
    },
  };
}

// A foglalás a levél sikerétől függetlenül érvényes, ezért a hiba csak a naplóba kerül.
export async function levelekKuldese(f: Foglalas, sz: Beallitasok, most: Date) {
  const jelszo = process.env.SMTP_JELSZO;
  if (!jelszo) {
    console.warn(`[foglalas] nincs SMTP_JELSZO, a(z) ${f.id}. foglalás levelei nem mentek ki`);
    return;
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
  const { latogato, studio: studioLevel } = levelek(f, sz, most);
  const eredmenyek = await Promise.allSettled([kuldo.sendMail(latogato), kuldo.sendMail(studioLevel)]);
  eredmenyek.forEach((e, i) => {
    if (e.status === 'rejected') console.error(`[foglalas] a(z) ${f.id}. foglalás ${i === 0 ? 'látogatói' : 'stúdió'} levele nem ment ki:`, e.reason?.message);
  });
}
