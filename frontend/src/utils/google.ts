// Google Tag Manager és a sütihozzájárulás (Google Consent Mode v2, haladó mód).
// Dokumentáció: https://developers.google.com/tag-platform/security/guides/consent?consentmode=advanced
// A tárolóban (GTM-PCN2CJD3) egy GA4-mérés van Google Ads-összekapcsolással, ezért két kategória kell:
// statisztika → analytics_storage, marketing → ad_storage, ad_user_data, ad_personalization.

export const GTM_AZONOSITO = 'GTM-PCN2CJD3';

// A választás a böngésző helyi tárhelyén (nem sütiben). A verzió növelésével, például új kategória vagy
// lényegesen módosított tájékoztató esetén, mindenkitől újra hozzájárulást kérünk.
export const HOZZAJARULAS_KULCS = 'dankuchen-suti';
export const HOZZAJARULAS_VERZIO = 1;
export const HOZZAJARULAS_ERVENYES_NAP = 365;

// A GTM 2026-os telepítőkódja (gtag('js') és a gtm.js?id= cím), egyetlen szkriptben a hozzájárulással.
// Sorrend a dokumentáció szerint: alapérték (minden tiltva), a tárolt választás visszaállítása, a GTM indítása.
//
// A gtm.js (kb. 200 KB) csak az oldal betöltése után, üresjáratban töltődik be, hogy ne versenyezzen a
// betűtípusokkal és a nyitóképpel, és ne futhasson az első megjelenítés előtt. A gtag('js') időbélyege a
// valódi oldalbetöltést jelzi, a GTM a már lezajlott DOM Ready és Window Loaded eseményeket is lefuttatja.
export const gtmSzkript = () => `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
gtag('set', 'ads_data_redaction', true);
try {
  var v = JSON.parse(localStorage.getItem(${JSON.stringify(HOZZAJARULAS_KULCS)}) || 'null');
  if (v && v.verzio === ${HOZZAJARULAS_VERZIO} && Date.now() - v.ido < ${HOZZAJARULAS_ERVENYES_NAP} * 864e5) {
    var s = v.statisztika ? 'granted' : 'denied', m = v.marketing ? 'granted' : 'denied';
    gtag('consent', 'update', { analytics_storage: s, ad_storage: m, ad_user_data: m, ad_personalization: m });
  }
} catch (e) {}
gtag('js', new Date());
(function () {
  function gtm() {
    var j = document.createElement('script');
    j.async = true;
    j.src = 'https://www.googletagmanager.com/gtm.js?id=${GTM_AZONOSITO}';
    document.head.appendChild(j);
  }
  function utana() {
    if ('requestIdleCallback' in window) requestIdleCallback(gtm, { timeout: 2000 });
    else setTimeout(gtm, 1);
  }
  if (document.readyState === 'complete') utana();
  else addEventListener('load', utana, { once: true });
})();
`;
