import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import Modal from './Modal.tsx';
import FormField, { inputClass, selectClass } from './FormField.tsx';
import { useRessources } from '../hooks/useRessources.ts';
import { useCategories } from '../hooks/useCategories.ts';
import api from '../lib/api.ts';
import type { Projet, StatutProjet } from '../lib/types.ts';
import { STATUT_LABELS, STATUTS_PROJET } from '../lib/types.ts';

const projetSchema = z.object({
  titre: z.string().min(1, 'Titre requis').max(255),
  description: z.string().optional(),
  categorieId: z.string().uuid().optional().or(z.literal('')),
  responsableId: z.string().uuid('Responsable requis'),
  dateButoire: z.string().optional(),
  dateDebut: z.string().optional(),
  duree: z.coerce.number().int().positive().optional().or(z.literal('')),
  statut: z.enum(['non_valide', 'a_planifier', 'planifie', 'en_cours', 'termine'] as const),
});

type ProjetForm = z.infer<typeof projetSchema>;

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
  const { categories } = useCategories('projet');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjetForm>({
    resolver: zodResolver(projetSchema),
    defaultValues: { statut: 'non_valide' },
  });

  useEffect(() => {
    if (open) {
      reset(
        projet
          ? {
              titre: projet.titre,
              description: projet.description ?? '',
              categorieId: projet.categorie?.id ?? '',
              responsableId: projet.responsable.id,
              dateButoire: toInputDate(projet.dateButoire),
              dateDebut: toInputDate(projet.dateDebut),
              duree: projet.duree ?? '',
              statut: projet.statut,
            }
          : { statut: 'non_valide', titre: '', description: '', categorieId: '', duree: '' },
      );
    }
  }, [open, projet, reset]);

  const onSubmit = async (data: ProjetForm) => {
    const payload = {
      ...data,
      categorieId: data.categorieId || undefined,
      dateButoire: data.dateButoire ? new Date(data.dateButoire).toISOString() : undefined,
      dateDebut: data.dateDebut ? new Date(data.dateDebut).toISOString() : undefined,
      duree: data.duree === '' ? undefined : Number(data.duree),
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
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Modifier le projet' : 'Nouveau projet'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Titre" error={errors.titre?.message} required>
          <input className={inputClass} {...register('titre')} placeholder="Nom du projet" />
        </FormField>

        <FormField label="Description" error={errors.description?.message}>
          <textarea
            className={`${inputClass} resize-none`}
            rows={3}
            {...register('description')}
            placeholder="Description optionnelle"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Responsable" error={errors.responsableId?.message} required>
            <select className={selectClass} {...register('responsableId')}>
              <option value="">— Sélectionner —</option>
              {ressources.map((r) => (
                <option key={r.id} value={r.id}>{r.nom}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Catégorie" error={errors.categorieId?.message}>
            <select className={selectClass} {...register('categorieId')}>
              <option value="">— Aucune —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Date de début" error={errors.dateDebut?.message}>
            <input type="date" className={inputClass} {...register('dateDebut')} />
          </FormField>

          <FormField label="Date butoire" error={errors.dateButoire?.message}>
            <input type="date" className={inputClass} {...register('dateButoire')} />
          </FormField>

          <FormField label="Durée (jours)" error={errors.duree?.message}>
            <input
              type="number"
              min={1}
              className={inputClass}
              {...register('duree')}
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
    </Modal>
  );
}
