import { useEffect, useState } from 'react';
import { Bookmark, Download, Info, Trash2, X } from 'lucide-react';
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
        <p className="flex items-center gap-2 text-ink-soft">
          <Bookmark size={18} aria-hidden="true" />
          {strings.empty}
        </p>
        <a href={`/${lang}`} className="btn btn-primary mt-6">
          AI Scout
        </a>
      </div>
    );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={exportCsv}>
          <Download size={16} aria-hidden="true" />
          {strings.exportCsv}
        </button>
        <button type="button" className="btn" onClick={() => clearShortlist()}>
          <Trash2 size={16} aria-hidden="true" />
          {strings.clear}
        </button>
        <span className="ml-auto flex items-center gap-1.5 text-sm text-ink-faint">
          <Info size={15} aria-hidden="true" />
          {strings.note}
        </span>
      </div>
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-3">
            <img src={i.photo} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 rounded bg-wash object-cover" />
            <a href={`/${lang}/player/${i.slug}`} className="min-w-0 flex-1 hover:underline">
              <span className="block truncate font-semibold">{i.name}</span>
              <span className="block truncate text-sm text-ink-faint">
                {[i.position ? positions[i.position as keyof typeof positions] : null, i.team, i.league].filter(Boolean).join(', ')}
              </span>
            </a>
            <button type="button" className="btn min-h-[36px] px-3 text-sm" onClick={() => removeFromShortlist(i.id)} aria-label={`${removeLabel}: ${i.name}`}>
              <X size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
