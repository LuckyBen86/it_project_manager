import { useEffect, useRef, useState } from 'react';
import { addDays, addMonths, format } from 'date-fns';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

const SHORTCUTS = [
  { label: "Aujourd'hui", fn: () => fmt(new Date()) },
  { label: 'Demain',       fn: () => fmt(addDays(new Date(), 1)) },
  { label: '+1 semaine',   fn: () => fmt(addDays(new Date(), 7)) },
  { label: '+1 mois',      fn: () => fmt(addMonths(new Date(), 1)) },
];

interface Props {
  value: string;              // yyyy-MM-dd or ''
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  /** Class applied to the native <input>. Defaults to form style. */
  inputClassName?: string;
  disabled?: boolean;
  /** Affiche ou non le bouton raccourcis. Défaut : true. */
  showShortcuts?: boolean;
}

const FORM_INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50';

export default function DateInput({
  value,
  onChange,
  min,
  max,
  inputClassName = FORM_INPUT_CLASS,
  disabled,
  showShortcuts = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const apply = (v: string) => { onChange(v); setOpen(false); };

  return (
    <div ref={wrapRef} className="relative flex items-center gap-1">
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        disabled={disabled}
        className={inputClassName}
      />

      {/* Trigger */}
      {showShortcuts && <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title="Raccourcis de date"
        className={`shrink-0 flex items-center justify-center p-1.5 rounded-lg border transition-colors
          ${open
            ? 'bg-brand-50 border-brand-300 text-brand-600'
            : 'bg-white border-gray-200 text-gray-400 hover:border-brand-300 hover:text-brand-500'
          } disabled:opacity-40 disabled:pointer-events-none`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      }

      {/* Popup */}
      {showShortcuts && open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 min-w-[195px]">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
            Raccourcis
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {SHORTCUTS.map(({ label, fn }) => (
              <button
                key={label}
                type="button"
                onClick={() => apply(fn())}
                className="text-xs px-2.5 py-2 rounded-lg bg-gray-50 hover:bg-brand-50 hover:text-brand-700 text-gray-700 font-medium transition-colors text-left leading-tight"
              >
                {label}
              </button>
            ))}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => apply('')}
              className="mt-2 w-full text-xs py-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 border border-dashed border-gray-200 hover:border-red-200 transition-colors font-medium"
            >
              Effacer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
