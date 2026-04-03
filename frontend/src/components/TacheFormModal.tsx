import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Modal from './Modal.tsx';
import ConfirmDialog from './ConfirmDialog.tsx';
import FormField, { inputClass, selectClass } from './FormField.tsx';
import { useRessources } from '../hooks/useRessources.ts';
import { useTags } from '../hooks/useTags.ts';
import { useActivitesTache } from '../hooks/useActivitesTache.ts';
import api from '../lib/api.ts';
import TokenField from './TokenField.tsx';
import type { Tache, Activite, TacheDependanceItem } from '../lib/types.ts';
import DateInput from './DateInput.tsx';

type TacheForm = {
  titre: string;
  description?: string;
  tagIds?: string[];
  duree: number;
  dateDebut?: string;
  dateButoire?: string;
  statut: 'a_faire' | 'en_cours' | 'termine';
  ressourceIds?: string[];
};

function makeTacheSchema(projetDateDebut?: string) {
  const base = z.object({
    titre: z.string().min(1, 'Titre requis').max(255),
    description: z.string().optional(),
    tagIds: z.array(z.string().uuid()).optional(),
    duree: z.number({ error: 'Durée requise' }).int().positive('Durée requise (≥ 1 j)'),
    dateDebut: z.string().optional(),
    dateButoire: z.string().optional(),
    statut: z.enum(['a_faire', 'en_cours', 'termine'] as const),
    ressourceIds: z.array(z.string().uuid()).optional(),
  });
  if (!projetDateDebut) return base;
  const minDate = projetDateDebut.slice(0, 10);
  return base.superRefine((data, ctx) => {
    if (data.dateDebut && data.dateDebut < minDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dateDebut'],
        message: `Doit être ≥ au ${format(new Date(projetDateDebut), 'dd/MM/yyyy', { locale: fr })}`,
      });
    }
  });
}

const activiteSchema = z.object({
  description: z.string().min(1, 'Description requise'),
  date: z.string().min(1, 'Date requise'),
  duree: z.number().positive('Durée > 0').multipleOf(0.01),
  ressourceId: z.string().uuid('Ressource requise'),
});

type ActiviteForm = z.infer<typeof activiteSchema>;

const STATUT_TACHE_LABELS = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' };

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  projetId: string;
  tache?: Tache;
  projetDateDebut?: string;
  projetTaches?: Tache[];
}

