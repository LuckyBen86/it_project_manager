import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Activite, Tache } from '../lib/types.ts';
import DateInput from './DateInput.tsx';

interface EditState {
  description: string;
  date: string;
  duree: string;
}

interface Props {
  tache: Tache;
  currentUserId: string;
  onClose: () => void;
  onUpdate: (activiteId: string, data: Partial<{ description: string; date: string; duree: number }>) => Promise<void>;
}

export default function ActiviteHistoriqueModal({ tache, currentUserId, onClose, onUpdate }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditState>({ description: '', date: '', duree: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activites: Activite[] = (tache.activites ?? []) as Activite[];

  const startEdit = (a: Activite) => {
    setEditingId(a.id);
    setEditForm({
      description: a.description,
      date: format(new Date(a.date), 'yyyy-MM-dd'),
      duree: String(a.duree),
    });
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError('');
  };

  const handleSave = async (_tacheId: string, activiteId: string) => {
    if (!editForm.description.trim()) { setError('Description requise'); return; }
    const duree = parseFloat(editForm.duree);
    if (!editForm.duree || isNaN(duree) || duree <= 0) { setError('Durée invalide'); return; }
    setSaving(true);
    try {
      await onUpdate(activiteId, {
        description: editForm.description.trim(),
        date: new Date(editForm.date).toISOString(),
        duree,
      });
      setEditingId(null);
      setError('');
    } catch {
      setError('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const totalDuree = activites.reduce((s, a) => s + a.duree, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Historique des activités</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{tache.titre}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {activites.length > 0 && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                Total : <span className="font-semibold text-gray-700">{totalDuree.toFixed(2)} j</span>
              </span>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {activites.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-sm">
              <svg className="w-8 h-8 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Aucune activité enregistrée
            </div>
          )}

          {activites.map((a) => {
            const isEditing = editingId === a.id;
            return (
              <div key={a.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {isEditing ? (
                  <div className="bg-gray-50 px-4 py-3 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                      <input
                        type="text"
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                        <DateInput
                          value={editForm.date}
                          onChange={(v) => setEditForm((f) => ({ ...f, date: v }))}
                          inputClassName="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
                        />
                      </div>
                      <div className="w-32">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Durée (jours)</label>
                        <input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={editForm.duree}
                          onChange={(e) => setEditForm((f) => ({ ...f, duree: e.target.value }))}
                          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
                        />
                      </div>
                    </div>
                    {error && <p className="text-xs text-red-500">{error}</p>}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleSave(tache.id, a.id)}
                        disabled={saving}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        {saving ? '...' : 'Enregistrer'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 font-medium truncate">{a.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(new Date(a.date), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                      {a.duree.toFixed(2)} j
                    </span>
                    {a.ressource.id === currentUserId && (
                      <button
                        onClick={() => startEdit(a)}
                        className="shrink-0 text-xs px-3 py-1 rounded-lg font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        Modifier
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
