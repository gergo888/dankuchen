// HTML-sablon, amely minden beillesztett értéket escape-el. Csak az `html` sablonnal készült részek
// kerülnek be nyersen, így a foglalásokban beírt szöveg sosem értelmeződik HTML-ként.
export class Html {
  readonly szoveg: string;
  constructor(szoveg: string) {
    this.szoveg = szoveg;
  }
  toString() {
    return this.szoveg;
  }
}

const CSERE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escape = (s: string) => s.replace(/[&<>"']/g, (k) => CSERE[k]);

function beillesztes(ertek: unknown): string {
  if (ertek instanceof Html) return ertek.szoveg;
  if (Array.isArray(ertek)) return ertek.map(beillesztes).join('');
  if (ertek === null || ertek === undefined || ertek === false) return '';
  return escape(String(ertek));
}

export function html(reszek: TemplateStringsArray, ...ertekek: unknown[]) {
  let eredmeny = reszek[0];
  ertekek.forEach((ertek, i) => (eredmeny += beillesztes(ertek) + reszek[i + 1]));
  return new Html(eredmeny);
}
