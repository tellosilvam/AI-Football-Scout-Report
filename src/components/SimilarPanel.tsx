import { useEffect, useState } from 'react';
import type { Dict } from '../lib/i18n';
import { slugOf } from './SearchBox';

interface Hit {
  id: number;
  name: string;
  photo: string;
  age: number | null;
  team: { name: string; logo: string } | null;
  league: { name: string } | null;
  similarity: number;
}

interface Props {
  playerId: number;
  season: number;
  lang: string;
  strings: Dict['similar'];
  yearsLabel: string;
}

export default function SimilarPanel({ playerId, season, lang, strings, yearsLabel }: Props) {
  const [maxAge, setMaxAge] = useState<number | null>(null);
  const [outside, setOutside] = useState(false);
  const [hits, setHits] = useState<Hit[] | null>(null);

  useEffect(() => {
    let alive = true;
    setHits(null);
    const qs = new URLSearchParams({ id: String(playerId), season: String(season) });
    if (maxAge) qs.set('maxAge', String(maxAge));
    if (outside) qs.set('excludeBig5', '1');
    fetch(`/api/similar?${qs}`)
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => alive && setHits(d.results))
      .catch(() => alive && setHits([]));
    return () => {
      alive = false;
    };
  }, [playerId, season, maxAge, outside]);

  return (
    <section aria-labelledby="similar-title" className="sheet p-5 md:p-6">
      <h2 id="similar-title" className="text-lg font-bold">
        {strings.title}
      </h2>
      <p className="mt-1 text-sm text-chalk-faint">{strings.subtitle}</p>
      <div className="no-print mt-3 flex flex-wrap gap-1.5">
        {[23, 26].map((a) => (
          <button key={a} type="button" className="chip cursor-pointer" aria-pressed={maxAge === a} onClick={() => setMaxAge(maxAge === a ? null : a)}>
            {strings.maxAge} {a}
          </button>
        ))}
        <button type="button" className="chip cursor-pointer" aria-pressed={outside} onClick={() => setOutside((v) => !v)}>
          {strings.outsideBig5}
        </button>
      </div>

      <div className="mt-4" aria-live="polite">
        {hits === null && (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-12" />
            ))}
          </div>
        )}
        {hits?.length === 0 && <p className="text-sm text-chalk-dim">{strings.none}</p>}
        {hits && hits.length > 0 && (
          <ol className="divide-y divide-line">
            {hits.map((h) => (
              <li key={h.id}>
                <a href={`/${lang}/player/${slugOf(h)}`} className="flex items-center gap-3 py-2.5 hover:text-flood">
                  <img src={h.photo} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 rounded bg-turf-2 object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{h.name}</span>
                    <span className="block truncate text-xs text-chalk-faint">
                      {[h.team?.name, h.league?.name, h.age ? `${h.age} ${yearsLabel}` : null].filter(Boolean).join(', ')}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="num block font-semibold">{h.similarity}</span>
                    <span className="block text-[0.7rem] text-chalk-faint">{strings.match}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
