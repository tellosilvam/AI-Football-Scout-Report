import { useEffect, useRef, useState } from 'react';
import type { StoredReport } from '../lib/ai/report';
import type { Persona } from '../lib/ai/schema';
import type { Dict } from '../lib/i18n';

interface Props {
  playerId: number;
  season: number;
  lang: string;
  playerName: string;
  metricLabels: Record<string, string>;
  strings: Dict['report'];
}

type State =
  | { kind: 'checking' }
  | { kind: 'empty' }
  | { kind: 'loading' }
  | { kind: 'ready'; data: StoredReport & { cached: boolean } }
  | { kind: 'error'; message: string };

const PERSONA_KEY = 'aiscout-persona';

function storedPersona(): Persona {
  try {
    const v = localStorage.getItem(PERSONA_KEY);
    if (v === 'analyst' || v === 'veteran' || v === 'coach') return v;
  } catch {
    /* default */
  }
  return 'analyst';
}

export default function ReportPanel({ playerId, season, lang, playerName, metricLabels, strings }: Props) {
  const [persona, setPersona] = useState<Persona>('analyst');
  const [state, setState] = useState<State>({ kind: 'checking' });
  const latest = useRef(0);

  useEffect(() => setPersona(storedPersona()), []);

  async function load(opts: { cachedOnly?: boolean; regenerate?: boolean } = {}, p: Persona = persona) {
    const req = ++latest.current;
    const set = (s: State) => req === latest.current && setState(s);
    set(opts.cachedOnly ? { kind: 'checking' } : { kind: 'loading' });
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerId, season, lang, persona: p, ...opts }),
      });
      if (res.status === 429) return set({ kind: 'error', message: strings.limit });
      if (!res.ok) return set({ kind: 'error', message: strings.error });
      const data = await res.json();
      if (!data.report) return set({ kind: 'empty' });
      set({ kind: 'ready', data });
      window.dispatchEvent(new CustomEvent('aiscout:report', { detail: { overall: data.report.overallRating } }));
    } catch {
      set({ kind: 'error', message: strings.error });
    }
  }

  // Show a cached report immediately if one exists (free, no model call).
  useEffect(() => {
    load({ cachedOnly: true }, persona);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona]);

  function choosePersona(p: Persona) {
    setPersona(p);
    try {
      localStorage.setItem(PERSONA_KEY, p);
    } catch {
      /* ignore */
    }
  }

  return (
    <section aria-labelledby="report-title" aria-busy={state.kind === 'loading'} className="sheet p-5 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="report-title" className="text-xl font-bold">
          {strings.title}
        </h2>
        <div className="no-print flex flex-wrap gap-1.5" role="group" aria-label={strings.persona}>
          {(Object.keys(strings.personas) as Persona[]).map((p) => (
            <button key={p} type="button" className="chip cursor-pointer" aria-pressed={persona === p} onClick={() => choosePersona(p)}>
              {strings.personas[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5" aria-live="polite">
        {state.kind === 'checking' && <ReportSkeleton />}
        {state.kind === 'empty' && (
          <div className="flex flex-col items-start gap-3 py-6">
            <button type="button" className="btn btn-primary" onClick={() => load()}>
              {strings.generate}
            </button>
          </div>
        )}
        {state.kind === 'loading' && (
          <div>
            <p className="mb-4 text-chalk-dim">{strings.generating}</p>
            <ReportSkeleton />
          </div>
        )}
        {state.kind === 'error' && (
          <div className="flex flex-col items-start gap-3 py-4">
            <p className="text-chalk-dim">{state.message}</p>
            <button type="button" className="btn" onClick={() => load()}>
              {strings.generate}
            </button>
          </div>
        )}
        {state.kind === 'ready' && <ReportBody data={state.data} strings={strings} metricLabels={metricLabels} onRegenerate={() => load({ regenerate: true })} playerName={playerName} />}
      </div>
    </section>
  );
}

function ReportBody({
  data,
  strings,
  metricLabels,
  onRegenerate,
  playerName,
}: {
  data: StoredReport & { cached: boolean };
  strings: Dict['report'];
  metricLabels: Record<string, string>;
  onRegenerate: () => void;
  playerName: string;
}) {
  const r = data.report;
  const problems = [...data.guard.unknownNumbers, ...data.guard.unknownMetrics];
  return (
    <article aria-label={`${strings.title}: ${playerName}`}>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2 border-b border-line pb-5">
        <div className="row-span-2 flex h-[88px] w-[88px] flex-col items-center justify-center rounded-md border-2 border-flood">
          <span className="display num text-[2.9rem] leading-none text-chalk">{r.overallRating}</span>
          <span className="text-[0.7rem] text-chalk-faint">{strings.overall}</span>
        </div>
        <p className="text-sm text-chalk-faint">
          {strings.role}: <span className="font-semibold text-chalk">{r.idealRole}</span>
        </p>
        <p className="text-lg font-semibold leading-snug">{r.headline}</p>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <TraitList title={strings.strengths} items={r.strengths} tone="good" metricLabels={metricLabels} />
        <TraitList title={strings.weaknesses} items={r.weaknesses} tone="bad" metricLabels={metricLabels} />
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-chalk-faint">{strings.profile}</h3>
          <p className="prose-measure mt-1">{r.tacticalProfile}</p>
        </div>
        {r.comparablePlayers.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-chalk-faint">{strings.comparables}</h3>
            <p className="mt-1 flex flex-wrap gap-1.5">
              {r.comparablePlayers.map((p) => (
                <span key={p} className="chip">
                  {p}
                </span>
              ))}
            </p>
          </div>
        )}
        <div className="rounded-md border-l-4 border-flood bg-turf-2 px-4 py-3">
          <h3 className="text-sm font-semibold text-chalk-faint">{strings.verdict}</h3>
          <p className="prose-measure mt-1">{r.verdict}</p>
        </div>
      </div>

      <footer className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-sm text-chalk-faint">
        <span>
          {strings.confidence}: <strong className="text-chalk">{strings.confidenceLevels[r.confidence]}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          {data.guard.ok ? (
            <>
              <CheckIcon /> {strings.verified}
            </>
          ) : (
            strings.unverified.replace('{items}', problems.join(', '))
          )}
        </span>
        <span>
          {strings.model}: {data.model.split('/').pop()}
          {data.cached ? `, ${strings.cached.toLowerCase()}` : ''}
        </span>
        <button type="button" className="btn no-print ml-auto min-h-[36px] px-3 text-sm" onClick={onRegenerate}>
          {strings.regenerate}
        </button>
      </footer>
    </article>
  );
}

function TraitList({
  title,
  items,
  tone,
  metricLabels,
}: {
  title: string;
  items: { title: string; evidence: { metric: string; note: string }[] }[];
  tone: 'good' | 'bad';
  metricLabels: Record<string, string>;
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 font-semibold">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: tone === 'good' ? 'var(--flood)' : 'var(--card)' }} aria-hidden="true" />
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.title}>
            <p className="font-medium">{it.title}</p>
            <ul className="mt-1 space-y-1">
              {it.evidence.map((e) => (
                <li key={e.metric + e.note} className="text-sm text-chalk-dim">
                  <span className="mr-1.5 rounded bg-turf-2 px-1.5 py-0.5 text-xs text-chalk">{metricLabels[e.metric] ?? e.metric}</span>
                  {e.note}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="skeleton h-20 w-full" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
      </div>
      <div className="skeleton h-16 w-full" />
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--flood)" strokeWidth="2.5" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
