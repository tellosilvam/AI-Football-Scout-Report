// Browser-only shortlist. Every storage access is guarded: private mode / blocked storage just means an in-memory list.

export interface ShortlistItem {
  id: number;
  slug: string;
  name: string;
  photo: string;
  position: string | null;
  team: string | null;
  league: string | null;
  age: number | null;
  addedAt: string;
}

const KEY = 'aiscout-shortlist';
let memory: ShortlistItem[] = [];
const listeners = new Set<() => void>();

export function readShortlist(): ShortlistItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw) as ShortlistItem[];
  } catch {
    /* use memory */
  }
  return memory;
}

function write(items: ShortlistItem[]) {
  memory = items;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* memory only */
  }
  listeners.forEach((l) => l());
}

export const inShortlist = (id: number) => readShortlist().some((i) => i.id === id);
export const addToShortlist = (item: Omit<ShortlistItem, 'addedAt'>) =>
  write([{ ...item, addedAt: new Date().toISOString() }, ...readShortlist().filter((i) => i.id !== item.id)]);
export const removeFromShortlist = (id: number) => write(readShortlist().filter((i) => i.id !== id));
export const clearShortlist = () => write([]);

export function onShortlistChange(fn: () => void) {
  listeners.add(fn);
  const storage = (e: StorageEvent) => e.key === KEY && fn();
  window.addEventListener('storage', storage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', storage);
  };
}

export function shortlistCsv(items: ShortlistItem[]) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['name', 'position', 'age', 'team', 'league', 'url', 'added_at']];
  for (const i of items) rows.push([i.name, i.position ?? '', String(i.age ?? ''), i.team ?? '', i.league ?? '', `${location.origin}/en/player/${i.slug}`, i.addedAt]);
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}
