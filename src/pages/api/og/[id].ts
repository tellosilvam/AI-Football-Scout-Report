import type { APIRoute } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { getPlayerProfile } from '../../../lib/football/service';
import { seasonLabel } from '../../../lib/football/leagues';
import { isLang, t } from '../../../lib/i18n';
import type { Lang } from '../../../lib/ai/schema';
import { slicesFor } from '../../../lib/view';

export const prerender = false;

// Terrace palette (see src/styles/global.css).
const CANVAS = '#e9eae5';
const WASH = '#dcded7';
const INK = '#15181b';
const SOFT = '#4e545a';
const HI = '#d62828';
const band = (p: number) => (p >= 67 ? HI : p >= 34 ? '#9aa0a6' : '#2b59c3');

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (Node | string | null | false)[]): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.filter(Boolean) },
});

// Fonts are served from /public (OFL-licensed Bricolage Grotesque), fetched once per instance.
let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 800; style: 'normal' }[]> | null = null;
function loadFonts(origin: string) {
  fonts ??= Promise.all([
    fetch(new URL('/fonts/BricolageGrotesque-Display.ttf', origin)).then((r) => r.arrayBuffer()),
    fetch(new URL('/fonts/BricolageGrotesque-Regular.ttf', origin)).then((r) => r.arrayBuffer()),
  ])
    .then(([narrow, regular]) => [
      { name: 'Display', data: narrow, weight: 800 as const, style: 'normal' as const },
      { name: 'Text', data: regular, weight: 400 as const, style: 'normal' as const },
    ])
    .catch((e) => {
      fonts = null;
      throw e;
    });
  return fonts;
}

export const GET: APIRoute = async ({ params, url }) => {
  const langParam = url.searchParams.get('lang') ?? '';
  const lang: Lang = isLang(langParam) ? langParam : 'en';
  const d = t(lang);
  const id = Number(String(params.id).replace(/\.png$/, ''));
  const profile = id ? await getPlayerProfile(id).catch(() => null) : null;

  // Satori sizes boxes content-box: padding is added on top of width/height.
  const frame = { width: 1200 - 112, height: 630 - 112, background: CANVAS, color: INK, fontFamily: 'Text', flexDirection: 'column', justifyContent: 'space-between' };
  let body: Node;

  if (profile) {
    const top = slicesFor(profile, lang)
      .filter((s) => s.percentile !== null)
      .sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0))
      .slice(0, 4);
    body = h(
      'div',
      { ...frame, padding: 56, position: 'relative', justifyContent: 'flex-start', gap: 64 },
      h(
        'div',
        { position: 'absolute', top: 56, right: 56, flexDirection: 'column', alignItems: 'flex-end' },
        h('div', { fontFamily: 'Display', letterSpacing: -0.5, fontSize: 40, color: INK }, 'AI Scout'),
        h('div', { fontSize: 22, color: SOFT }, profile.peerGroup ? `${d.player.percentiles}, n=${profile.peerGroup.size}` : d.player.percentiles),
      ),
      h(
        'div',
        { alignItems: 'center', gap: 36 },
        { type: 'img', props: { src: profile.photo, width: 150, height: 150, style: { borderRadius: 10, border: `2px solid ${WASH}` } } },
        h(
          'div',
          { flexDirection: 'column' },
          h('div', { fontSize: 30, color: HI }, profile.position ? d.positions[profile.position] : ''),
          h('div', { fontSize: 100, fontFamily: 'Display', letterSpacing: -3, lineHeight: 1 }, profile.name),
          h('div', { fontSize: 30, color: SOFT, marginTop: 8 }, `${profile.team?.name ?? ''}  /  ${profile.league?.name ?? ''} ${seasonLabel(profile.season, profile.leagueId)}`),
        ),
      ),
      h(
        'div',
        { flexDirection: 'column', gap: 10 },
        ...top.map((s) =>
          h(
            'div',
            { alignItems: 'center', gap: 20 },
            h('div', { width: 260, fontSize: 26, color: SOFT }, s.label),
            h(
              'div',
              { width: 660, height: 16, background: WASH, borderRadius: 8 },
              h('div', { width: Math.round((660 * (s.percentile ?? 0)) / 100), height: 16, borderRadius: 8, background: band(s.percentile ?? 0) }),
            ),
            h('div', { width: 90, justifyContent: 'flex-end', fontSize: 34, fontFamily: 'Display', letterSpacing: -0.5 }, String(s.percentile)),
          ),
        ),
      ),
    );
  } else {
    body = h(
      'div',
      { ...frame, padding: 56 },
      h('div', { fontFamily: 'Display', letterSpacing: -0.5, fontSize: 44 }, 'AI Scout'),
      h('div', { fontFamily: 'Display', letterSpacing: -3, fontSize: 108, lineHeight: 0.95, whiteSpace: 'pre-wrap' }, d.landing.title),
    );
  }

  try {
    const svg = await satori(body as never, { width: 1200, height: 630, fonts: await loadFonts(url.origin) });
    const png = new Resvg(svg).render().asPng();
    return new Response(new Uint8Array(png), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    });
  } catch (e) {
    console.error('[og]', e);
    return new Response('OG render failed', { status: 500 });
  }
};
