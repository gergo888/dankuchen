// llms.txt (https://llmstxt.org): rövid, géppel olvasható összefoglaló az AI-keresőknek.
// A közös adatokból és a tartalomból készül, így a cím, a telefonszám és az árak mindig egyeznek az oldallal.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { url } from '../utils/url';
import studio from '../../../shared/studio.json';

export const GET: APIRoute = async ({ site }) => {
  const cim = (ut: string) => new URL(url(ut), site).href;
  const sorrendben = <T extends { data: { sorrend: number } }>(lista: T[]) => lista.sort((a, b) => a.data.sorrend - b.data.sorrend);
  const konyhak = sorrendben(await getCollection('konyhak'));
  const csomagok = sorrendben(await getCollection('danFirst'));
  const szolgaltatasok = sorrendben(await getCollection('szolgaltatasok'));

  const sorok = [
    `# ${studio.nev}`,
    '',
    '> DANKÜCHEN – Ausztria legtöbbet vásárolt konyhája, exkluzív stúdióban Kaposváron. Méretre szabott konyhák látványtervezéssel, kiszállítással és szereléssel.',
    '',
    `- Cím: ${studio.cim}`,
    `- Nyitvatartás: ${studio.nyitvatartas.map((n) => `${n.napok} ${n.ido}`).join(', ')}`,
    `- Telefon: ${studio.telefon}`,
    `- E-mail: ${studio.email}`,
    `- Üzemelteti: ${studio.uzemelteto}`,
    `- Szolgáltatások: ${szolgaltatasok.map((s) => s.data.cim.toLowerCase()).join(', ')}`,
    '',
    '## Oldalak',
    '',
    `- [Konyhák](${cim('/konyhak/')}): ${konyhak.map((k) => `${k.data.nev} (${k.data.alcim})`).join(', ')}. Mind méretre gyártva.`,
    `- [DAN FIRST](${cim('/dan-first/')}): komplett konyhacsomagok bútorral, Beko gépekkel és kiegészítőkkel, 3 hetes expressz gyártással. ${csomagok.map((c) => `${c.data.nev}: ${c.data.alcim}, ${c.data.ar}`).join('; ')}.`,
    `- [Időpontfoglalás](${cim('/idopontfoglalas/')}): online időpontfoglalás látványtervezésre a stúdióba.`,
    `- [Kapcsolat](${cim('/kapcsolat/')}): cím, nyitvatartás, térkép.`,
    '',
    '## Egyéb',
    '',
    `- [Adatkezelési tájékoztató](${cim('/adatkezeles/')})`,
    '',
  ];
  return new Response(sorok.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
