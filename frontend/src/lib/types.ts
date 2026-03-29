export type Role = 'responsable' | 'utilisateur';

export type StatutProjet = 'non_valide' | 'a_planifier' | 'planifie' | 'en_cours' | 'termine';
export type StatutTache = 'a_faire' | 'en_cours' | 'termine';
export type TypeCategorie = 'projet' | 'tache';

export const STATUTS_PROJET: StatutProjet[] = [
  'non_valide',
  'a_planifier',
  'planifie',
  'en_cours',
  'termine',
];

export const STATUT_LABELS: Record<StatutProjet, string> = {
  non_valide: 'Non validé',
  a_planifier: 'À planifier',
  planifie: 'Planifié',
  en_cours: 'En cours',
  termine: 'Terminé',
};

export const STATUT_COLORS: Record<StatutProjet, string> = {
  non_valide: 'bg-gray-100 text-gray-700',
  a_planifier: 'bg-yellow-100 text-yellow-700',
  planifie: 'bg-blue-100 text-blue-700',
  en_cours: 'bg-orange-100 text-orange-700',
  termine: 'bg-green-100 text-green-700',
};

export interface Ressource {
  id: string;
  nom: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface Categorie {
  id: string;
  nom: string;
  type: TypeCategorie;
}

export interface TacheRessource {
  ressource: Pick<Ressource, 'id' | 'nom'>;
}

export interface TacheDependanceItem {
  tacheId: string;
  precedentId: string;
  precedent: { id: string; titre: string };
}

export interface Tache {
  id: string;
  projetId: string;
  titre: string;
  description?: string;
  categorie?: Categorie;
  dateDebut?: string;
  duree?: number;
  statut: StatutTache;
  ressources: TacheRessource[];
  dependances: TacheDependanceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Projet {
  id: string;
  titre: string;
  description?: string;
  categorie?: Categorie;
  responsable: Pick<Ressource, 'id' | 'nom' | 'email'>;
  dateButoire?: string;
  dateDebut?: string;
  duree?: number;
  statut: StatutProjet;
  taches: Tache[];
  createdAt: string;
  updatedAt: string;
}

export interface Activite {
  id: string;
  description: string;
  date: string;
  duree: number;
  tacheId?: string;
  ressource: Pick<Ressource, 'id' | 'nom' | 'email'>;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  nom: string;
  email: string;
  role: Role;
}
