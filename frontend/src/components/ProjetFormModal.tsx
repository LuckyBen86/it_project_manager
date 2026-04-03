import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Modal from './Modal.tsx';
import FormField, { inputClass, selectClass } from './FormField.tsx';
import TacheFormModal from './TacheFormModal.tsx';
import ConfirmDialog from './ConfirmDialog.tsx';
import { useRessources } from '../hooks/useRessources.ts';
import { useTags } from '../hooks/useTags.ts';
import { useLogiciels } from '../hooks/useLogiciels.ts';
import { usePoles } from '../hooks/usePoles.ts';
import api from '../lib/api.ts';
import DateInput from './DateInput.tsx';
import TokenField from './TokenField.tsx';
import type { Projet, Tache, StatutProjet } from '../lib/types.ts';
import { STATUT_LABELS, STATUTS_PROJET } from '../lib/types.ts';

const projetSchema = z.object({
  titre: z.string().min(1, 'Titre requis').max(255),
  description: z.string().optional(),
  poleId: z.string().min(1, 'Pôle requis'),
  tagIds: z.array(z.string().uuid()).optional(),
  logicielId: z.string().optional(),
  referentId: z.string().optional(),
  dateButoire: z.string().optional(),
  dateDebut: z.string().optional(),
  duree: z.number({ error: 'Durée requise' }).int().positive('Durée requise (≥ 1 j)'),
  statut: z.enum(['non_valide', 'a_planifier', 'planifie', 'en_cours', 'termine'] as const),
});

type ProjetForm = z.infer<typeof projetSchema>;

const STATUT_TACHE_COLORS = {
  a_faire: 'bg-gray-100 text-gray-600',
  en_cours: 'bg-orange-100 text-orange-700',
  termine: 'bg-green-100 text-green-700',
};
const STATUT_TACHE_LABELS = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' };

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  projet?: Projet;
}

function toInputDate(iso?: string): string {
  if (!iso) return '';
  try { return format(new Date(iso), 'yyyy-MM-dd'); } catch { return ''; }
}

