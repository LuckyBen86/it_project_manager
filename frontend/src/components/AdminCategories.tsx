import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api.ts';
import type { Tag, TypeTag } from '../lib/types.ts';
import CategorieFormModal from './CategorieFormModal.tsx';
import ConfirmDialog from './ConfirmDialog.tsx';

const TYPE_LABELS: Record<TypeTag, string> = { projet: 'Projet', tache: 'Tâche' };
const TYPE_COLORS: Record<TypeTag, string> = {
  projet: 'bg-blue-50 text-blue-700',
  tache: 'bg-purple-50 text-purple-700',
};

export default function AdminCategories() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ open: boolean; tag?: Tag; defaultType?: TypeTag }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<TypeTag | 'tous'>('tous');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get<Tag[]>('/tags');
    setTags(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSubmit = async (data: { nom: string; type: TypeTag }) => {
    if (form.tag) {
      await api.patch(`/tags/${form.tag.id}`, { nom: data.nom });
    } else {
      await api.post('/tags', data);
    }
    await load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/tags/${deleteTarget.id}`);
      await load();
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = filter === 'tous' ? tags : tags.filter((t) => t.type === filter);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Tags</h2>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {(['tous', 'projet', 'tache'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-1 font-medium transition-colors capitalize ${
                  filter === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {t === 'tous' ? 'Tous' : TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setForm({ open: true })}
          className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
        >
          + Nouveau tag
        </button>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-gray-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-400">Aucun tag</div>
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
            {filtered.map((tag) => (
              <tr key={tag.id} className="group hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-800">{tag.nom}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[tag.type]}`}>
                    {TYPE_LABELS[tag.type]}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setForm({ open: true, tag })}
                      className="text-xs px-2 py-1 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => setDeleteTarget(tag)}
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
        tag={form.tag}
        defaultType={form.defaultType ?? 'projet'}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer le tag"
        message={`Supprimer le tag "${deleteTarget?.nom}" ? Les projets/tâches associés ne seront pas supprimés.`}
        loading={deleting}
      />
    </div>
  );
}
