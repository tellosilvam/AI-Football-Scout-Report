import { useEffect, useState } from 'react';
import { addToShortlist, inShortlist, onShortlistChange, removeFromShortlist, type ShortlistItem } from '../lib/client/shortlist';

interface Props {
  item: Omit<ShortlistItem, 'addedAt'>;
  compareHref: string;
  strings: { shortlistAdd: string; shortlistRemove: string; compareWith: string; share: string; copied: string; exportPdf: string };
}

export default function PlayerActions({ item, compareHref, strings }: Props) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSaved(inShortlist(item.id));
    return onShortlistChange(() => setSaved(inShortlist(item.id)));
  }, [item.id]);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: item.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="no-print flex flex-wrap gap-2">
      <button
        type="button"
        className={`btn ${saved ? 'border-flood text-flood' : ''}`}
        aria-pressed={saved}
        onClick={() => (saved ? removeFromShortlist(item.id) : addToShortlist(item))}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 3h12v18l-6-4-6 4z" />
        </svg>
        {saved ? strings.shortlistRemove : strings.shortlistAdd}
      </button>
      <a className="btn" href={compareHref}>
        {strings.compareWith}
      </a>
      <button type="button" className="btn" onClick={share} aria-live="polite">
        {copied ? strings.copied : strings.share}
      </button>
      <button type="button" className="btn" onClick={() => window.print()}>
        {strings.exportPdf}
      </button>
    </div>
  );
}
