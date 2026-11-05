import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { pathToFileURL } from 'node:url';
import { foglalasBekuldese, szabadIdopontokLekerese } from './api.ts';
import type { ApiValasz } from './api.ts';

const MAX_TORZS_BAJT = 16 * 1024;

// A törzs szövege, vagy `null`, ha túl nagy. A kérést végigolvassa, hogy a válasz eljusson a klienshez.
function torzsBeolvasasa(req: IncomingMessage) {
  return new Promise<string | null>((ok, hiba) => {
    const darabok: Buffer[] = [];
    let meret = 0;
    req.on('data', (darab: Buffer) => {
      meret += darab.length;
      if (meret <= MAX_TORZS_BAJT) darabok.push(darab);
    });
    req.on('end', () => ok(meret > MAX_TORZS_BAJT ? null : Buffer.concat(darabok).toString('utf-8')));
    req.on('error', hiba);
  });
}

function jsonBeolvasasa(szoveg: string): unknown {
  try {
    return JSON.parse(szoveg);
  } catch {
    return null;
  }
}

async function kerestKezel(req: IncomingMessage): Promise<ApiValasz> {
  // Az útvonal végét nézi, így a /dankuchen előtaggal és saját domainen is működik. A szerver csak helyben érhető el.
  const utvonal = new URL(req.url ?? '/', 'http://localhost').pathname.replace(/\/+$/, '');

  if (utvonal.endsWith('/api/szabad-idopontok')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return { status: 405, tartalom: { hiba: 'metodus' } };
    return szabadIdopontokLekerese();
  }

  if (utvonal.endsWith('/api/foglalas')) {
    if (req.method !== 'POST') return { status: 405, tartalom: { hiba: 'metodus' } };
    const torzs = await torzsBeolvasasa(req);
    if (torzs === null) return { status: 413, tartalom: { hiba: 'tul-nagy' } };
    // Az Apache az X-Forwarded-For végére írja a valódi címet.
    const ip = req.headers['x-forwarded-for']?.toString().split(',').pop()?.trim() || req.socket.remoteAddress || 'ismeretlen';
    return foglalasBekuldese(jsonBeolvasasa(torzs), ip);
  }

  return { status: 404, tartalom: { hiba: 'nincs-ilyen' } };
}

export function szerverLetrehozasa() {
  return createServer(async (req, res) => {
    let valasz: ApiValasz;
    try {
      valasz = await kerestKezel(req);
    } catch (err) {
      console.error('[foglalas] váratlan hiba:', err);
      valasz = { status: 500, tartalom: { hiba: 'szerver' } };
    }
    res.writeHead(valasz.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(valasz.tartalom));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 4322);
  szerverLetrehozasa().listen(port, host, () => console.log(`A foglalási API fut: http://${host}:${port}`));
}
