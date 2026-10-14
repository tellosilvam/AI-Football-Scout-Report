import { useEffect, useState } from 'react';
import { ArrowLeftRight, Bookmark, BookmarkCheck, Check, Link2, Printer } from 'lucide-react';
import { addToShortlist, inShortlist, onShortlistChange, removeFromShortlist, type ShortlistItem } from '../lib/client/shortlist';

interface Props {
  item: Omit<ShortlistItem, 'addedAt'>;
  compareHref: string;
  /** Smaller buttons for the dossier's section bar. */
  compact?: boolean;
  strings: { shortlistAdd: string; shortlistRemove: string; compareWith: string; share: string; copied: string; exportPdf: string };
}

export default function PlayerActions({ item, compareHref, strings, compact }: Props) {
  const size = compact ? 'min-h-[40px] px-3 text-sm' : '';
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
        className={`btn ${size} ${saved ? 'border-ink bg-ink text-canvas' : ''}`}
        aria-pressed={saved}
        onClick={() => (saved ? removeFromShortlist(item.id) : addToShortlist(item))}
      >
        {saved ? <BookmarkCheck size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}
        {saved ? strings.shortlistRemove : strings.shortlistAdd}
      </button>
      <a className={`btn ${size}`} href={compareHref}>
        <ArrowLeftRight size={16} aria-hidden="true" />
        {strings.compareWith}
      </a>
      <button type="button" className={`btn ${size}`} onClick={share} aria-live="polite">
        {copied ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
        {copied ? strings.copied : strings.share}
      </button>
      <button type="button" className={`btn ${size}`} onClick={() => window.print()}>
        <Printer size={16} aria-hidden="true" />
        {strings.exportPdf}
      </button>
    </div>
  );
}
