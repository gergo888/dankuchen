// A backend és a frontend együttes indítása fejlesztéshez. A Ctrl+C mindkettőt leállítja.
import { spawn } from 'node:child_process';

// Külön folyamatcsoportban indulnak, hogy a leállítás az npm alatt futó folyamatokat is elérje.
const folyamatok = ['backend', 'frontend'].map((mappa) => spawn('npm', ['--prefix', mappa, 'run', 'dev'], { stdio: 'inherit', detached: true }));

let leallt = false;

function leallitas() {
  if (leallt) return;
  leallt = true;
  for (const f of folyamatok) {
    try {
      process.kill(-f.pid, 'SIGTERM');
    } catch {
      // A folyamatcsoport már nem fut.
    }
  }
}

process.on('SIGINT', leallitas);
process.on('SIGTERM', leallitas);
folyamatok.forEach((f) => f.on('exit', leallitas));
