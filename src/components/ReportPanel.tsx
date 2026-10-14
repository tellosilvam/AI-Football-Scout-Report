import { useEffect, useRef, useState } from 'react';
import { RefreshCw, ShieldCheck, Sparkles, Target, TrendingDown, TrendingUp, TriangleAlert, Users } from 'lucide-react';
import { PERSONA_ICON } from './icons';
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
      window.dispatchEvent(new CustomEvent('aiscout:report', { detail: { overall: data.report.overallRating, role: data.report.idealRole } }));
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
    <div aria-busy={state.kind === 'loading'}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="report-title" className="section-title">
          {strings.title}
        </h2>
        <div className="no-print flex flex-wrap gap-1.5" role="group" aria-label={strings.persona}>
          {(Object.keys(strings.personas) as Persona[]).map((p) => (
            <button key={p} type="button" className="chip cursor-pointer" aria-pressed={persona === p} onClick={() => choosePersona(p)}>
              {(() => {
                const Icon = PERSONA_ICON[p];
                return Icon ? <Icon size={15} aria-hidden="true" /> : null;
              })()}
              {strings.personas[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8" aria-live="polite">
        {state.kind === 'checking' && <ReportSkeleton />}
        {state.kind === 'empty' && (
          <div className="flex flex-col items-start gap-3 rounded-[var(--radius)] border border-dashed border-line px-6 py-10">
            <button type="button" className="btn btn-primary min-h-[52px] px-6 text-base" onClick={() => load()}>
              <Sparkles size={18} aria-hidden="true" />
              {strings.generate}
            </button>
          </div>
        )}
        {state.kind === 'loading' && (
          <div>
            <p className="mb-4 text-ink-soft">{strings.generating}</p>
            <ReportSkeleton />
          </div>
        )}
        {state.kind === 'error' && (
          <div className="flex flex-col items-start gap-3 py-4">
            <p className="flex items-center gap-2 text-ink-soft">
              <TriangleAlert size={18} aria-hidden="true" />
              {state.message}
            </p>
            <button type="button" className="btn" onClick={() => load()}>
              {strings.generate}
            </button>
          </div>
        )}
        {state.kind === 'ready' && <ReportBody data={state.data} strings={strings} metricLabels={metricLabels} onRegenerate={() => load({ regenerate: true })} playerName={playerName} />}
      </div>
    </div>
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
      <p className="flex items-center gap-2 text-ink-soft">
        <Target size={17} aria-hidden="true" />
        {strings.role}: <span className="font-semibold text-ink">{r.idealRole}</span>
      </p>
      <p className="mt-3 max-w-[30ch] text-[clamp(1.6rem,3.2vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.015em] sm:max-w-[38ch]">{r.headline}</p>

      <div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-12">
        <TraitList title={strings.strengths} items={r.strengths} tone="good" metricLabels={metricLabels} />
        <TraitList title={strings.weaknesses} items={r.weaknesses} tone="bad" metricLabels={metricLabels} />
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-12">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-ink-faint">{strings.profile}</h3>
            <p className="prose-measure mt-1.5 text-[1.05rem]">{r.tacticalProfile}</p>
          </div>
          <div className="rounded-[var(--radius)] bg-canvas px-5 py-4">
            <h3 className="text-sm font-semibold text-ink-faint">{strings.verdict}</h3>
            <p className="prose-measure mt-1.5 text-[1.1rem]">{r.verdict}</p>
          </div>
        </div>
        <div className="space-y-5">
          {r.comparablePlayers.length > 0 && (
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-faint">
                <Users size={15} aria-hidden="true" />
                {strings.comparables}
              </h3>
              <p className="mt-1.5 text-[1.05rem]">{r.comparablePlayers.join(', ')}</p>
            </div>
          )}
          <div className="space-y-1 text-sm text-ink-soft">
            <p className="flex items-center gap-2">
              {data.guard.ok ? (
                <>
                  <CheckIcon /> {strings.verified}
                </>
              ) : (
                strings.unverified.replace('{items}', problems.join(', '))
              )}
            </p>
            <p className="text-ink-faint">
              {strings.confidence}: {strings.confidenceLevels[r.confidence]}. {strings.model}: {data.model.split('/').pop()}
              {data.cached ? `, ${strings.cached.toLowerCase()}` : ''}
            </p>
          </div>
          <button type="button" className="btn no-print min-h-[40px] px-4 text-sm" onClick={onRegenerate}>
            <RefreshCw size={15} aria-hidden="true" />
            {strings.regenerate}
          </button>
        </div>
      </div>
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
      <h3 className="flex items-center gap-2.5 text-xl font-bold">
        {tone === 'good' ? (
          <TrendingUp size={22} style={{ color: 'var(--good)' }} aria-hidden="true" />
        ) : (
          <TrendingDown size={22} style={{ color: 'var(--bad)' }} aria-hidden="true" />
        )}
        {title}
      </h3>
      <ul className="mt-3">
        {items.map((it) => (
          <li key={it.title} className="border-t border-line py-4">
            <p className="text-[1.1rem] font-semibold">{it.title}</p>
            <ul className="mt-1.5 space-y-1.5">
              {it.evidence.map((e) => (
                <li key={e.metric + e.note} className="text-ink-soft">
                  <span className="mr-2 rounded-md bg-wash px-2 py-0.5 text-[0.82rem] font-medium text-ink">{metricLabels[e.metric] ?? e.metric}</span>
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
    <div className="space-y-4" aria-hidden="true">
      <div className="skeleton h-24 w-full max-w-3xl" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="skeleton h-40" />
        <div className="skeleton h-40" />
      </div>
    </div>
  );
}

function CheckIcon() {
  return <ShieldCheck size={17} style={{ color: 'var(--good)' }} aria-hidden="true" />;
}