export default function TacheFormModal({ open, onClose, onSaved, projetId, tache, projetDateDebut, projetTaches = [] }: Props) {
  const isEdit = !!tache;
  const { ressources } = useRessources();
  const { tags } = useTags('tache');
  const { activites, loading: loadingActivites, addActivite, deleteActivite } = useActivitesTache(projetId, tache?.id, open);

  const [showActiviteForm, setShowActiviteForm] = useState(false);
  const [submittingActivite, setSubmittingActivite] = useState(false);
  const [deleteActiviteTarget, setDeleteActiviteTarget] = useState<Activite | null>(null);
  const [deletingActivite, setDeletingActivite] = useState(false);
  const [localDeps, setLocalDeps] = useState<TacheDependanceItem[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TacheForm>({
    resolver: zodResolver(makeTacheSchema(projetDateDebut)),
    defaultValues: { statut: 'a_faire', ressourceIds: [], tagIds: [] },
  });

  const selectedTagIds = watch('tagIds') ?? [];
  const tagItems = tags.map((t) => ({ id: t.id, nom: t.nom }));
  const ressourceItems = ressources.map((r) => ({ id: r.id, nom: r.nom }));

  const {
    register: registerAct,
    handleSubmit: handleSubmitAct,
    reset: resetAct,
    control: controlAct,
    formState: { errors: errorsAct },
  } = useForm<ActiviteForm>({
    resolver: zodResolver(activiteSchema),
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd') },
  });

  const selectedRessourceIds = watch('ressourceIds') ?? [];

  useEffect(() => {
    if (open) {
      setShowActiviteForm(false);
      setLocalDeps(tache?.dependances ?? []);
      reset(
        tache
          ? {
              titre: tache.titre,
              description: tache.description ?? '',
              tagIds: tache.tags.map((t) => t.id),
              duree: tache.duree ?? undefined,
              dateDebut: tache.dateDebut ? tache.dateDebut.slice(0, 10) : '',
              dateButoire: tache.dateButoire ? tache.dateButoire.slice(0, 10) : '',
              statut: tache.statut,
              ressourceIds: tache.ressources.map((r) => r.ressource.id),
            }
          : { statut: 'a_faire', titre: '', description: '', tagIds: [], duree: undefined, dateDebut: '', dateButoire: '', ressourceIds: [] },
      );
    }
  }, [open, tache, reset]);

  // Items disponibles pour "Commence après :" (toutes les tâches du projet sauf la courante)
  const depItems = projetTaches
    .filter((t) => t.id !== tache?.id)
    .map((t) => ({ id: t.id, nom: t.titre }));
  const depSelectedIds = localDeps.map((d) => d.precedentId);

  const handleDepsChange = async (newIds: string[]) => {
    const toAdd = newIds.filter((id) => !depSelectedIds.includes(id));
    const toRemove = depSelectedIds.filter((id) => !newIds.includes(id));
    try {
      for (const id of toAdd) {
        await api.post(`/projets/${projetId}/taches/${tache!.id}/dependances`, { precedentId: id });
      }
      for (const id of toRemove) {
        await api.delete(`/projets/${projetId}/taches/${tache!.id}/dependances/${id}`);
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) alert(msg);
      return;
    }
    const newDeps: TacheDependanceItem[] = newIds.map((id) => {
      const existing = localDeps.find((d) => d.precedentId === id);
      if (existing) return existing;
      const src = projetTaches.find((t) => t.id === id);
      return { tacheId: tache!.id, precedentId: id, precedent: { id, titre: src?.titre ?? id } };
    });
    setLocalDeps(newDeps);
    onSaved();
  };

  const onSubmit = async (data: TacheForm) => {
    const payload = {
      ...data,
      tagIds: data.tagIds ?? [],
      duree: data.duree,
      dateDebut: data.dateDebut ? new Date(data.dateDebut).toISOString() : undefined,
      dateButoire: data.dateButoire ? new Date(data.dateButoire).toISOString() : undefined,
    };
    if (isEdit) {
      await api.patch(`/projets/${projetId}/taches/${tache.id}`, payload);
    } else {
      await api.post(`/projets/${projetId}/taches`, payload);
    }
    onSaved();
    onClose();
  };

  const onSubmitActivite = async (data: ActiviteForm) => {
    setSubmittingActivite(true);
    try {
      await addActivite({
        ...data,
        date: new Date(data.date).toISOString(),
      });
      resetAct({ date: format(new Date(), 'yyyy-MM-dd'), description: '', duree: undefined as unknown as number, ressourceId: '' });
      setShowActiviteForm(false);
    } finally {
      setSubmittingActivite(false);
    }
  };

  const handleConfirmDeleteActivite = async () => {
    if (!deleteActiviteTarget) return;
    setDeletingActivite(true);
    try {
      await deleteActivite(deleteActiviteTarget.id);
      setDeleteActiviteTarget(null);
    } finally {
      setDeletingActivite(false);
    }
  };

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Modifier la tâche' : 'Nouvelle tâche'}
      size={isEdit ? 'xl' : 'md'}
    >
      <div className={isEdit ? 'grid grid-cols-2 gap-6 items-start' : undefined}>

        {/* Colonne gauche : champs de la tâche */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField label="Titre" error={errors.titre?.message} required>
            <input className={inputClass} {...register('titre')} placeholder="Nom de la tâche" />
          </FormField>

          <FormField label="Description" error={errors.description?.message}>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              {...register('description')}
              placeholder="Description optionnelle"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date de début" error={errors.dateDebut?.message}>
              <Controller
                name="dateDebut"
                control={control}
                render={({ field }) => (
                  <DateInput
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    min={projetDateDebut ? projetDateDebut.slice(0, 10) : undefined}
                  />
                )}
              />
            </FormField>

            <FormField label="Date butoire" error={errors.dateButoire?.message}>
              <Controller
                name="dateButoire"
                control={control}
                render={({ field }) => (
                  <DateInput
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>
          </div>

          <FormField label="Durée estimée (jours)" error={errors.duree?.message} required>
            <input
              type="number"
              min={1}
              className={inputClass}
              {...register('duree', { setValueAs: (v: string) => v === '' ? undefined : Number(v) })}
              placeholder="ex: 3"
            />
          </FormField>

          {isEdit && (
            <FormField label="Statut" error={errors.statut?.message}>
              <select className={selectClass} {...register('statut')}>
                {(Object.keys(STATUT_TACHE_LABELS) as (keyof typeof STATUT_TACHE_LABELS)[]).map((s) => (
                  <option key={s} value={s}>{STATUT_TACHE_LABELS[s]}</option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label="Ressources assignées">
            <TokenField
              items={ressourceItems}
              selectedIds={selectedRessourceIds}
              onChange={(ids) => setValue('ressourceIds', ids)}
              placeholder="+ Ressource"
            />
          </FormField>

          {/* Commence après : (dépendances — mode édition uniquement) */}
          {isEdit && depItems.length > 0 && (
            <FormField label="Commence après">
              <TokenField
                items={depItems}
                selectedIds={depSelectedIds}
                onChange={handleDepsChange}
                placeholder="+ Lier"
              />
            </FormField>
          )}

          {/* Tags déplacés en bas */}
          <FormField label="Tags" error={errors.tagIds?.message}>
            <TokenField
              items={tagItems}
              selectedIds={selectedTagIds}
              onChange={(ids) => setValue('tagIds', ids)}
              placeholder="+ Tag"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {isSubmitting ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>

        {/* Colonne droite : activités (mode édition uniquement) */}
        {isEdit && (
          <div className="border-l border-gray-100 pl-6 flex flex-col gap-3">
            {/* Durée consommée — se rafraîchit à chaque ajout/suppression d'activité */}
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Durée consommée</p>
              <p className="text-sm font-semibold text-gray-800">
                {activites.length > 0
                  ? `${activites.reduce((s, a) => s + a.duree, 0).toFixed(2)} j`
                  : <span className="text-gray-300">—</span>}
              </p>
            </div>

            <div className="flex items-center justify-between -mx-1 px-3 py-2 bg-gray-100 rounded-lg border border-gray-200">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <span className="w-1 h-3.5 bg-brand-500 rounded-full inline-block" />
                Activités
                {activites.length > 0 && (
                  <span className="font-normal text-gray-400 normal-case">{activites.length}</span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setShowActiviteForm((v) => !v)}
                className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
              >
                {showActiviteForm ? 'Annuler' : '+ Ajouter'}
              </button>
            </div>

            {/* Formulaire inline ajout activité */}
            {showActiviteForm && (
              <form
                onSubmit={handleSubmitAct(onSubmitActivite)}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3"
                noValidate
              >
                <FormField label="Description" error={errorsAct.description?.message} required>
                  <input
                    className={inputClass}
                    {...registerAct('description')}
                    placeholder="Ex : Réunion de cadrage..."
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Date" error={errorsAct.date?.message} required>
                    <Controller
                      name="date"
                      control={controlAct}
                      render={({ field }) => (
                        <DateInput value={field.value ?? ''} onChange={field.onChange} />
                      )}
                    />
                  </FormField>
                  <FormField label="Durée (j)" error={errorsAct.duree?.message} required>
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      className={inputClass}
                      {...registerAct('duree', { setValueAs: (v: string) => Number(v) })}
                      placeholder="ex: 0.5"
                    />
                  </FormField>
                </div>
                <FormField label="Ressource" error={errorsAct.ressourceId?.message} required>
                  <select className={selectClass} {...registerAct('ressourceId')}>
                    <option value="">— Sélectionner —</option>
                    {ressources.map((r) => (
                      <option key={r.id} value={r.id}>{r.nom}</option>
                    ))}
                  </select>
                </FormField>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingActivite}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {submittingActivite ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}

            {/* Tableau des activités */}
            {loadingActivites ? (
              <p className="text-xs text-gray-400 text-center py-2">Chargement...</p>
            ) : activites.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6 italic">Aucune activité enregistrée</p>
            ) : (
              <div className="overflow-y-auto max-h-72 rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Description</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Date</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Durée</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Ressource</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activites.map((act) => (
                      <tr key={act.id} className="group hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-800 max-w-[120px] truncate" title={act.description}>{act.description}</td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{format(new Date(act.date), 'dd MMM yy', { locale: fr })}</td>
                        <td className="px-3 py-2 text-gray-700 text-right font-medium whitespace-nowrap">{act.duree} j</td>
                        <td className="px-3 py-2 text-gray-500 max-w-[90px] truncate" title={act.ressource.nom}>{act.ressource.nom}</td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => setDeleteActiviteTarget(act)}
                            title="Supprimer"
                            className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-xs font-medium text-gray-500">Total</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800 whitespace-nowrap">
                        {activites.reduce((s, a) => s + a.duree, 0).toFixed(2)} j
                      </td>
                      <td colSpan={2} className="px-3 py-2 text-xs text-gray-400">
                        {tache?.duree ? `/ ${tache.duree} j alloués` : ''}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </Modal>

      <ConfirmDialog
        open={!!deleteActiviteTarget}
        onClose={() => setDeleteActiviteTarget(null)}
        onConfirm={handleConfirmDeleteActivite}
        title="Supprimer l'activité"
        message={`Supprimer l'activité "${deleteActiviteTarget?.description}" ? Cette action est irréversible.`}
        loading={deletingActivite}
      />
    </>
  );
}
