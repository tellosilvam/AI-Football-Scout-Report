import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dict } from '../lib/i18n';
import Markdown from './Markdown';

interface Props {
  playerId: number;
  season: number;
  lang: string;
  playerName: string;
  strings: Dict['chat'];
}

function persona() {
  try {
    return localStorage.getItem('aiscout-persona') ?? 'analyst';
  } catch {
    return 'analyst';
  }
}

export default function ScoutChat({ playerId, season, lang, playerName, strings }: Props) {
  const [input, setInput] = useState('');
  const [limitHit, setLimitHit] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: () => ({ playerId, season, lang, persona: persona() }),
        fetch: async (url, init) => {
          const res = await fetch(url, init);
          setLimitHit(res.status === 429);
          return res;
        },
      }),
    [playerId, season, lang],
  );

  const { messages, sendMessage, status, error } = useChat({ transport });
  const busy = status === 'submitted' || status === 'streaming';
  const fill = (s: string) => s.replaceAll('{name}', playerName);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    sendMessage({ text: q });
    setInput('');
  }

  return (
    <section aria-labelledby="chat-title" className="sheet no-print flex flex-col">
      <div className="border-b border-line px-5 py-4 md:px-7">
        <h2 id="chat-title" className="text-xl font-bold">
          {strings.title}
        </h2>
      </div>

      <div ref={scroller} className="max-h-[560px] min-h-[240px] flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-7" aria-live="polite">
        <Bubble role="assistant">
          <p>{fill(strings.intro)}</p>
        </Bubble>

        {messages.map((m) => (
          <Bubble key={m.id} role={m.role}>
            {m.parts.map((part, i) => {
              if (part.type === 'text') return m.role === 'user' ? <p key={i}>{part.text}</p> : <Markdown key={i} text={part.text} />;
              if (part.type.startsWith('tool-')) {
                const name = part.type.slice(5) as keyof Dict['chat']['tools'];
                const done = 'state' in part && part.state === 'output-available';
                return (
                  <span key={i} className="chip mb-2 mr-1.5 text-xs">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${done ? 'bg-flood' : 'animate-pulse bg-chalk-faint'}`}
                      aria-hidden="true"
                    />
                    {strings.tools[name] ?? name}
                  </span>
                );
              }
              return null;
            })}
          </Bubble>
        ))}

        {status === 'submitted' && (
          <Bubble role="assistant">
            <p className="text-chalk-faint">{strings.thinking}</p>
          </Bubble>
        )}
        {error && <p className="text-sm text-card">{limitHit ? strings.limit : strings.error}</p>}
      </div>

      {messages.length < 2 && (
        <div className="flex flex-wrap gap-2 px-5 pb-4 md:px-7">
          {strings.suggestions.map((s) => (
            <button key={s} type="button" className="chip cursor-pointer whitespace-normal text-left hover:text-chalk" onClick={() => ask(fill(s))} disabled={busy}>
              {fill(s)}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2 border-t border-line p-3 md:p-4"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          {strings.placeholder}
        </label>
        <input
          id="chat-input"
          className="field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={strings.placeholder}
          maxLength={500}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary shrink-0" disabled={busy || !input.trim()}>
          {strings.send}
        </button>
      </form>
    </section>
  );
}

function Bubble({ role, children }: { role: string; children: React.ReactNode }) {
  const user = role === 'user';
  return (
    <div className={`flex ${user ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] rounded-lg px-4 py-3 leading-relaxed ${user ? 'bg-turf-2' : 'border border-line'}`}>{children}</div>
    </div>
  );
}
