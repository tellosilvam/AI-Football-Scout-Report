import type { APIRoute } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { getPlayerProfile } from '../../../lib/football/service';
import { seasonLabel } from '../../../lib/football/leagues';
import { isLang, t } from '../../../lib/i18n';
import type { Lang } from '../../../lib/ai/schema';
import { slicesFor } from '../../../lib/view';

export const prerender = false;

const PITCH = '#0e1a14';
const LINE = '#2a3d32';
const CHALK = '#e9ede4';
const DIM = '#a9b8ad';
const FLOOD = '#f2b33d';
const band = (p: number) => (p >= 67 ? FLOOD : p >= 34 ? '#8fa596' : '#e0563b');

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (Node | string | null | false)[]): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.filter(Boolean) },
});

// Fonts are served from /public (OFL-licensed Archivo), fetched once per instance.
let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }[]> | null = null;
function loadFonts(origin: string) {
  fonts ??= Promise.all([
    fetch(new URL('/fonts/ArchivoNarrow-Bold.ttf', origin)).then((r) => r.arrayBuffer()),
    fetch(new URL('/fonts/Archivo-Regular.ttf', origin)).then((r) => r.arrayBuffer()),
  ])
    .then(([narrow, regular]) => [
      { name: 'Narrow', data: narrow, weight: 700 as const, style: 'normal' as const },
      { name: 'Archivo', data: regular, weight: 400 as const, style: 'normal' as const },
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

  const frame = { width: '100%', height: '100%', background: PITCH, color: CHALK, fontFamily: 'Archivo', flexDirection: 'column', justifyContent: 'space-between' };
  let body: Node;

  if (profile) {
    const top = slicesFor(profile, lang)
      .filter((s) => s.percentile !== null)
      .sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0))
      .slice(0, 4);
    body = h(
      'div',
      { ...frame, padding: 64 },
      h(
        'div',
        { alignItems: 'center', gap: 40 },
        { type: 'img', props: { src: profile.photo, width: 180, height: 180, style: { borderRadius: 10, border: `2px solid ${LINE}` } } },
        h(
          'div',
          { flexDirection: 'column' },
          h('div', { fontSize: 30, color: FLOOD }, profile.position ? d.positions[profile.position] : ''),
          h('div', { fontSize: 112, fontFamily: 'Narrow', lineHeight: 1 }, profile.name),
          h('div', { fontSize: 30, color: DIM, marginTop: 8 }, `${profile.team?.name ?? ''}  /  ${profile.league?.name ?? ''} ${seasonLabel(profile.season, profile.leagueId)}`),
        ),
      ),
      h(
        'div',
        { flexDirection: 'column', gap: 14 },
        ...top.map((s) =>
          h(
            'div',
            { alignItems: 'center', gap: 20 },
            h('div', { width: 280, fontSize: 28, color: DIM }, s.label),
            h('div', { flex: 1, height: 18, background: LINE, borderRadius: 9 }, h('div', { width: `${s.percentile}%`, height: 18, borderRadius: 9, background: band(s.percentile ?? 0) })),
            h('div', { width: 70, justifyContent: 'flex-end', fontSize: 36, fontFamily: 'Narrow' }, String(s.percentile)),
          ),
        ),
      ),
      h('div', { justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 26, color: DIM }, h('div', { fontFamily: 'Narrow', fontSize: 44, color: CHALK }, 'AI Scout'), d.player.percentiles),
    );
  } else {
    body = h(
      'div',
      { ...frame, padding: 64 },
      h('div', { fontFamily: 'Narrow', fontSize: 44 }, 'AI Scout'),
      h('div', { fontFamily: 'Narrow', fontSize: 108, lineHeight: 0.95, whiteSpace: 'pre-wrap' }, d.landing.title),
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
