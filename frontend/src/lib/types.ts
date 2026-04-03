export type Role = 'responsable' | 'utilisateur' | 'direction_generale';

export interface Pole {
  id: string;
  nom: string;
}

export type StatutProjet = 'non_valide' | 'a_planifier' | 'planifie' | 'en_cours' | 'termine';
export type StatutTache = 'a_faire' | 'en_cours' | 'termine';
export type TypeTag = 'projet' | 'tache';
export type TypeDemande = 'terminer' | 'modifier_duree' | 'modifier_date_debut';
export type StatutDemande = 'en_attente' | 'valide' | 'refuse';

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

export const ROLE_LABELS: Record<Role, string> = {
  responsable: 'Responsable',
  utilisateur: 'Utilisateur',
  direction_generale: 'Direction',
};

export interface Ressource {
  id: string;
  nom: string;
  email: string;
  role: Role;
  createdAt: string;
  responsablePoles?: { pole: Pole }[];
  poles?: { pole: Pole }[];
}

export interface Tag {
  id: string;
  nom: string;
  type: TypeTag;
  poles?: Pick<Pole, 'id' | 'nom'>[];
}

export interface Categorie {
  id: string;
  nom: string;
  poles?: Pick<Pole, 'id' | 'nom'>[];
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
  tags: Tag[];
  dateDebut?: string;
  dateButoire?: string;
  duree?: number;
  statut: StatutTache;
  enAttenteValidation?: boolean;
  ressources: TacheRessource[];
  dependances: TacheDependanceItem[];
  activites?: Activite[];
  projet?: { id: string; titre: string; statut: StatutProjet; pole?: Pole };
  createdAt: string;
  updatedAt: string;
}

export interface DemandeValidation {
  id: string;
  tacheId: string;
  auteurId: string;
  type: TypeDemande;
  statut: StatutDemande;
  valeurDemandee?: string;
  statutOrigine?: string;
  commentaireRefus?: string;
  archivedByAuteur: boolean;
  tache?: { id: string; titre: string; projetId: string; duree?: number; dateDebut?: string; projet?: { id: string; titre: string } };
  auteur?: { id: string; nom: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface Projet {
  id: string;
  titre: string;
  description?: string;
  pole?: Pole;
  poleId?: string;
  tags:       Tag[];
  categories: Categorie[];
  referent?: Pick<Ressource, 'id' | 'nom' | 'email'>;
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

export interface ProjetCorbeille {
  id: string;
  titre: string;
  description?: string;
  statut: StatutProjet;
  tags: Tag[];
  referent?: Pick<Ressource, 'id' | 'nom'>;
  deletedAt: string;
  taches: { id: string }[];
}

export interface TacheCorbeille {
  id: string;
  titre: string;
  description?: string;
  statut: StatutTache;
  tags: Tag[];
  deletedAt: string;
  projet?: { id: string; titre: string };
  activites: { id: string }[];
}

export type ActionType =
  | 'STATUT_PROJET'
  | 'STATUT_TACHE'
  | 'DATE_DEBUT_PROJET'
  | 'DATE_DEBUT_TACHE'
  | 'SUPPRESSION_PROJET'
  | 'SUPPRESSION_TACHE'
  | 'RESTAURATION_PROJET'
  | 'RESTAURATION_TACHE';

export interface JournalAction {
  id: string;
  action: ActionType;
  auteurId: string | null;
  auteurNom: string;
  entityId: string;
  entityTitre: string;
  ancienneValeur: string | null;
  nouvelleValeur: string | null;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  nom: string;
  email: string;
  role: Role;
}
