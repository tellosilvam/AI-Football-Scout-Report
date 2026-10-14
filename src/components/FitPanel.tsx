import { useState } from 'react';
import type { FitReport, TacticalStyle } from '../lib/ai/schema';
import type { Dict } from '../lib/i18n';

interface Props {
  playerId: number;
  season: number;
  lang: string;
  strings: Dict['fit'];
  errorText: string;
}

export default function FitPanel({ playerId, season, lang, strings, errorText }: Props) {
  const [style, setStyle] = useState<TacticalStyle | null>(null);
  const [state, setState] = useState<{ loading: boolean; data: FitReport | null; error: boolean }>({ loading: false, data: null, error: false });

  async function run(s: TacticalStyle) {
    setStyle(s);
    setState({ loading: true, data: null, error: false });
    try {
      const res = await fetch('/api/fit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerId, season, lang, style: s }),
      });
      if (!res.ok) throw new Error();
      setState({ loading: false, data: await res.json(), error: false });
    } catch {
      setState({ loading: false, data: null, error: true });
    }
  }

  return (
    <section aria-labelledby="fit-title">
      <h2 id="fit-title" className="section-title">
        {strings.title}
      </h2>
      <p className="mt-1 text-sm text-ink-faint">{strings.pick}</p>
      <div className="no-print mt-3 flex flex-wrap gap-1.5" role="group" aria-label={strings.pick}>
        {(Object.keys(strings.styles) as TacticalStyle[]).map((s) => (
          <button key={s} type="button" className="chip cursor-pointer" aria-pressed={style === s} onClick={() => run(s)} disabled={state.loading}>
            {strings.styles[s]}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-4">
        {state.loading && <div className="skeleton h-28" aria-hidden="true" />}
        {state.error && <p className="text-sm text-ink-soft">{errorText}</p>}
        {state.data && (
          <div>
            <div className="flex items-center gap-4">
              <Gauge value={state.data.score} />
              <p className="text-sm leading-relaxed">{state.data.summary}</p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <List title={strings.pros} items={state.data.pros} color="var(--hi)" />
              <List title={strings.cons} items={state.data.cons} color="var(--lo)" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Gauge({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" role="img" aria-label={`${value}/100`} className="shrink-0">
      <circle cx="34" cy="34" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
      <circle
        cx="34"
        cy="34"
        r={r}
        fill="none"
        stroke="var(--hi)"
        strokeWidth="6"
        strokeDasharray={`${(c * value) / 100} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 34 34)"
      />
      <text x="34" y="34" textAnchor="middle" dominantBaseline="central" className="display num" fontSize="22" fill="var(--ink)">
        {value}
      </text>
    </svg>
  );
}

function List({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />
        {title}
      </h3>
      <ul className="space-y-1 text-sm text-ink-soft">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
