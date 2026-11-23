// Google Tag Manager és a sütihozzájárulás (Google Consent Mode v2, haladó mód).
// Dokumentáció: https://developers.google.com/tag-platform/security/guides/consent?consentmode=advanced
// A tárolóban (GTM-PCN2CJD3) egy GA4-mérés van (G-GM7398BY4M), Google Ads-összekötés nélkül. Két kategória:
// statisztika → analytics_storage; marketing → a Meta Pixel (utils/meta.ts) és a Google hirdetési jelzései
// (ad_storage, ad_user_data, ad_personalization).

import { metaPixelSzkript } from './meta';

export const GTM_AZONOSITO = 'GTM-PCN2CJD3';

// A választás a böngésző helyi tárhelyén (nem sütiben). A verzió növelésével, például új kategória vagy
// lényegesen módosított tájékoztató esetén, mindenkitől újra hozzájárulást kérünk.
export const HOZZAJARULAS_KULCS = 'dankuchen-suti';
// 2: a Meta Pixel bekerült a marketing kategóriába (2026-11-23), a korábbi hozzájárulás csak a Google Ads-re szólt.
export const HOZZAJARULAS_VERZIO = 2;
export const HOZZAJARULAS_ERVENYES_NAP = 365;

// A GTM 2026-os telepítőkódja (gtag('js') és a gtm.js?id= cím), egyetlen szkriptben a hozzájárulással.
// Sorrend a dokumentáció szerint: alapérték (minden tiltva), a tárolt választás visszaállítása, a GTM indítása.
//
// A Meta Pixel (utils/meta.ts) marketing-hozzájárulás esetén ugyanekkor indul.
//
// A gtm.js (kb. 200 KB) csak akkor töltődik be, ha az oldal betöltődött (load) ÉS a fő tartalom (LCP,
// a nyitókép) kirajzolódott, utána üresjáratban. Így nem versenyez a betűtípusokkal és a nyitóképpel,
// és a PageSpeed szimulációja sem számolja bele az LCP-be (a mobil tesztgépen az oldal csak ~2,4 s-nál
// jelenik meg, a load után induló GTM korábban ebbe belecsúszhatott). Ahol a böngésző nem jelzi az LCP-t,
// vagy a lap háttérben nyílt meg, a load után 5 s-mal indul. A gtag('js') időbélyege a valódi
// oldalbetöltést jelzi, a GTM a már lezajlott DOM Ready és Window Loaded eseményeket is lefuttatja.
export const gtmSzkript = () => `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
gtag('set', 'ads_data_redaction', true);
var marketing = false;
try {
  var v = JSON.parse(localStorage.getItem(${JSON.stringify(HOZZAJARULAS_KULCS)}) || 'null');
  if (v && v.verzio === ${HOZZAJARULAS_VERZIO} && Date.now() - v.ido < ${HOZZAJARULAS_ERVENYES_NAP} * 864e5) {
    var s = v.statisztika ? 'granted' : 'denied', m = v.marketing ? 'granted' : 'denied';
    gtag('consent', 'update', { analytics_storage: s, ad_storage: m, ad_user_data: m, ad_personalization: m });
    marketing = !!v.marketing;
  }
} catch (e) {}
gtag('js', new Date());
${metaPixelSzkript()}
(function () {
  var betoltve = false, kirajzolva = false, utemezve = false;
  function gtm() {
    var j = document.createElement('script');
    j.async = true;
    j.src = 'https://www.googletagmanager.com/gtm.js?id=${GTM_AZONOSITO}';
    document.head.appendChild(j);
    if (marketing) window.metaPixel(true);
  }
  function probal() {
    if (!betoltve || !kirajzolva || utemezve) return;
    utemezve = true;
    if ('requestIdleCallback' in window) requestIdleCallback(gtm, { timeout: 2000 });
    else setTimeout(gtm, 1);
  }
  function kesz() {
    kirajzolva = true;
    probal();
  }
  try {
    if (PerformanceObserver.supportedEntryTypes.indexOf('largest-contentful-paint') < 0) throw 0;
    new PerformanceObserver(kesz).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {
    kirajzolva = true;
  }
  function utanaBetoltes() {
    betoltve = true;
    probal();
    setTimeout(kesz, 5000);
  }
  if (document.readyState === 'complete') utanaBetoltes();
  else addEventListener('load', utanaBetoltes, { once: true });
})();
`;
