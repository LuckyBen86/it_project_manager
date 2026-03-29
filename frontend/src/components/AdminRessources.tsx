import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../lib/api.ts';
import type { Ressource } from '../lib/types.ts';
import RessourceFormModal from './RessourceFormModal.tsx';
import ConfirmDialog from './ConfirmDialog.tsx';
import { useAuthStore } from '../store/auth.store.ts';

const ROLE_COLORS = {
  responsable: 'bg-brand-50 text-brand-700',
  utilisateur: 'bg-gray-100 text-gray-600',
};

const ROLE_LABELS = {
  responsable: 'Responsable',
  utilisateur: 'Utilisateur',
};

export default function AdminRessources() {
  const currentUser = useAuthStore((s) => s.user);
  const [ressources, setRessources] = useState<Ressource[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ open: boolean; ressource?: Ressource }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<Ressource | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get<Ressource[]>('/ressources');
    setRessources(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSubmit = async (data: Partial<Ressource> & { password?: string }) => {
    if (form.ressource) {
      await api.patch(`/ressources/${form.ressource.id}`, data);
    } else {
      await api.post('/ressources', data);
    }
    await load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/ressources/${deleteTarget.id}`);
      await load();
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Ressources
          <span className="ml-2 text-gray-400 font-normal text-xs">{ressources.length} membres</span>
        </h2>
        <button
          onClick={() => setForm({ open: true })}
          className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
        >
          + Nouvelle ressource
        </button>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-gray-400">Chargement...</div>
      ) : ressources.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-400">Aucune ressource</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Nom</th>
              <th className="px-5 py-3 text-left font-medium">Email</th>
              <th className="px-5 py-3 text-left font-medium">Rôle</th>
              <th className="px-5 py-3 text-left font-medium">Créé le</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ressources.map((r) => {
              const isSelf = r.id === currentUser?.id;
              return (
                <tr key={r.id} className="group hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {r.nom.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{r.nom}</span>
                      {isSelf && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">vous</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{r.email}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[r.role]}`}>
                      {ROLE_LABELS[r.role]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {format(new Date(r.createdAt), 'dd MMM yyyy', { locale: fr })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setForm({ open: true, ressource: r })}
                        className="text-xs px-2 py-1 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                      >
                        Modifier
                      </button>
                      {!isSelf && (
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="text-xs px-2 py-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <RessourceFormModal
        open={form.open}
        onClose={() => setForm({ open: false })}
        onSubmit={handleSubmit}
        ressource={form.ressource}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer la ressource"
        message={`Supprimer "${deleteTarget?.nom}" (${deleteTarget?.email}) ? Cette action est irréversible.`}
        loading={deleting}
      />
    </div>
  );
}
