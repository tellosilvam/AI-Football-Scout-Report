import { useEffect, useState } from 'react';
import { ArrowLeftRight, Info, Plus, TriangleAlert, Trophy, UserRound } from 'lucide-react';
import type { CompareVerdict } from '../lib/ai/schema';
import type { PlayerProfile, PlayerSummary } from '../lib/football/types';
import type { Dict } from '../lib/i18n';
import { bandColor } from './PizzaChart';
import SearchBox, { slugOf, type SearchStrings } from './SearchBox';

interface Props {
  lang: string;
  initialA: number | null;
  initialB: number | null;
  strings: Dict['compare'];
  search: SearchStrings;
  metricLabels: Record<string, string>;
  categoryOf: Record<string, string>;
  errorText: string;
}

type Data = { a: PlayerProfile; b: PlayerProfile; verdict: CompareVerdict | null };

export default function CompareView({ lang, initialA, initialB, strings, search, metricLabels, categoryOf, errorText }: Props) {
  const [a, setA] = useState<number | null>(initialA);
  const [b, setB] = useState<number | null>(initialB);
  const [data, setData] = useState<Data | null>(null);
  const [preview, setPreview] = useState<{ a?: PlayerSummary; b?: PlayerSummary }>({});
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    const qs = new URLSearchParams();
    if (a) qs.set('a', String(a));
    if (b) qs.set('b', String(b));
    history.replaceState(null, '', `?${qs}`);
    if (!a || !b || a === b) return;
    setState('loading');
    setData(null);
    fetch('/api/compare', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a, b, lang }) })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Data) => {
        setData(d);
        setState('idle');
      })
      .catch(() => setState('error'));
  }, [a, b, lang]);

  const keys = data ? [...new Set([...data.a.percentiles.map((m) => m.key), ...data.b.percentiles.map((m) => m.key)])] : [];
  const pct = (p: PlayerProfile, k: string) => p.percentiles.find((m) => m.key === k)?.percentile ?? null;
  const val = (p: PlayerProfile, k: string) => p.percentiles.find((m) => m.key === k)?.value ?? null;

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <Picker label={strings.pickA} player={data?.a ?? preview.a} search={search} lang={lang} onPick={(p) => (setPreview((x) => ({ ...x, a: p })), setA(p.id))} />
        <Picker label={strings.pickB} player={data?.b ?? preview.b} search={search} lang={lang} onPick={(p) => (setPreview((x) => ({ ...x, b: p })), setB(p.id))} />
      </div>

      <div aria-live="polite" className="mt-8">
        {(!a || !b) && (
          <p className="flex items-center gap-2 text-ink-soft">
            <ArrowLeftRight size={18} aria-hidden="true" />
            {strings.empty}
          </p>
        )}
        {state === 'loading' && <div className="skeleton h-96" aria-hidden="true" />}
        {state === 'error' && (
          <p className="flex items-center gap-2 text-ink-soft">
            <TriangleAlert size={18} aria-hidden="true" />
            {errorText}
          </p>
        )}
        {data && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <section className="sheet overflow-x-auto p-5 md:p-6" aria-label={strings.metric}>
              {data.a.leagueId !== data.b.leagueId && (
                <p className="mb-4 flex items-center gap-2 text-sm text-ink-faint">
                  <Info size={16} aria-hidden="true" />
                  {strings.differentLeagues}
                </p>
              )}
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-line text-ink-faint">
                    <th className="w-[38%] py-2 text-right font-medium">{data.a.name}</th>
                    <th className="px-3 py-2 font-medium">{strings.metric}</th>
                    <th className="w-[38%] py-2 text-left font-medium">{data.b.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => {
                    const pa = pct(data.a, k);
                    const pb = pct(data.b, k);
                    return (
                      <tr key={k} className="border-b border-line/60">
                        <td className="py-2">
                          <Bar value={pa} raw={val(data.a, k)} unit={k.endsWith('_pct') ? 'pct' : 'p90'} align="right" win={pa !== null && pb !== null && pa > pb} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="block whitespace-nowrap">{metricLabels[k] ?? k}</span>
                          <span className="block text-[0.7rem] text-ink-faint">{categoryOf[k]}</span>
                        </td>
                        <td className="py-2">
                          <Bar value={pb} raw={val(data.b, k)} unit={k.endsWith('_pct') ? 'pct' : 'p90'} align="left" win={pa !== null && pb !== null && pb > pa} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            {data.verdict && (
              <section className="sheet p-5 md:p-6" aria-labelledby="verdict-title">
                <h2 id="verdict-title" className="text-lg font-bold">
                  <span className="inline-flex items-center gap-2">
                    <Trophy size={18} aria-hidden="true" />
                    {strings.verdict}
                  </span>
                </h2>
                <p className="display mt-3 text-4xl">
                  {data.verdict.winner === 'a' ? data.a.name : data.verdict.winner === 'b' ? data.b.name : strings.depends}
                </p>
                <p className="mt-3 leading-relaxed">{data.verdict.verdict}</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <Edges title={`${strings.edge}: ${data.a.name}`} items={data.verdict.edgesA} />
                  <Edges title={`${strings.edge}: ${data.b.name}`} items={data.verdict.edgesB} />
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Picker({
  label,
  player,
  search,
  lang,
  onPick,
}: {
  label: string;
  player?: PlayerSummary | PlayerProfile;
  search: SearchStrings;
  lang: string;
  onPick: (p: PlayerSummary) => void;
}) {
  return (
    <div className="sheet p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm text-ink-faint">
        <UserRound size={15} aria-hidden="true" />
        {label}
      </p>
      {player && (
        <a href={`/${lang}/player/${slugOf(player)}`} className="mb-3 flex items-center gap-3 hover:underline">
          <img src={player.photo} alt="" width={48} height={48} className="h-12 w-12 rounded bg-wash object-cover" />
          <span>
            <span className="display block text-3xl">{player.name}</span>
            <span className="block text-sm text-ink-faint">{[player.team?.name, player.league?.name].filter(Boolean).join(', ')}</span>
          </span>
        </a>
      )}
      <SearchBox lang={lang} strings={search} onPick={onPick} />
    </div>
  );
}

function Bar({ value, raw, unit, align, win }: { value: number | null; raw: number | null; unit: string; align: 'left' | 'right'; win: boolean }) {
  return (
    <span className={`flex items-center gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
      <span className={`flex h-2.5 flex-1 overflow-hidden rounded-full bg-wash ${align === 'right' ? 'justify-end' : ''}`}>
        <span className="block h-full rounded-full" style={{ width: `${value ?? 0}%`, background: bandColor(value) }} />
      </span>
      <span className={`num w-14 shrink-0 ${align === 'right' ? 'text-right' : ''} ${win ? 'font-bold text-ink' : 'text-ink-soft'}`}>
        {value ?? '—'}
        <span className="block text-[0.7rem] font-normal text-ink-faint">{raw ?? ''}{raw !== null && unit === 'pct' ? '%' : ''}</span>
      </span>
    </span>
  );
}

function Edges({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink-faint">
        <Plus size={15} aria-hidden="true" />
        {title}
      </h3>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
