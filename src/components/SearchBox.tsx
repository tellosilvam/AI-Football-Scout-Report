import { useEffect, useId, useRef, useState } from 'react';
import { slugify } from '../lib/football/normalize';
import type { PlayerSummary } from '../lib/football/types';

export interface SearchStrings {
  placeholder: string;
  label: string;
  empty: string;
  min: string;
  loading: string;
  error: string;
  positions: Record<string, string>;
}

interface Props {
  lang: string;
  strings: SearchStrings;
  /** When set, picking a player calls this instead of navigating to the dossier. */
  onPick?: (p: PlayerSummary) => void;
  size?: 'lg' | 'md';
  autoFocus?: boolean;
}

export const slugOf = (p: { name: string; id: number }) => slugify(p.name, p.id);

/** Accessible combobox (WAI-ARIA 1.2 pattern) with debounced live search. */
export default function SearchBox({ lang, strings, onPick, size = 'md', autoFocus }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlayerSummary[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setResults([]);
      setState('idle');
      return;
    }
    setState('loading');
    const timer = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { results: PlayerSummary[] };
        setResults(data.results);
        setActive(data.results.length ? 0 : -1);
        setState('done');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setState('error');
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [q]);

  function pick(p: PlayerSummary) {
    setOpen(false);
    if (onPick) {
      onPick(p);
      setQ('');
      return;
    }
    window.location.href = `/${lang}/player/${slugOf(p)}`;
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && active >= 0 && results[active]) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && q.trim().length > 0;
  const big = size === 'lg';

  return (
    <div className="relative w-full">
      <label htmlFor={`${listId}-input`} className="sr-only">
        {strings.label}
      </label>
      <div className="relative">
        <svg
          className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-chalk-faint ${big ? 'h-6 w-6' : 'h-5 w-5'}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          className={`field ${big ? 'min-h-[64px] pl-14 text-xl' : 'pl-11'}`}
          placeholder={strings.placeholder}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
        />
      </div>
      {showList && (
        <div className="sheet absolute left-0 right-0 z-40 mt-2 max-h-[min(70vh,440px)] overflow-y-auto p-1 shadow-2xl shadow-black/40">
          {q.trim().length < 3 && <p className="px-3 py-3 text-sm text-chalk-faint">{strings.min}</p>}
          {state === 'loading' && <p className="px-3 py-3 text-sm text-chalk-faint">{strings.loading}</p>}
          {state === 'error' && <p className="px-3 py-3 text-sm text-card">{strings.error}</p>}
          {state === 'done' && results.length === 0 && <p className="px-3 py-3 text-sm text-chalk-dim">{strings.empty}</p>}
          <ul id={listId} role="listbox" aria-label={strings.label}>
            {results.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 rounded px-3 py-2 ${i === active ? 'bg-turf-2' : ''}`}
              >
                <img src={p.photo} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 rounded bg-turf-2 object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block truncate text-sm text-chalk-faint">
                    {[p.position ? strings.positions[p.position] : null, p.team?.name, p.league?.name].filter(Boolean).join(', ') ||
                      p.nationality}
                  </span>
                </span>
                {p.team?.logo && <img src={p.team.logo} alt="" width={22} height={22} loading="lazy" className="h-[22px] w-[22px] object-contain" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
