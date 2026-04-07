import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from './Modal.tsx';
import FormField, { inputClass } from './FormField.tsx';
import TokenField from './TokenField.tsx';
import type { Tag, TypeTag, Pole } from '../lib/types.ts';

const tagSchema = z.object({
  nom:     z.string().min(1, 'Nom requis').max(100),
  poleIds: z.array(z.string()).optional(),
});

type TagForm = z.infer<typeof tagSchema>;

const TYPE_ITEMS = [
  { id: 'projet', nom: 'Projet' },
  { id: 'tache',  nom: 'Tâche' },
];

const EMPTY_TYPES: TypeTag[] = [];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { nom: string; types: TypeTag[]; poleIds?: string[] }) => Promise<void>;
  tag?: Tag;
  defaultTypes?: TypeTag[];
  poles: Pole[];
}

export default function CategorieFormModal({ open, onClose, onSubmit, tag, defaultTypes = EMPTY_TYPES, poles }: Props) {
  const isEdit = !!tag;

  // Types géré en état local pour un re-render immédiat et fiable
  const [selectedTypes, setSelectedTypes] = useState<TypeTag[]>([]);

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
      setSelectedTypes(tag ? (tag.types ?? []) : defaultTypes);
      reset(
        tag
          ? { nom: tag.nom, poleIds: (tag.poles ?? []).map((p) => p.id) }
          : { nom: '', poleIds: [] },
      );
    }
  }, [open, tag, defaultTypes, reset]);

  const handleFormSubmit = async (data: TagForm) => {
    await onSubmit({ ...data, types: selectedTypes });
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

        <FormField label="Types (vide = tous les types)" error={undefined}>
          <TokenField
            items={TYPE_ITEMS}
            selectedIds={selectedTypes}
            onChange={(ids) => setSelectedTypes(ids as TypeTag[])}
            placeholder="+ Type"
          />
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
