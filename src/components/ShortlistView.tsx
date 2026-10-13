import { useEffect, useState } from 'react';
import { clearShortlist, onShortlistChange, readShortlist, removeFromShortlist, shortlistCsv, type ShortlistItem } from '../lib/client/shortlist';
import type { Dict } from '../lib/i18n';

interface Props {
  lang: string;
  strings: Dict['shortlist'];
  positions: Dict['positions'];
  removeLabel: string;
}

export default function ShortlistView({ lang, strings, positions, removeLabel }: Props) {
  const [items, setItems] = useState<ShortlistItem[] | null>(null);

  useEffect(() => {
    setItems(readShortlist());
    return onShortlistChange(() => setItems([...readShortlist()]));
  }, []);

  function exportCsv() {
    const blob = new Blob([shortlistCsv(items ?? [])], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ai-scout-shortlist.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (items === null) return <div className="skeleton h-40" aria-hidden="true" />;
  if (!items.length)
    return (
      <div className="py-6">
        <p className="text-chalk-dim">{strings.empty}</p>
        <a href={`/${lang}`} className="btn btn-primary mt-6">
          AI Scout
        </a>
      </div>
    );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={exportCsv}>
          {strings.exportCsv}
        </button>
        <button type="button" className="btn" onClick={() => clearShortlist()}>
          {strings.clear}
        </button>
        <span className="ml-auto text-sm text-chalk-faint">{strings.note}</span>
      </div>
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-3">
            <img src={i.photo} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 rounded bg-turf-2 object-cover" />
            <a href={`/${lang}/player/${i.slug}`} className="min-w-0 flex-1 hover:text-flood">
              <span className="block truncate font-semibold">{i.name}</span>
              <span className="block truncate text-sm text-chalk-faint">
                {[i.position ? positions[i.position as keyof typeof positions] : null, i.team, i.league].filter(Boolean).join(', ')}
              </span>
            </a>
            <button type="button" className="btn min-h-[36px] px-3 text-sm" onClick={() => removeFromShortlist(i.id)} aria-label={`${removeLabel}: ${i.name}`}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
