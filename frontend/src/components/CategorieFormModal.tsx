import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from './Modal.tsx';
import FormField, { inputClass, selectClass } from './FormField.tsx';
import TokenField from './TokenField.tsx';
import type { Tag, TypeTag, Pole } from '../lib/types.ts';

const tagSchema = z.object({
  nom:     z.string().min(1, 'Nom requis').max(100),
  type:    z.enum(['projet', 'tache'] as const),
  poleIds: z.array(z.string()).optional(),
});

type TagForm = z.infer<typeof tagSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TagForm) => Promise<void>;
  tag?: Tag;
  defaultType?: TypeTag;
  poles: Pole[];
}

export default function CategorieFormModal({ open, onClose, onSubmit, tag, defaultType = 'projet', poles }: Props) {
  const isEdit = !!tag;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TagForm>({ resolver: zodResolver(tagSchema) });

  useEffect(() => {
    if (open) {
      reset(
        tag
          ? { nom: tag.nom, type: tag.type, poleIds: (tag.poles ?? []).map((p) => p.id) }
          : { nom: '', type: defaultType, poleIds: [] },
      );
    }
  }, [open, tag, defaultType, reset]);

  const handleFormSubmit = async (data: TagForm) => {
    await onSubmit(data);
    onClose();
  };

  const poleItems = poles.map((p) => ({ id: p.id, nom: p.nom }));
  const selectedPoleIds = watch('poleIds') ?? [];

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier le tag' : 'Nouveau tag'} size="sm">
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
