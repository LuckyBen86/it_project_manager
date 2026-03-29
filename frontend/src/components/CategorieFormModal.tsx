import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from './Modal.tsx';
import FormField, { inputClass, selectClass } from './FormField.tsx';
import type { Categorie, TypeCategorie } from '../lib/types.ts';

const categorieSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(100),
  type: z.enum(['projet', 'tache'] as const),
});

type CategorieForm = z.infer<typeof categorieSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CategorieForm) => Promise<void>;
  categorie?: Categorie;
  defaultType?: TypeCategorie;
}

export default function CategorieFormModal({ open, onClose, onSubmit, categorie, defaultType = 'projet' }: Props) {
  const isEdit = !!categorie;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategorieForm>({ resolver: zodResolver(categorieSchema) });

  useEffect(() => {
    if (open) {
      reset(
        categorie
          ? { nom: categorie.nom, type: categorie.type }
          : { nom: '', type: defaultType },
      );
    }
  }, [open, categorie, defaultType, reset]);

  const handleFormSubmit = async (data: CategorieForm) => {
    await onSubmit(data);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier la catégorie' : 'Nouvelle catégorie'} size="sm">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
        <FormField label="Nom" error={errors.nom?.message} required>
          <input className={inputClass} {...register('nom')} placeholder="ex: Infrastructure" autoFocus />
        </FormField>

        <FormField label="Type" error={errors.type?.message} required>
          <select className={selectClass} {...register('type')} disabled={isEdit}>
            <option value="projet">Projet</option>
            <option value="tache">Tâche</option>
          </select>
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
    </Modal>
  );
}
