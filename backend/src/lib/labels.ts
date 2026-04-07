export const STATUT_LABELS_FR: Record<string, string> = {
  non_valide: 'Non validé',
  a_planifier: 'À planifier',
  planifie: 'Planifié',
  en_cours: 'En cours',
  termine: 'Terminé',
  a_faire: 'À faire',
};

export function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
