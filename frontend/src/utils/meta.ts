// Meta Pixel (Facebook és Instagram hirdetések mérése). Marketing célú követés, ezért csak a „Marketing”
// kategória hozzájárulásával töltődik be: a tárolt választásnál a GTM-mel együtt (utils/google.ts), a banner
// elfogadásakor azonnal (SutiBanner.astro). A Meta-féle <noscript> kép szándékosan nincs az oldalon, mert az
// hozzájárulás nélkül is elküldené a látogatást.
export const META_PIXEL_AZONOSITO = '1699439024914908';

// A window.metaPixel(true) betölti a pixelt (init + PageView), vagy újra engedélyezi, ha már be volt töltve.
// A window.metaPixel(false) visszavonáskor leállítja a további küldést. A betöltő a Meta hivatalos kódja.
export const metaPixelSzkript = () => `
window.metaPixel = function (be) {
  if (!be) {
    if (window.fbq) fbq('consent', 'revoke');
    return;
  }
  if (window.fbq) {
    fbq('consent', 'grant');
    return;
  }
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${META_PIXEL_AZONOSITO}');
  fbq('track', 'PageView');
};
`;
