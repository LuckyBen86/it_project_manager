import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api.ts';
import type { Categorie, Pole } from '../lib/types.ts';
import Modal from './Modal.tsx';
import FormField, { inputClass } from './FormField.tsx';
import ConfirmDialog from './ConfirmDialog.tsx';
import TokenField from './TokenField.tsx';

const categorieSchema = z.object({
  nom:     z.string().min(1, 'Nom requis').max(100),
  poleIds: z.array(z.string()).optional(),
});
type CategorieForm = z.infer<typeof categorieSchema>;

export default function AdminLogiciels() {
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [poles, setPoles] = useState<Pole[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ open: boolean; categorie?: Categorie }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<Categorie | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterPoleId, setFilterPoleId] = useState<string>('');

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<CategorieForm>({
    resolver: zodResolver(categorieSchema),
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [catData, poleData] = await Promise.all([
      api.get<Categorie[]>('/categories'),
      api.get<Pole[]>('/poles'),
    ]);
    setCategories(catData.data);
    setPoles(poleData.data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    reset({ nom: '', poleIds: [] });
    setForm({ open: true });
  };

  const openEdit = (categorie: Categorie) => {
    reset({ nom: categorie.nom, poleIds: (categorie.poles ?? []).map((p) => p.id) });
    setForm({ open: true, categorie });
  };

  const onSubmit = async (data: CategorieForm) => {
    if (form.categorie) {
      await api.patch(`/categories/${form.categorie.id}`, data);
    } else {
      await api.post('/categories', data);
    }
    await load();
    setForm({ open: false });
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

  const poleItems = poles.map((p) => ({ id: p.id, nom: p.nom }));
  const selectedPoleIds = watch('poleIds') ?? [];

  const filtered = categories.filter((cat) => {
    if (!filterPoleId) return true;
    if ((cat.poles ?? []).length === 0) return false;
    return (cat.poles ?? []).some((p) => p.id === filterPoleId);
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Catégories</h2>
        <div className="flex items-center gap-2">
          <select
            value={filterPoleId}
            onChange={(e) => setFilterPoleId(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-brand-400"
          >
            <option value="">Tous les pôles</option>
            {poles.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
          <button
            onClick={openCreate}
            className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
          >
            + Nouvelle catégorie
          </button>
        </div>
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
              <th className="px-5 py-3 text-left font-medium">Pôles</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((cat) => (
              <tr key={cat.id} className="group hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-800">{cat.nom}</td>
                <td className="px-5 py-3">
                  {(cat.poles ?? []).length === 0 ? (
                    <span className="text-xs text-gray-400 italic">Tous les pôles</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {cat.poles!.map((p) => (
                        <span key={p.id} className="text-xs bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded-full">
                          {p.nom}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(cat)}
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

      <Modal
        open={form.open}
        onClose={() => setForm({ open: false })}
        title={form.categorie ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
        size="sm"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField label="Nom" error={errors.nom?.message} required>
            <input className={inputClass} {...register('nom')} placeholder="ex: ERP" autoFocus />
          </FormField>
          <FormField label="Pôles (vide = tous les pôles)" error={undefined}>
            <TokenField
              items={poleItems}
              selectedIds={selectedPoleIds}
              onChange={(ids) => setValue('poleIds', ids)}
              placeholder="+ Pôle"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setForm({ open: false })}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {isSubmitting ? 'Enregistrement...' : form.categorie ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer la catégorie"
        message={`Supprimer la catégorie "${deleteTarget?.nom}" ? Les projets associés ne seront pas supprimés.`}
        loading={deleting}
      />
    </div>
  );
}
