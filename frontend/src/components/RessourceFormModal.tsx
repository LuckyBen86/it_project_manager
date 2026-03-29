import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from './Modal.tsx';
import FormField, { inputClass, selectClass } from './FormField.tsx';
import type { Ressource } from '../lib/types.ts';

const createSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(255),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, '8 caractères minimum'),
  role: z.enum(['responsable', 'utilisateur'] as const),
});

const editSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(255),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, '8 caractères minimum').optional().or(z.literal('')),
  role: z.enum(['responsable', 'utilisateur'] as const),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm = z.infer<typeof editSchema>;
type RessourceForm = CreateForm | EditForm;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: RessourceForm) => Promise<void>;
  ressource?: Ressource;
}

export default function RessourceFormModal({ open, onClose, onSubmit, ressource }: Props) {
  const isEdit = !!ressource;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RessourceForm>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
  });

  useEffect(() => {
    if (open) {
      reset(
        ressource
          ? { nom: ressource.nom, email: ressource.email, password: '', role: ressource.role }
          : { nom: '', email: '', password: '', role: 'utilisateur' },
      );
    }
  }, [open, ressource, reset]);

  const handleFormSubmit = async (data: RessourceForm) => {
    // Ne pas envoyer un mot de passe vide en édition
    if (isEdit && !data.password) {
      const { password: _, ...rest } = data as EditForm;
      await onSubmit(rest as RessourceForm);
    } else {
      await onSubmit(data);
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier la ressource' : 'Nouvelle ressource'} size="sm">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
        <FormField label="Nom complet" error={errors.nom?.message} required>
          <input className={inputClass} {...register('nom')} placeholder="Prénom Nom" autoFocus />
        </FormField>

        <FormField label="Email" error={errors.email?.message} required>
          <input type="email" className={inputClass} {...register('email')} placeholder="prenom.nom@entreprise.fr" />
        </FormField>

        <FormField
          label={isEdit ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe'}
          error={errors.password?.message}
          required={!isEdit}
        >
          <input
            type="password"
            className={inputClass}
            {...register('password')}
            placeholder={isEdit ? 'Laisser vide pour conserver' : '8 caractères minimum'}
            autoComplete="new-password"
          />
        </FormField>

        <FormField label="Rôle" error={errors.role?.message} required>
          <select className={selectClass} {...register('role')}>
            <option value="utilisateur">Utilisateur (lecture seule)</option>
            <option value="responsable">Responsable (écriture)</option>
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
