import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api.ts';
import type { Categorie, TypeCategorie } from '../lib/types.ts';
import CategorieFormModal from './CategorieFormModal.tsx';
import ConfirmDialog from './ConfirmDialog.tsx';

const TYPE_LABELS: Record<TypeCategorie, string> = { projet: 'Projet', tache: 'Tâche' };
const TYPE_COLORS: Record<TypeCategorie, string> = {
  projet: 'bg-blue-50 text-blue-700',
  tache: 'bg-purple-50 text-purple-700',
};

export default function AdminCategories() {
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ open: boolean; categorie?: Categorie; defaultType?: TypeCategorie }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<Categorie | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<TypeCategorie | 'tous'>('tous');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get<Categorie[]>('/categories');
    setCategories(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSubmit = async (data: { nom: string; type: TypeCategorie }) => {
    if (form.categorie) {
      await api.patch(`/categories/${form.categorie.id}`, { nom: data.nom });
    } else {
      await api.post('/categories', data);
    }
    await load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/categories/${deleteTarget.id}`);
      await load();
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = filter === 'tous' ? categories : categories.filter((c) => c.type === filter);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Catégories</h2>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {(['tous', 'projet', 'tache'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-1 font-medium transition-colors capitalize ${
                  filter === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {t === 'tous' ? 'Toutes' : TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setForm({ open: true })}
          className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
        >
          + Nouvelle catégorie
        </button>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-gray-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-400">Aucune catégorie</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Nom</th>
              <th className="px-5 py-3 text-left font-medium">Type</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((cat) => (
              <tr key={cat.id} className="group hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-800">{cat.nom}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[cat.type]}`}>
                    {TYPE_LABELS[cat.type]}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setForm({ open: true, categorie: cat })}
                      className="text-xs px-2 py-1 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => setDeleteTarget(cat)}
                      className="text-xs px-2 py-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <CategorieFormModal
        open={form.open}
        onClose={() => setForm({ open: false })}
        onSubmit={handleSubmit}
        categorie={form.categorie}
        defaultType={form.defaultType ?? 'projet'}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer la catégorie"
        message={`Supprimer la catégorie "${deleteTarget?.nom}" ? Les projets/tâches associés ne seront pas supprimés.`}
        loading={deleting}
      />
    </div>
  );
}
