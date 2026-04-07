import { useEffect, useRef, useState } from 'react';
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from 'date-fns';
import DateInput from './DateInput.tsx';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

const PRESETS = [
  {
    label: 'Ce mois',
    fn: (): [string, string] => {
      const t = new Date();
      return [fmt(startOfMonth(t)), fmt(endOfMonth(t))];
    },
  },
  {
    label: 'Mois précédent',
    fn: (): [string, string] => {
      const t = subMonths(new Date(), 1);
      return [fmt(startOfMonth(t)), fmt(endOfMonth(t))];
    },
  },
  {
    label: '3 derniers mois',
    fn: (): [string, string] => {
      const t = new Date();
      return [fmt(subMonths(t, 3)), fmt(t)];
    },
  },
  {
    label: '6 derniers mois',
    fn: (): [string, string] => {
      const t = new Date();
      return [fmt(subMonths(t, 6)), fmt(t)];
    },
  },
  {
    label: '12 derniers mois',
    fn: (): [string, string] => {
      const t = new Date();
      return [fmt(subMonths(t, 12)), fmt(t)];
    },
  },
  {
    label: 'Année civile',
    fn: (): [string, string] => {
      const t = new Date();
      return [fmt(startOfYear(t)), fmt(endOfYear(t))];
    },
  },
] as const;

interface Props {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  label?: string;
  /** Class forwarded to each <input type="date">. Defaults to filter-bar style. */
  inputClassName?: string;
}

const FILTER_INPUT_CLASS =
  'text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-brand-400';

export default function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  label,
  inputClassName = FILTER_INPUT_CLASS,
}: Props) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const applyPreset = (fn: () => [string, string]) => {
    const [f, t] = fn();
    onFromChange(f);
    onToChange(t);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {label && (
        <span className="text-xs text-gray-500 font-medium shrink-0">{label}</span>
      )}

      <DateInput value={from} onChange={onFromChange} inputClassName={inputClassName} />
      <span className="text-xs text-gray-400 shrink-0">→</span>
      <DateInput value={to} onChange={onToChange} inputClassName={inputClassName} />

      {/* Range presets button */}
      <div ref={popRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors
            ${open
              ? 'bg-brand-50 border-brand-300 text-brand-700'
              : 'bg-white border-gray-200 text-gray-500 hover:border-brand-300 hover:text-brand-600'
            }`}
          title="Plages rapides"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6h16M4 10h16M4 14h16M4 18h7" />
          </svg>
          Plage
          <svg
            className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute top-full right-0 mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-2.5 min-w-[180px]">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
              Plages rapides
            </p>
            <div className="flex flex-col gap-0.5">
              {PRESETS.map(({ label: pl, fn }) => (
                <button
                  key={pl}
                  type="button"
                  onClick={() => applyPreset(fn)}
                  className="text-xs px-3 py-2 rounded-lg text-gray-700 hover:bg-brand-50 hover:text-brand-700 font-medium transition-colors text-left"
                >
                  {pl}
                </button>
              ))}
            </div>
            {(from || to) && (
              <>
                <div className="border-t border-gray-100 my-2" />
                <button
                  type="button"
                  onClick={() => { onFromChange(''); onToChange(''); setOpen(false); }}
                  className="w-full text-xs py-1.5 px-3 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 border border-dashed border-gray-200 hover:border-red-200 transition-colors font-medium"
                >
                  Effacer la plage
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
