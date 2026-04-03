import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api.ts';
import type { Logiciel } from '../lib/types.ts';
import Modal from './Modal.tsx';
import FormField, { inputClass } from './FormField.tsx';
import ConfirmDialog from './ConfirmDialog.tsx';

const logicielSchema = z.object({ nom: z.string().min(1, 'Nom requis').max(100) });
type LogicielForm = z.infer<typeof logicielSchema>;

export default function AdminLogiciels() {
  const [logiciels, setLogiciels] = useState<Logiciel[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ open: boolean; logiciel?: Logiciel }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<Logiciel | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<LogicielForm>({
    resolver: zodResolver(logicielSchema),
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get<Logiciel[]>('/logiciels');
    setLogiciels(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => { reset({ nom: '' }); setForm({ open: true }); };
  const openEdit = (logiciel: Logiciel) => { reset({ nom: logiciel.nom }); setForm({ open: true, logiciel }); };

  const onSubmit = async (data: LogicielForm) => {
    if (form.logiciel) {
      await api.patch(`/logiciels/${form.logiciel.id}`, data);
    } else {
      await api.post('/logiciels', data);
    }
    await load();
    setForm({ open: false });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/logiciels/${deleteTarget.id}`);
      await load();
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Logiciels</h2>
        <button
          onClick={openCreate}
          className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
        >
          + Nouveau logiciel
        </button>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-gray-400">Chargement...</div>
      ) : logiciels.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-400">Aucun logiciel</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Nom</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logiciels.map((logiciel) => (
              <tr key={logiciel.id} className="group hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-800">{logiciel.nom}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(logiciel)}
                      className="text-xs px-2 py-1 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => setDeleteTarget(logiciel)}
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

      <Modal open={form.open} onClose={() => setForm({ open: false })} title={form.logiciel ? 'Modifier le logiciel' : 'Nouveau logiciel'} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField label="Nom" error={errors.nom?.message} required>
            <input className={inputClass} {...register('nom')} placeholder="ex: Jira" autoFocus />
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
              {isSubmitting ? 'Enregistrement...' : form.logiciel ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer le logiciel"
        message={`Supprimer le logiciel "${deleteTarget?.nom}" ? Les projets associés ne seront pas supprimés.`}
        loading={deleting}
      />
    </div>
  );
}
