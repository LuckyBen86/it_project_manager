import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.ts';
import { useAuthStore } from '../store/auth.store.ts';
import type { SearchResults } from '../lib/types.ts';

export default function GlobalSearch() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isManager = user?.role === 'responsable' || user?.role === 'direction_generale';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ projets: [], taches: [] });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click-outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults({ projets: [], taches: [] }); setOpen(false); return; }
    setLoading(true);
    try {
      const { data } = await api.get<SearchResults>(`/search?q=${encodeURIComponent(q)}`);
      setResults(data);
      setOpen(true);
    } catch {
      setResults({ projets: [], taches: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = () => {
    setQuery('');
    setOpen(false);
  };

  const total = results.projets.length + results.taches.length;
  const hasResults = total > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Rechercher…"
          aria-label="Recherche globale"
          className="w-44 pl-8 pr-3 py-1.5 text-xs bg-gray-100 border border-transparent rounded-lg focus:outline-none focus:bg-white focus:border-brand-300 transition-all placeholder-gray-400"
        />
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-1 right-0 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {!hasResults ? (
            <p className="px-4 py-3 text-xs text-gray-400">Aucun résultat</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {results.projets.length > 0 && (
                <div>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Projets</p>
                  {results.projets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { handleSelect(); navigate('/'); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 text-brand-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                      </svg>
                      <span className="text-xs text-gray-800 truncate">{p.titre}</span>
                      {p.pole && <span className="ml-auto text-[10px] text-gray-400 shrink-0">{p.pole.nom}</span>}
                    </button>
                  ))}
                </div>
              )}
              {results.taches.length > 0 && (
                <div>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Tâches</p>
                  {results.taches.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { handleSelect(); navigate(isManager ? '/gantt' : '/mes-taches'); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-800 truncate">{t.titre}</p>
                        <p className="text-[10px] text-gray-400 truncate">{t.projetTitre}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
