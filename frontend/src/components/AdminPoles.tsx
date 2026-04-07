import { useState } from 'react';
import api from '../lib/api.ts';
import type { Pole } from '../lib/types.ts';
import { usePoles } from '../hooks/usePoles.ts';
import ConfirmDialog from './ConfirmDialog.tsx';

export default function AdminPoles() {
  const { poles, loading, refresh } = usePoles();
  const [newNom, setNewNom] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [editTarget, setEditTarget] = useState<Pole | null>(null);
  const [editNom, setEditNom] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Pole | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNom.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      await api.post('/poles', { nom: newNom.trim() });
      setNewNom('');
      await refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCreateError(msg ?? 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !editNom.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/poles/${editTarget.id}`, { nom: editNom.trim() });
      setEditTarget(null);
      await refresh();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/poles/${deleteTarget.id}`);
      setDeleteTarget(null);
      await refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setDeleteError(msg ?? 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">
          Pôles
          <span className="ml-2 text-gray-400 font-normal text-xs">{poles.length} pôle{poles.length > 1 ? 's' : ''}</span>
        </h2>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-gray-400">Chargement...</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {poles.map((pole) => (
            <div key={pole.id} className="px-5 py-3 flex items-center justify-between group">
              {editTarget?.id === pole.id ? (
                <form onSubmit={handleEdit} className="flex items-center gap-2 flex-1">
                  <input
                    autoFocus
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-brand-400"
                    value={editNom}
                    onChange={(e) => setEditNom(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="text-xs px-2 py-1 bg-brand-600 text-white rounded transition-colors hover:bg-brand-700 disabled:opacity-50"
                  >
                    {saving ? '...' : 'OK'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTarget(null)}
                    className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                  >
                    Annuler
                  </button>
                </form>
              ) : (
                <>
                  <span className="text-sm font-medium text-gray-800">{pole.nom}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditTarget(pole); setEditNom(pole.nom); }}
                      className="text-xs px-2 py-1 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                    >
                      Renommer
                    </button>
                    <button
                      onClick={() => { setDeleteTarget(pole); setDeleteError(''); }}
                      className="text-xs px-2 py-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      Supprimer
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Formulaire de création */}
          <form onSubmit={handleCreate} className="px-5 py-3 flex items-center gap-2">
            <input
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-400"
              placeholder="Nouveau pôle..."
              value={newNom}
              onChange={(e) => setNewNom(e.target.value)}
            />
            <button
              type="submit"
              disabled={creating || !newNom.trim()}
              className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium disabled:opacity-50"
            >
              {creating ? 'Création...' : '+ Ajouter'}
            </button>
          </form>
          {createError && (
            <p className="px-5 pb-3 text-xs text-red-500">{createError}</p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer le pôle"
        message={`Supprimer le pôle "${deleteTarget?.nom}" ? Cette action est irréversible.`}
        loading={deleting}
        error={deleteError}
      />
    </div>
  );
}
