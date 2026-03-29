import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Modal from './Modal.tsx';
import ConfirmDialog from './ConfirmDialog.tsx';
import FormField, { inputClass, selectClass } from './FormField.tsx';
import { useRessources } from '../hooks/useRessources.ts';
import { useCategories } from '../hooks/useCategories.ts';
import { useActivitesTache } from '../hooks/useActivitesTache.ts';
import api from '../lib/api.ts';
import type { Tache, Activite } from '../lib/types.ts';

const tacheSchema = z.object({
  titre: z.string().min(1, 'Titre requis').max(255),
  description: z.string().optional(),
  categorieId: z.union([z.string().uuid(), z.literal('')]).optional(),
  duree: z.number().int().positive().optional(),
  statut: z.enum(['a_faire', 'en_cours', 'termine'] as const),
  ressourceIds: z.array(z.string().uuid()).optional(),
});

type TacheForm = z.infer<typeof tacheSchema>;

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
}

export default function TacheFormModal({ open, onClose, onSaved, projetId, tache }: Props) {
  const isEdit = !!tache;
  const { ressources } = useRessources();
  const { categories } = useCategories('tache');
  const { activites, loading: loadingActivites, addActivite, deleteActivite } = useActivitesTache(projetId, tache?.id, open);

  const [showActiviteForm, setShowActiviteForm] = useState(false);
  const [submittingActivite, setSubmittingActivite] = useState(false);
  const [deleteActiviteTarget, setDeleteActiviteTarget] = useState<Activite | null>(null);
  const [deletingActivite, setDeletingActivite] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TacheForm>({
    resolver: zodResolver(tacheSchema),
    defaultValues: { statut: 'a_faire', ressourceIds: [] },
  });

  const {
    register: registerAct,
    handleSubmit: handleSubmitAct,
    reset: resetAct,
    formState: { errors: errorsAct },
  } = useForm<ActiviteForm>({
    resolver: zodResolver(activiteSchema),
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd') },
  });

  const selectedRessourceIds = watch('ressourceIds') ?? [];

  useEffect(() => {
    if (open) {
      setShowActiviteForm(false);
      reset(
        tache
          ? {
              titre: tache.titre,
              description: tache.description ?? '',
              categorieId: tache.categorie?.id ?? '',
              duree: tache.duree ?? undefined,
              statut: tache.statut,
              ressourceIds: tache.ressources.map((r) => r.ressource.id),
            }
          : { statut: 'a_faire', titre: '', description: '', categorieId: '', duree: undefined, ressourceIds: [] },
      );
    }
  }, [open, tache, reset]);

  const toggleRessource = (id: string) => {
    const current = selectedRessourceIds;
    setValue(
      'ressourceIds',
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const onSubmit = async (data: TacheForm) => {
    const payload = {
      ...data,
      categorieId: data.categorieId || undefined,
      duree: data.duree,
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
      size="md"
    >
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
          <FormField label="Catégorie" error={errors.categorieId?.message}>
            <select className={selectClass} {...register('categorieId')}>
              <option value="">— Aucune —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Durée (jours)" error={errors.duree?.message}>
            <input
              type="number"
              min={1}
              className={inputClass}
              {...register('duree', { setValueAs: (v: string) => v === '' ? undefined : Number(v) })}
              placeholder="ex: 3"
            />
          </FormField>
        </div>

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
          <div className="flex flex-wrap gap-2 mt-1">
            {ressources.map((r) => {
              const selected = selectedRessourceIds.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleRessource(r.id)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    selected
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
                  }`}
                >
                  {r.nom}
                </button>
              );
            })}
            {ressources.length === 0 && (
              <span className="text-xs text-gray-400">Aucune ressource disponible</span>
            )}
          </div>
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

      {/* Section activités — uniquement en mode édition */}
      {isEdit && (
        <div className="mt-5 pt-5 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">
              Activités
              {activites.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">{activites.length}</span>
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
              className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3"
              noValidate
            >
              <FormField label="Description" error={errorsAct.description?.message} required>
                <input
                  className={inputClass}
                  {...registerAct('description')}
                  placeholder="Ex : Réunion de cadrage, développement..."
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Date" error={errorsAct.date?.message} required>
                  <input type="date" className={inputClass} {...registerAct('date')} />
                </FormField>
                <FormField label="Durée (jours)" error={errorsAct.duree?.message} required>
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

          {/* Liste des activités */}
          {loadingActivites ? (
            <p className="text-xs text-gray-400 text-center py-2">Chargement...</p>
          ) : activites.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3 italic">Aucune activité enregistrée</p>
          ) : (
            <div className="space-y-2">
              {activites.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100 group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-800">{act.description}</p>
                    <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                      <span>{format(new Date(act.date), 'dd MMM yyyy', { locale: fr })}</span>
                      <span>{act.duree} j</span>
                      <span>{act.ressource.nom}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteActiviteTarget(act)}
                    title="Supprimer"
                    className="shrink-0 ml-2 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
