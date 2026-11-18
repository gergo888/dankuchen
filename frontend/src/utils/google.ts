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

// A <head> elejére kerülő szkript. Sorrend a dokumentáció szerint: alapérték (minden tiltva),
// a tárolt választás visszaállítása, majd a szabványos GTM-betöltő. A <noscript> iframe szándékosan
// marad ki, mert az hozzájárulás nélkül töltené be a tárolót.
export const fejSzkript = () => `
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
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(GTM_AZONOSITO)});
`;
