import { useEffect, useState } from 'react';

interface Props {
  initial: number | null;
  role: string | null;
  label: string;
}

/** The AI grade in the identity band. Updates when ReportPanel generates or switches a report. */
export default function GradeBadge({ initial, role, label }: Props) {
  const [grade, setGrade] = useState(initial);
  const [roleText, setRole] = useState(role);

  useEffect(() => {
    const on = (e: Event) => {
      const detail = (e as CustomEvent<{ overall: number; role?: string }>).detail;
      setGrade(detail.overall);
      if (detail.role) setRole(detail.role);
    };
    window.addEventListener('aiscout:report', on);
    return () => window.removeEventListener('aiscout:report', on);
  }, []);

  return (
    <a href="#report" className="flex flex-col items-start no-underline lg:items-end" aria-label={grade ? `${label}: ${grade}` : label}>
      <span className="text-sm text-ink-faint">{label}</span>
      <span className="display num text-[clamp(4.5rem,9vw,7.5rem)] leading-[0.85]" style={{ color: grade ? 'var(--hi)' : 'var(--line)' }}>
        {grade ?? '—'}
      </span>
      {roleText && <span className="mt-1 text-sm text-ink-soft">{roleText}</span>}
    </a>
  );
}
