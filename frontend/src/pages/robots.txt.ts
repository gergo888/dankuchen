// robots.txt: minden robot, az AI-keresőké is, olvashatja az oldalt, csak a foglalási API tiltott.
import type { APIRoute } from 'astro';
import { url } from '../utils/url';

export const GET: APIRoute = ({ site }) =>
  new Response(
    ['User-agent: *', `Disallow: ${url('/api/')}`, '', `Sitemap: ${new URL(url('/sitemap-index.xml'), site).href}`, ''].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
