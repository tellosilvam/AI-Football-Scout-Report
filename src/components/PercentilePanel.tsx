import { useState } from 'react';
import PizzaChart, { bandColor, type PizzaSlice } from './PizzaChart';

interface Props {
  slices: PizzaSlice[];
  title: string;
  note: string | null;
  warning: string | null;
  centerValue?: string;
  centerLabel?: string;
  strings: { tableToggle: string; chartToggle: string; value: string; percentile: string; per90: string; metric: string };
}

export default function PercentilePanel({ slices, title, note, warning, centerValue, centerLabel, strings }: Props) {
  const [table, setTable] = useState(false);
  const hasPercentiles = slices.some((s) => s.percentile !== null);

  return (
    <section aria-labelledby="pct-title" className="sheet p-5 md:p-7">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="pct-title" className="text-xl font-bold">
            {title}
          </h2>
          {note && <p className="mt-1 text-sm text-chalk-faint">{note}</p>}
        </div>
        <button type="button" className="btn no-print min-h-[36px] px-3 text-sm" onClick={() => setTable((v) => !v)} aria-pressed={table}>
          {table ? strings.chartToggle : strings.tableToggle}
        </button>
      </div>
      {warning && <p className="mb-4 rounded-md border border-line bg-turf-2 px-3 py-2 text-sm text-chalk-dim">{warning}</p>}

      {!table && hasPercentiles ? (
        <div className="mx-auto max-w-[620px]">
          <PizzaChart slices={slices} title={title} centerValue={centerValue} centerLabel={centerLabel} per90Label={strings.per90} />
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-chalk-faint">
            <tr className="border-b border-line">
              <th className="py-2 font-medium">{strings.metric}</th>
              <th className="py-2 text-right font-medium">{strings.value}</th>
              <th className="w-[45%] py-2 pl-4 font-medium">{strings.percentile}</th>
            </tr>
          </thead>
          <tbody>
            {slices.map((s, i) => (
              <tr key={s.key} className="border-b border-line/60">
                <td className="py-2">
                  {(i === 0 || slices[i - 1].categoryLabel !== s.categoryLabel) && (
                    <span className="block text-xs text-chalk-faint">{s.categoryLabel}</span>
                  )}
                  {s.label}
                </td>
                <td className="num py-2 text-right">
                  {s.value ?? '—'}
                  <span className="text-chalk-faint">{s.unit === 'pct' ? '%' : ''}</span>
                </td>
                <td className="py-2 pl-4">
                  {s.percentile === null ? (
                    <span className="text-chalk-faint">—</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-turf-2">
                        <span className="block h-full rounded-full" style={{ width: `${s.percentile}%`, background: bandColor(s.percentile) }} />
                      </span>
                      <span className="num w-8 text-right font-semibold">{s.percentile}</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
