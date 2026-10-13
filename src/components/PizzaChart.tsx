import { useEffect, useState } from 'react';

export interface PizzaSlice {
  key: string;
  label: string;
  category: string;
  categoryLabel: string;
  value: number | null;
  percentile: number | null;
  unit: string;
}

interface Props {
  slices: PizzaSlice[];
  title: string;
  /** Text inside the hole, e.g. overall AI grade or minutes. */
  centerValue?: string;
  centerLabel?: string;
  per90Label: string;
}

const SIZE = 640;
const C = SIZE / 2;
const R0 = 44; // hole
const R1 = 222; // 100th percentile
const RING_LABEL = 248;

/** Percentile band → fill. Low = card red, middle = neutral, high = floodlight. */
export const bandColor = (p: number | null) =>
  p === null ? 'var(--line)' : p >= 67 ? 'var(--flood)' : p >= 34 ? 'var(--mid)' : 'var(--card)';

function polar(r: number, a: number) {
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
}

function wedge(r: number, a0: number, a1: number) {
  const [x0, y0] = polar(R0, a0);
  const [x1, y1] = polar(r, a0);
  const [x2, y2] = polar(r, a1);
  const [x3, y3] = polar(R0, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0} ${y0} L${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${R0} ${R0} 0 ${large} 0 ${x0} ${y0} Z`;
}

/** Percentile "pizza": one wedge per metric, radius = percentile, grouped by category. */
export default function PizzaChart({ slices, title, centerValue, centerLabel, per90Label }: Props) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const n = slices.length;
  if (!n) return null;
  const step = (Math.PI * 2) / n;
  const gap = 0.012;
  const start = -Math.PI / 2;
  const radius = (p: number | null) => R0 + ((R1 - R0) * Math.max(4, p ?? 0)) / 100;

  // Category arcs (contiguous runs).
  const groups: { label: string; from: number; to: number }[] = [];
  slices.forEach((s, i) => {
    const last = groups[groups.length - 1];
    if (last && last.label === s.categoryLabel) last.to = i;
    else groups.push({ label: s.categoryLabel, from: i, to: i });
  });

  const summary = slices
    .filter((s) => s.percentile !== null)
    .map((s) => `${s.label} ${s.percentile}`)
    .join(', ');

  return (
    <figure className="m-0">
      <svg viewBox={`-100 -30 ${SIZE + 200} ${SIZE + 60}`} role="img" aria-label={`${title}: ${summary}`} className="block h-auto w-full overflow-visible">
        {/* Reference rings at 25/50/75/100 */}
        {[25, 50, 75, 100].map((p) => (
          <circle
            key={p}
            cx={C}
            cy={C}
            r={R0 + ((R1 - R0) * p) / 100}
            fill="none"
            stroke="var(--line)"
            strokeWidth={p === 50 ? 1.4 : 1}
            strokeDasharray={p === 100 ? undefined : '3 5'}
          />
        ))}

        {/* Wedges */}
        {slices.map((s, i) => {
          const a0 = start + i * step + gap;
          const a1 = start + (i + 1) * step - gap;
          const r = radius(s.percentile);
          const mid = (a0 + a1) / 2;
          const [bx, by] = polar((s.percentile ?? 0) >= 35 ? r - 20 : r + 20, mid);
          return (
            <g key={s.key}>
              <path d={wedge(R1, a0, a1)} fill="var(--turf-2)" opacity={0.55} />
              <path
                d={wedge(r, a0, a1)}
                fill={bandColor(s.percentile)}
                style={{
                  transformOrigin: `${C}px ${C}px`,
                  transform: grown ? 'scale(1)' : 'scale(0.25)',
                  opacity: grown ? 1 : 0,
                  transition: `transform 700ms cubic-bezier(.2,.8,.2,1) ${i * 35}ms, opacity 300ms ${i * 35}ms`,
                }}
              >
                <title>{`${s.label}: ${s.value ?? '—'}${s.unit === 'pct' ? '%' : ` ${per90Label}`} · ${s.percentile ?? '—'}`}</title>
              </path>
              {s.percentile !== null && (
                <g style={{ opacity: grown ? 1 : 0, transition: `opacity 300ms ${300 + i * 35}ms` }}>
                  <circle cx={bx} cy={by} r={17} fill="var(--pitch)" stroke={bandColor(s.percentile)} strokeWidth={1.5} />
                  <text x={bx} y={by} textAnchor="middle" dominantBaseline="central" className="num" fontSize={15} fontWeight={700} fill="var(--chalk)">
                    {s.percentile}
                  </text>
                </g>
              )}
              <MetricLabel angle={mid} label={s.label} />
            </g>
          );
        })}

        {/* Dividers between categories */}
        {groups.slice(1).map((g) => {
          const a = start + g.from * step;
          const [x0, y0] = polar(R0, a);
          const [x1, y1] = polar(R1 + 14, a);
          return <line key={g.label} x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--chalk-faint)" strokeWidth={1.5} />;
        })}

        {/* Hole */}
        <circle cx={C} cy={C} r={R0 - 2} fill="var(--pitch)" stroke="var(--line)" />
        {centerValue && (
          <>
            <text x={C} y={C - (centerLabel ? 6 : 0)} textAnchor="middle" dominantBaseline="central" className="display num" fontSize={34} fill="var(--chalk)">
              {centerValue}
            </text>
            {centerLabel && (
              <text x={C} y={C + 20} textAnchor="middle" fontSize={10} fill="var(--chalk-faint)">
                {centerLabel}
              </text>
            )}
          </>
        )}
      </svg>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-chalk-dim">
        {groups.map((g) => (
          <span key={g.label}>{g.label}</span>
        ))}
        <span className="ml-auto flex items-center gap-3 text-chalk-faint">
          <Swatch color="var(--card)" label="0–33" />
          <Swatch color="var(--mid)" label="34–66" />
          <Swatch color="var(--flood)" label="67–100" />
        </span>
      </figcaption>
    </figure>
  );
}

function MetricLabel({ angle, label }: { angle: number; label: string }) {
  const [x, y] = polar(RING_LABEL, angle);
  const cos = Math.cos(angle);
  const anchor = Math.abs(cos) < 0.25 ? 'middle' : cos > 0 ? 'start' : 'end';
  const words = label.split(' ');
  const lines = words.length > 1 && label.length > 11 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [label];
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="central" fontSize={19} fontWeight={500} fill="var(--chalk-dim)">
      {lines.map((l, i) => (
        <tspan key={l} x={x} dy={i === 0 ? (lines.length > 1 ? -11 : 0) : 22}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />
      <span className="num text-xs">{label}</span>
    </span>
  );
}
