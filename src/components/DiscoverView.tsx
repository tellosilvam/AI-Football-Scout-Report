import { useEffect, useState } from 'react';
import { Filter, SearchX, Sparkles, TriangleAlert, X } from 'lucide-react';
import type { DiscoverInput } from '../lib/ai/tools';
import type { DiscoverHit } from '../lib/football/service';
import type { Dict } from '../lib/i18n';
import { slugOf } from './SearchBox';

interface Props {
  lang: string;
  strings: Dict['discover'];
  positions: Dict['positions'];
  metricLabels: Record<string, string>;
  leagues: { id: number; name: string }[];
  yearsLabel: string;
  errorText: string;
}

interface Result {
  filters: DiscoverInput;
  explanation: string | null;
  hits: DiscoverHit[];
  poolsSearched: number;
}

export default function DiscoverView({ lang, strings, positions, metricLabels, leagues, yearsLabel, errorText }: Props) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  // Shareable searches: /discover?q=...
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('q');
    if (q && q.trim().length >= 3) {
      setQuery(q);
      run({ query: q });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(body: { query?: string; filters?: DiscoverInput }) {
    if (body.query) history.replaceState(null, '', `?q=${encodeURIComponent(body.query)}`);
    setState('loading');
    try {
      const res = await fetch('/api/discover', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, lang }) });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Result;
      setResult((prev) => ({ ...data, explanation: data.explanation ?? prev?.explanation ?? null }));
      setState('idle');
    } catch {
      setState('error');
    }
  }

  /** Remove one interpreted filter and re-run without calling the model. */
  function drop(mutate: (f: DiscoverInput) => void) {
    if (!result) return;
    const next: DiscoverInput = structuredClone(result.filters);
    mutate(next);
    run({ filters: next });
  }

  const f = result?.filters;
  const leagueName = (id: number) => leagues.find((l) => l.id === id)?.name ?? String(id);

  return (
    <div>
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length >= 3) run({ query });
        }}
      >
        <label htmlFor="discover-q" className="sr-only">
          {strings.title}
        </label>
        <input id="discover-q" className="field min-h-[56px] text-lg" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={strings.placeholder} maxLength={300} />
        <button className="btn btn-primary min-h-[56px] px-6" type="submit" disabled={state === 'loading' || query.trim().length < 3}>
          <Sparkles size={18} aria-hidden="true" />
          {strings.run}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {strings.examples.map((ex) => (
          <button
            key={ex}
            type="button"
            className="chip cursor-pointer hover:text-ink"
            onClick={() => {
              setQuery(ex);
              run({ query: ex });
            }}
          >
            <Sparkles size={14} aria-hidden="true" />
            {ex}
          </button>
        ))}
      </div>

      <div className="mt-10" aria-live="polite" aria-busy={state === 'loading'}>
        {state === 'loading' && <div className="skeleton h-72" aria-hidden="true" />}
        {state === 'error' && (
          <p className="flex items-center gap-2 text-ink-soft">
            <TriangleAlert size={18} aria-hidden="true" />
            {errorText}
          </p>
        )}
        {state === 'idle' && result && f && (
          <>
            <div className="sheet p-4">
              <p className="flex items-center gap-1.5 text-sm text-ink-faint">
                <Filter size={15} aria-hidden="true" />
                {strings.interpreted}
              </p>
              {result.explanation && <p className="mt-1">{result.explanation}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {f.position && <FilterChip label={`${strings.filters.position}: ${positions[f.position]}`} onRemove={() => drop((x) => delete x.position)} />}
                {(f.minAge || f.maxAge) && (
                  <FilterChip
                    label={`${strings.filters.age}: ${f.minAge ?? ''}–${f.maxAge ?? ''}`}
                    onRemove={() =>
                      drop((x) => {
                        delete x.minAge;
                        delete x.maxAge;
                      })
                    }
                  />
                )}
                {f.excludeBig5 && <FilterChip label={strings.filters.excludeBig5} onRemove={() => drop((x) => delete x.excludeBig5)} />}
                {f.leagueIds?.map((id) => (
                  <FilterChip key={id} label={leagueName(id)} onRemove={() => drop((x) => (x.leagueIds = x.leagueIds?.filter((l) => l !== id)))} />
                ))}
                {f.minPercentiles?.map((m) => (
                  <FilterChip
                    key={m.metric}
                    label={`${metricLabels[m.metric] ?? m.metric} ≥ ${m.min}`}
                    onRemove={() => drop((x) => (x.minPercentiles = x.minPercentiles?.filter((p) => p.metric !== m.metric)))}
                  />
                ))}
              </div>
            </div>

            <p className="mt-6 text-sm text-ink-faint">
              {strings.results.replace('{n}', String(result.hits.length)).replace('{pools}', String(result.poolsSearched))}
            </p>
            {result.hits.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-ink-soft">
                <SearchX size={18} aria-hidden="true" />
                {strings.none}
              </p>
            ) : (
              <ol className="mt-3 divide-y divide-line border-y border-line">
                {result.hits.map((h, i) => {
                  const shown = (f.minPercentiles?.map((m) => m.metric) ?? Object.keys(h.percentiles)).slice(0, 4);
                  return (
                    <li key={h.player.id}>
                      <a href={`/${lang}/player/${slugOf(h.player)}`} className="grid grid-cols-[2rem_auto_1fr_auto] items-center gap-3 py-3 hover:underline">
                        <span className="num text-ink-faint">{i + 1}</span>
                        <img src={h.player.photo} alt="" width={44} height={44} loading="lazy" className="h-11 w-11 rounded bg-wash object-cover" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{h.player.name}</span>
                          <span className="block truncate text-sm text-ink-faint">
                            {[h.player.team?.name, h.player.league?.name, h.player.age ? `${h.player.age} ${yearsLabel}` : null].filter(Boolean).join(', ')}
                          </span>
                          <span className="mt-1 hidden flex-wrap gap-1 sm:flex">
                            {shown.map((k) => (
                              <span key={k} className="rounded bg-wash px-1.5 py-0.5 text-xs text-ink-soft">
                                {metricLabels[k] ?? k} {h.percentiles[k] ?? '—'}
                              </span>
                            ))}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="display num block text-3xl">{h.score}</span>
                          <span className="block text-[0.7rem] text-ink-faint">{strings.score}</span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="chip" aria-pressed="true">
      {label}
      <button type="button" onClick={onRemove} className="-mr-1 ml-0.5 rounded px-1 opacity-70 hover:opacity-100" aria-label={`Remove ${label}`}>
        <X size={14} aria-hidden="true" />
      </button>
    </span>
  );
}
