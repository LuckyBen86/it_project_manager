import { useEffect, useState, useCallback } from 'react';
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from 'date-fns';
import api from '../lib/api.ts';
import type { ActionType, JournalAction } from '../lib/types.ts';
import DateInput from './DateInput.tsx';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
const RANGE_PRESETS = [
  { label: 'Ce mois',         fn: (): [string, string] => { const t = new Date(); return [fmt(startOfMonth(t)), fmt(endOfMonth(t))]; } },
  { label: 'Mois précédent',  fn: (): [string, string] => { const t = subMonths(new Date(), 1); return [fmt(startOfMonth(t)), fmt(endOfMonth(t))]; } },
  { label: '3 derniers mois', fn: (): [string, string] => { const t = new Date(); return [fmt(subMonths(t, 3)), fmt(t)]; } },
  { label: '6 derniers mois', fn: (): [string, string] => { const t = new Date(); return [fmt(subMonths(t, 6)), fmt(t)]; } },
  { label: 'Année civile',    fn: (): [string, string] => { const t = new Date(); return [fmt(startOfYear(t)), fmt(endOfYear(t))]; } },
] as const;

const ACTION_LABELS: Record<ActionType, string> = {
  STATUT_PROJET: 'Statut projet',
  STATUT_TACHE: 'Statut tâche',
  DATE_DEBUT_PROJET: 'Date début projet',
  DATE_DEBUT_TACHE: 'Date début tâche',
  SUPPRESSION_PROJET: 'Suppression projet',
  SUPPRESSION_TACHE: 'Suppression tâche',
  RESTAURATION_PROJET: 'Restauration projet',
  RESTAURATION_TACHE: 'Restauration tâche',
};

const ACTION_COLORS: Record<ActionType, string> = {
  STATUT_PROJET: 'bg-blue-100 text-blue-700',
  STATUT_TACHE: 'bg-indigo-100 text-indigo-700',
  DATE_DEBUT_PROJET: 'bg-yellow-100 text-yellow-700',
  DATE_DEBUT_TACHE: 'bg-orange-100 text-orange-700',
  SUPPRESSION_PROJET: 'bg-red-100 text-red-700',
  SUPPRESSION_TACHE: 'bg-red-100 text-red-600',
  RESTAURATION_PROJET: 'bg-green-100 text-green-700',
  RESTAURATION_TACHE: 'bg-green-100 text-green-600',
};

const PAGE_SIZE = 25;

interface Filters {
  action: ActionType | '';
  auteur: string;
  entity: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: Filters = { action: '', auteur: '', entity: '', dateFrom: '', dateTo: '' };

export default function AdminJournal() {
  const [entries, setEntries] = useState<JournalAction[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [purging, setPurging] = useState(false);

  const load = useCallback(async (off: number, f: Filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
      if (f.action)   params.set('action',   f.action);
      if (f.auteur)   params.set('auteur',   f.auteur);
      if (f.entity)   params.set('entity',   f.entity);
      if (f.dateFrom) params.set('dateFrom', f.dateFrom);
      if (f.dateTo)   params.set('dateTo',   f.dateTo);
      const { data } = await api.get<{ entries: JournalAction[]; total: number }>(`/journal?${params}`);
      setEntries(data.entries);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(offset, filters); }, [filters, offset, load]);

  const applyFilters = () => {
    setFilters(draft);
    setOffset(0);
  };

  const resetFilters = () => {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setOffset(0);
  };

  const goPage = (newOffset: number) => setOffset(newOffset);

  const handlePurge = async () => {
    setPurging(true);
    try {
      await api.delete('/journal');
      setConfirmPurge(false);
      setOffset(0);
      load(0, filters);
    } finally {
      setPurging(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div>
      {/* Barre de filtres */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 space-y-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {/* Date de */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Date (de)</label>
            <DateInput
              value={draft.dateFrom}
              onChange={(v) => setDraft((d) => ({ ...d, dateFrom: v }))}
              inputClassName="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
            />
          </div>
          {/* Date à */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Date (à)</label>
            <DateInput
              value={draft.dateTo}
              onChange={(v) => setDraft((d) => ({ ...d, dateTo: v }))}
              inputClassName="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
            />
          </div>
          {/* Auteur */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Auteur</label>
            <input
              type="text"
              placeholder="Rechercher…"
              value={draft.auteur}
              onChange={(e) => setDraft((d) => ({ ...d, auteur: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
            />
          </div>
          {/* Action */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Action</label>
            <select
              value={draft.action}
              onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value as ActionType | '' }))}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
            >
              <option value="">Toutes</option>
              {(Object.keys(ACTION_LABELS) as ActionType[]).map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a]}</option>
              ))}
            </select>
          </div>
          {/* Entité */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Entité</label>
            <input
              type="text"
              placeholder="Rechercher…"
              value={draft.entity}
              onChange={(e) => setDraft((d) => ({ ...d, entity: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
            />
          </div>
        </div>

        {/* Plages rapides */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-200">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0">Plages :</span>
          {RANGE_PRESETS.map(({ label, fn }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                const [f, t] = fn();
                const next = { ...draft, dateFrom: f, dateTo: t };
                setDraft(next);
                setFilters(next);
                setOffset(0);
              }}
              className="text-xs px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 transition-colors font-medium"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={applyFilters}
            className="text-sm px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
          >
            Filtrer
          </button>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-sm px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Réinitialiser
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">{total} entrée{total !== 1 ? 's' : ''}</span>

          {/* Purge */}
          {!confirmPurge ? (
            <button
              onClick={() => setConfirmPurge(true)}
              className="text-sm px-3 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium"
            >
              Purger le journal
            </button>
          ) : (
            <div className="flex items-center gap-2 border border-red-300 rounded-lg px-3 py-1.5 bg-red-50">
              <span className="text-xs text-red-700 font-medium">Supprimer toutes les entrées ?</span>
              <button
                onClick={handlePurge}
                disabled={purging}
                className="text-xs px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
              >
                {purging ? '…' : 'Confirmer'}
              </button>
              <button
                onClick={() => setConfirmPurge(false)}
                className="text-xs px-2 py-0.5 border border-red-300 text-red-600 rounded hover:bg-red-100 transition-colors"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tableau */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Auteur</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Entité</th>
              <th className="text-left px-4 py-3">Détail</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400 text-sm">Chargement...</td>
              </tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400 text-sm">Aucune entrée dans le journal</td>
              </tr>
            )}
            {!loading && entries.map((e) => (
              <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{e.auteurNom}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${ACTION_COLORS[e.action]}`}>
                    {ACTION_LABELS[e.action]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate" title={e.entityTitre}>
                  {e.entityTitre}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {e.ancienneValeur || e.nouvelleValeur ? (
                    <span>
                      {e.ancienneValeur && <span className="line-through text-red-400 mr-1">{e.ancienneValeur}</span>}
                      {e.ancienneValeur && e.nouvelleValeur && <span className="text-gray-400 mr-1">→</span>}
                      {e.nouvelleValeur && <span className="text-green-600 font-medium">{e.nouvelleValeur}</span>}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => goPage(offset - PAGE_SIZE)}
            disabled={offset === 0}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Précédent
          </button>
          <span className="text-sm text-gray-500">Page {currentPage} / {totalPages}</span>
          <button
            onClick={() => goPage(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
