import { useEffect, useRef, useState } from 'react';

interface Item {
  id: string;
  nom: string;
}

interface Props {
  items: Item[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

export default function TokenField({ items, selectedIds, onChange, placeholder = '+ Ajouter' }: Props) {
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

  const selected = items.filter((i) => selectedIds.includes(i.id));
  const available = items.filter((i) => !selectedIds.includes(i.id));

  const remove = (id: string) => onChange(selectedIds.filter((x) => x !== id));
  const add = (id: string) => { onChange([...selectedIds, id]); setOpen(false); };

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="flex flex-wrap gap-1 items-center px-2 py-1.5 border border-gray-300 rounded-lg min-h-[38px] bg-white cursor-default focus-within:ring-2 focus-within:ring-brand-500"
      >
        {selected.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200"
          >
            {item.nom}
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="text-brand-400 hover:text-red-500 transition-colors leading-none ml-0.5"
              aria-label={`Retirer ${item.nom}`}
            >
              ×
            </button>
          </span>
        ))}

        {available.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-gray-400 hover:text-brand-600 transition-colors px-1 leading-none shrink-0"
          >
            {placeholder}
          </button>
        )}

        {selected.length === 0 && available.length === 0 && (
          <span className="text-xs text-gray-400 px-1">Aucun élément disponible</span>
        )}
      </div>

      {open && available.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px] max-h-48 overflow-y-auto">
          {available.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => add(item.id)}
              className="w-full text-left text-xs px-3 py-1.5 hover:bg-brand-50 hover:text-brand-700 text-gray-700 transition-colors"
            >
              {item.nom}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