export default function ProjetFormModal({ open, onClose, onSaved, projet }: Props) {
  const isEdit = !!projet;
  const { ressources } = useRessources();
  const { tags } = useTags('projet');
  const { logiciels } = useLogiciels();
  const { poles } = usePoles();
  const [selectedPoleId, setSelectedPoleId] = useState<string>(projet?.pole?.id ?? '');

  const [localTaches, setLocalTaches] = useState<Tache[]>([]);
  const [tacheForm, setTacheForm] = useState<{ open: boolean; tache?: Tache }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<Tache | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProjetForm>({
    resolver: zodResolver(projetSchema),
    defaultValues: { statut: 'non_valide', tagIds: [] },
  });

  const selectedTagIds = watch('tagIds') ?? [];
  const tagItems = tags.map((t) => ({ id: t.id, nom: t.nom }));
  const watchedPoleId = watch('poleId');
  const poleRessources = ressources.filter((r) =>
    r.poles?.some((p) => p.pole.id === (watchedPoleId || selectedPoleId))
  );

  // Durées calculées depuis les tâches locales (réactif)
  const dureeCalculee = localTaches.reduce((s, t) => s + (t.duree ?? 0), 0);
  const dureeConsommee = localTaches.reduce(
    (s, t) => s + (t.activites ?? []).reduce((sa, a) => sa + a.duree, 0), 0,
  );

  useEffect(() => {
    if (open) {
      setLocalTaches(projet?.taches ?? []);
      setSelectedPoleId(projet?.pole?.id ?? '');
      reset(
        projet
          ? {
              titre: projet.titre,
              description: projet.description ?? '',
              poleId: projet.pole?.id ?? '',
              tagIds: projet.tags.map((t) => t.id),
              logicielId: projet.logiciels?.[0]?.id ?? '',
              referentId: projet.referent?.id ?? '',
              dateButoire: toInputDate(projet.dateButoire),
              dateDebut: toInputDate(projet.dateDebut),
              duree: projet.duree ?? undefined,
              statut: projet.statut,
            }
          : { statut: 'non_valide', titre: '', description: '', poleId: '', tagIds: [], logicielId: '', referentId: '', duree: undefined },
      );
    }
  }, [open, projet, reset]);

  // Point 4 : quand l'utilisateur saisit une date de début et que le statut est
  // non_valide ou a_planifier, passer automatiquement à planifie.
  const handleDateDebutChange = (value: string, fieldOnChange: (v: string) => void) => {
    fieldOnChange(value);
    if (value) {
      const currentStatut = watch('statut');
      if (currentStatut === 'non_valide' || currentStatut === 'a_planifier') {
        setValue('statut', 'planifie');
      }
    }
  };

  const refreshLocalTaches = async () => {
    if (!projet) return;
    const { data } = await api.get<Projet>(`/projets/${projet.id}`);
    setLocalTaches(data.taches ?? []);
    onSaved();
  };

  // Tri topologique : les tâches sans dépendances (parents) apparaissent avant leurs dépendantes
  const sortedTaches = (() => {
    const result: Tache[] = [];
    const done = new Set<string>();
    let todo = [...localTaches];
    while (todo.length > 0) {
      const batch = todo.filter((t) => t.dependances.every((d) => done.has(d.precedentId)));
      if (batch.length === 0) { result.push(...todo); break; }
      batch.forEach((t) => { result.push(t); done.add(t.id); });
      todo = todo.filter((t) => !done.has(t.id));
    }
    return result;
  })();

  // Initiales d'un nom ("Jean Dupont" → "JD")
  const initiales = (nom: string) =>
    nom.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('');

  const handleDeleteTache = async () => {
    if (!deleteTarget || !projet) return;
    setDeleting(true);
    try {
      await api.delete(`/projets/${projet.id}/taches/${deleteTarget.id}`);
      await refreshLocalTaches();
      setDeleteTarget(null);
      setDeleteError(undefined);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const onSubmit = async (data: ProjetForm) => {
    const { logicielId, referentId, ...rest } = data;
    const payload = {
      ...rest,
      logicielIds: logicielId ? [logicielId] : [],
      referentId: referentId || undefined,
      dateButoire: data.dateButoire ? new Date(data.dateButoire).toISOString() : undefined,
      dateDebut: data.dateDebut ? new Date(data.dateDebut).toISOString() : undefined,
    };

    if (isEdit) {
      await api.patch(`/projets/${projet.id}`, payload);
    } else {
      await api.post('/projets', payload);
    }
    onSaved();
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isEdit ? 'Modifier le projet' : 'Nouveau projet'}
        size={isEdit ? 'xl' : 'lg'}
      >
        <div className={isEdit ? 'grid grid-cols-2 gap-6 items-start' : undefined}>

          {/* Colonne gauche : champs du projet */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
            <FormField label="Titre" error={errors.titre?.message} required>
              <input className={inputClass} {...register('titre')} placeholder="Nom du projet" />
            </FormField>

            <FormField label="Description" error={errors.description?.message}>
              <textarea
                className={`${inputClass} resize-none`}
                rows={2}
                {...register('description')}
                placeholder="Description optionnelle"
              />
            </FormField>

            <div className="grid grid-cols-3 gap-3">
              <FormField label="Pôle" error={(errors as Record<string, { message?: string }>).poleId?.message} required>
                <select
                  className={selectClass}
                  {...register('poleId')}
                  onChange={(e) => {
                    setSelectedPoleId(e.target.value);
                    setValue('poleId', e.target.value);
                    setValue('referentId', '');
                  }}
                >
                  <option value="">— Sélectionner —</option>
                  {poles.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Référent" error={errors.referentId?.message}>
                <select className={selectClass} {...register('referentId')} disabled={!watchedPoleId && !selectedPoleId}>
                  <option value="">— Aucun —</option>
                  {poleRessources.map((r) => (
                    <option key={r.id} value={r.id}>{r.nom}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Logiciel" error={errors.logicielId?.message}>
                <select className={selectClass} {...register('logicielId')}>
                  <option value="">— Aucun —</option>
                  {logiciels.map((l) => (
                    <option key={l.id} value={l.id}>{l.nom}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Point 5 : pas de bouton raccourcis sur la date de début */}
              <FormField label="Date de début" error={errors.dateDebut?.message}>
                <Controller
                  name="dateDebut"
                  control={control}
                  render={({ field }) => (
                    <DateInput
                      value={field.value ?? ''}
                      onChange={(v) => handleDateDebutChange(v, field.onChange)}
                      showShortcuts={false}
                    />
                  )}
                />
              </FormField>

              <FormField label="Date butoire" error={errors.dateButoire?.message}>
                <Controller
                  name="dateButoire"
                  control={control}
                  render={({ field }) => (
                    <DateInput value={field.value ?? ''} onChange={field.onChange} />
                  )}
                />
              </FormField>

              <FormField label="Durée (jours)" error={errors.duree?.message} required>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  {...register('duree', { setValueAs: (v: string) => v === '' ? undefined : Number(v) })}
                  placeholder="ex: 14"
                />
              </FormField>
            </div>

            {isEdit && (
              <FormField label="Statut" error={errors.statut?.message}>
                <select className={selectClass} {...register('statut')}>
                  {STATUTS_PROJET.map((s) => (
                    <option key={s} value={s}>{STATUT_LABELS[s as StatutProjet]}</option>
                  ))}
                </select>
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

          {/* Colonne droite : tâches (mode édition uniquement) */}
          {isEdit && (
            <div className="border-l border-gray-100 pl-6 flex flex-col gap-2">

              {/* Point 2 & 3 : durées calculées (réactives) */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Durée calculée</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {dureeCalculee > 0 ? `${dureeCalculee} j` : <span className="text-gray-300">—</span>}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Durée consommée</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {dureeConsommee > 0 ? `${dureeConsommee.toFixed(2)} j` : <span className="text-gray-300">—</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between -mx-2 px-3 py-2 bg-gray-100 rounded-lg border border-gray-200">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <span className="w-1 h-3.5 bg-brand-500 rounded-full inline-block" />
                  Tâches
                  {localTaches.length > 0 && (
                    <span className="font-normal text-gray-400 normal-case">
                      {localTaches.filter((t) => t.statut === 'termine').length}/{localTaches.length}
                    </span>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={() => setTacheForm({ open: true })}
                  className="text-xs px-2.5 py-1 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
                >
                  + Ajouter
                </button>
              </div>

              {localTaches.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-6">Aucune tâche</p>
              ) : (
                <div className="overflow-y-auto max-h-72 space-y-1 pr-1">
                  {sortedTaches.map((tache) => (
                    <div
                      key={tache.id}
                      className="group p-2 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-xs font-medium text-gray-800 truncate">{tache.titre}</span>
                            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUT_TACHE_COLORS[tache.statut]}`}>
                              {STATUT_TACHE_LABELS[tache.statut]}
                            </span>
                          </div>
                          <div className="flex gap-2 mt-0.5 text-[10px] text-gray-400 flex-wrap">
                            {tache.duree && <span>{tache.duree} j</span>}
                            {tache.dateDebut && (
                              <span>{format(new Date(tache.dateDebut), 'dd MMM', { locale: fr })}</span>
                            )}
                            {tache.ressources.length > 0 && (
                              <span className="flex gap-1">
                                {tache.ressources.map((r) => (
                                  <span
                                    key={r.ressource.id}
                                    title={r.ressource.nom}
                                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-100 text-brand-700 font-semibold text-[9px]"
                                  >
                                    {initiales(r.ressource.nom)}
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>
                          {/* Dépendances — lecture seule */}
                          {tache.dependances.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tache.dependances.map((dep) => (
                                <span
                                  key={dep.precedentId}
                                  className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full"
                                >
                                  ↩ {dep.precedent.titre}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={() => setTacheForm({ open: true, tache })}
                            className="text-[10px] px-1.5 py-1 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(tache)}
                            className="text-[10px] px-1.5 py-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </Modal>

      {isEdit && (
        <>
          <TacheFormModal
            open={tacheForm.open}
            onClose={() => setTacheForm({ open: false })}
            onSaved={refreshLocalTaches}
            projetId={projet.id}
            tache={tacheForm.tache}
            projetDateDebut={projet.dateDebut}
            projetTaches={localTaches}
          />

          <ConfirmDialog
            open={!!deleteTarget}
            onClose={() => { setDeleteTarget(null); setDeleteError(undefined); }}
            onConfirm={handleDeleteTache}
            title="Supprimer la tâche"
            message={`Confirmer la suppression de "${deleteTarget?.titre}" ? Action irréversible.`}
            loading={deleting}
            error={deleteError}
          />
        </>
      )}
    </>
  );
}
