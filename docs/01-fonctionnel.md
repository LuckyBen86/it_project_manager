# Documentation Fonctionnelle — IT Project Manager

> Source de vérité fonctionnelle pour toute reconstruction de l'application.
> Le fichier `../cdc_fonctionnel.md` contient les règles de gestion formelles (RG-*).
> Ce fichier décrit les **vues**, les **flux utilisateur** et les **comportements UI** non couverts par les RG.

---

## 1. Vue d'ensemble de l'application

Outil interne de gestion de projets IT à destination de deux profils :
- **Responsables / Direction** : pilotage, planification, validation
- **Utilisateurs** (équipe technique) : consultation de leurs tâches, saisie d'activités, demandes de validation

L'application est **mono-page (SPA)** avec navigation sans rechargement. Elle est utilisée en interne, pas exposée publiquement.

---

## 2. Rôles et niveaux d'accès

| Rôle | Clé interne | Droits |
|------|-------------|--------|
| Direction générale | `direction_generale` | Accès total à tous les pôles, toutes les données |
| Responsable | `responsable` | Gestion des projets/tâches de ses pôles uniquement |
| Utilisateur | `utilisateur` | Lecture seule + saisie d'activités sur ses tâches assignées |

### Subtilité : Référent de projet
Un utilisateur peut être désigné **référent** d'un projet. Dans ce cas, il obtient des droits d'écriture sur ce projet (PATCH projet, CRUD tâches) même sans rôle `responsable`.

### Périmètre de visibilité

| Rôle | Projets visibles |
|------|-----------------|
| `direction_generale` | Tous les projets |
| `responsable` | Projets appartenant à ses pôles (via `responsablePole`) |
| `utilisateur` | Projets où il est assigné à ≥1 tâche OU référent |

---

## 3. Pages et vues

### 3.1 Page Login
- Formulaire email / mot de passe
- Rate limiting : 10 tentatives / 15 min
- Redirection vers Kanban après succès
- Message d'erreur générique (pas de distinction email/mdp inconnu)

### 3.2 Vue Kanban (`/`)
Tableau avec **5 colonnes fixes** (ordre immuable) :

| # | Statut | Couleur |
|---|--------|---------|
| 1 | Non validé | Gris |
| 2 | À planifier | Jaune |
| 3 | Planifié | Bleu |
| 4 | En cours | Orange |
| 5 | Terminé | Vert |

**Carte projet affiche :**
- Titre
- Référent (nom)
- Date butoire
- Badge statut coloré
- Progression tâches : `X / Y terminées`
- Tags (badges)
- Pôle

**Interactions :**
- Clic sur carte → panneau latéral détail projet (`ProjetDetailPanel`)
- Drag & drop entre colonnes (responsable/DG uniquement) → PATCH /projets/:id avec nouveau statut
- Bouton "+" → modal création projet
- Filtres : par pôle, par tag, par statut, recherche texte

**Toggle Kanban/Liste :** la vue peut switcher entre affichage Kanban et liste tabulaire des projets.

### 3.3 Vue Gantt (`/gantt`)
**Périmètre affiché :** projets avec statut `a_planifier`, `planifie`, `en_cours` uniquement.

**Structure :**
- Axe de temps horizontal (semaines ou mois)
- Une ligne par projet → barre horizontale proportionnelle à la durée
- Expand/collapse → sous-lignes pour les tâches du projet

**Zoom :**
- Vue Semaine : 40px/jour ouvré, 4px week-end
- Vue Mois : 14px/jour ouvré, 4px week-end

**Drag & drop sur les barres :**
- Glisser horizontalement → modifie `dateDebut` (durée conservée)
- Étirer bord droit → modifie `duree` (dateDebut fixe)
- Appel : `PATCH /projets/:id/gantt` ou `PATCH /projets/:projetId/taches/:id`

**Dépendances de tâches :**
- Flèches SVG entre tâches liées
- La date de début affichée est calculée côté frontend (`computeTaskStartDates`) en tenant compte des dépendances — même si la `dateDebut` en base est obsolète

### 3.4 Panneau détail projet (`ProjetDetailPanel`)
Slide-over latéral ouvert au clic sur une carte Kanban.

**Contenu :**
- Informations projet (titre, description, pôle, référent, dates, durée, statut)
- Métriques durée : durée réelle totale des tâches, temps consommé total (somme des activités)
- Barre d'avancement du projet : `avancementProjet %` (pondérée par durée si auto)
- Liste des tâches du projet
- Pour chaque tâche : statut, ressources assignées, dates, barre d'avancement

**Barre d'avancement par tâche :**
- Couleur brand/verte si avancement normal, **rouge** si temps consommé > durée prévue
- Icône ⚠ rouge à droite du % en cas de dépassement
- Texte sous la barre : `X j consommés / Y j prévus` (affiché uniquement si ≥1 activité)
- En cas de dépassement : texte rouge + `(+Z j)`

**Actions disponibles (responsable/référent) :**
- Modifier le projet → ouvre `ProjetFormModal`
- Supprimer le projet (avec confirmation + bloc si activités présentes)
- Ajouter une tâche
- Modifier/supprimer une tâche

### 3.5 Page Mes Tâches (`/mes-taches`)
Tâches assignées à l'utilisateur connecté, quelle que soit son rôle.

**Affichage :** regroupement par statut (`à faire`, `en cours`, `terminé`)

**Actions :**
- Ajouter une activité sur une tâche (si tâche non terminée)
- Modifier une activité existante (si auteur = utilisateur courant)
- Changer le statut de la tâche (si assigné)
- Créer une **demande de validation** (pour terminer, modifier durée, modifier date début)

### 3.6 Page Synthèse (`/synthese`)
Dashboard de KPIs. Données différenciées selon le rôle.

**Métriques tâches (tous rôles) :**
- Total, en cours, terminé, à faire
- En dépassement (activités > durée planifiée)
- En retard (dateButoire < aujourd'hui)
- Prochaine échéance (dateButoire dans les 5 prochains jours ouvrés)
- Sans données (ni durée ni dateDebut, hors terminées)

**Métriques projets (responsable/DG uniquement) :**
- Même structure que tâches

**Demandes en attente :** count selon le rôle.

### 3.7 Vue Charge (`/charge` ou onglet dans Synthèse)
Matrice ressource × semaine montrant la charge prévisionnelle en jours.

- Axe X : semaines (clé = lundi de la semaine, format `YYYY-MM-DD`)
- Axe Y : ressources
- Valeur cellule : nombre de jours ouvrés prévus sur la semaine

Alimenté par les assignations de tâches ayant `dateDebut` + `duree`.

### 3.8 Page Corbeille (`/corbeille`)
Accessible aux `responsable` et `direction_generale` uniquement.

Deux sections :
- **Projets supprimés** (avec leurs tâches en cascade)
- **Tâches supprimées indépendamment** (sans projet supprimé)

**Actions :**
- Restaurer un projet → restaure aussi toutes ses tâches supprimées en cascade
- Restaurer une tâche → uniquement si le projet parent n'est pas supprimé

### 3.9 Page Demandes Responsable (`/demandes`)
Accessible aux `responsable` et `direction_generale`.

Liste les demandes de validation en attente sur leurs projets.

**Actions par demande :**
- Valider → applique la modification demandée (statut, durée, date)
- Refuser → avec commentaire optionnel

### 3.10 Page Mes Demandes (`/mes-demandes`)
Demandes créées par l'utilisateur connecté.

- Statuts : `en_attente`, `validé`, `refusé`
- Affiche le commentaire de refus si refusée
- Archivage possible par l'auteur

### 3.11 Page Administration (`/admin`)
Accessible aux `responsable` et `direction_generale`. Onglets :

| Onglet | Contenu |
|--------|---------|
| Tags | CRUD des tags (type `projet` ou `tache`), association à des pôles |
| Pôles | CRUD des pôles |
| Ressources | CRUD des utilisateurs, promotion de rôle |
| Logiciels | (éventuel CRUD) |
| Journal | Journal d'actions avec filtres et pagination |
| Catégories | CRUD des catégories de projets |

---

## 4. Formulaires clés

### Formulaire Projet
| Champ | Type | Obligatoire |
|-------|------|-------------|
| Titre | text | Oui |
| Pôle | select | Oui |
| Référent | select (ressource) | Non |
| Description | textarea | Non |
| Date de début | date | Non |
| Durée (jours ouvrés) | number | Non |
| Date butoire | date | Non |
| Tags | multi-select | Non |
| Catégories | multi-select | Non |

### Formulaire Tâche
| Champ | Type | Obligatoire |
|-------|------|-------------|
| Titre | text | Oui |
| Description | textarea | Non |
| Ressources assignées | multi-select | Non |
| Tags | multi-select | Non |
| Date de début | date | Non (≥ dateDebut projet) |
| Durée | number | Non |
| Date butoire | date | Non |
| Dépendances | multi-select (autres tâches) | Non |
| Avancement auto | toggle | Non (défaut : activé) |
| Avancement manuel | number 0-100 | Non (visible si auto désactivé) |

### Formulaire Activité
| Champ | Type | Obligatoire |
|-------|------|-------------|
| Description | text | Oui |
| Date | date | Oui |
| Durée (heures décimales) | number (step 0.01) | Oui, > 0 |

---

## 5. Flux métier importants

### 5.1 Cycle de vie d'un projet
```
non_valide → a_planifier → planifie → en_cours → termine
```
- Le statut peut être changé manuellement via drag&drop Kanban
- Quand `dateDebut` est renseignée (via Gantt ou form) et qu'il n'y a pas d'activités → statut forcé à `planifie`
- Quand `dateDebut` est renseignée et qu'il y a déjà des activités → statut forcé à `en_cours`

### 5.2 Cycle de vie d'une tâche
```
a_faire → en_cours → termine
```
- `a_faire → en_cours` : automatique à la première saisie d'activité (durée > 0)
- `→ termine` : via demande de validation (utilisateur) OU directement par responsable/référent

### 5.3 Workflow demande de validation
1. Utilisateur assigné à une tâche crée une demande (terminer / modifier durée / modifier date)
2. La tâche passe en `enAttenteValidation = true`
3. Responsable/DG voit la demande dans `/demandes`
4. Il valide (modification appliquée) ou refuse (avec commentaire)
5. `enAttenteValidation` repasse à `false` si plus aucune demande en attente

### 5.4 Calcul d'avancement

#### Avancement d'une tâche
- **Mode auto** (`avancementAutoTache = true`) : `avancementTache = min(100, round(Σ activités.duree / tache.duree × 100))`
  - Nécessite que `duree` soit renseignée, sinon reste à 0
  - Recalculé à chaque ajout/modification d'activité (backend) et à la volée au GET
- **Mode manuel** (`avancementAutoTache = false`) : valeur saisie directement (0-100) via le formulaire tâche

#### Avancement d'un projet
- **Mode auto** (`avancementAutoProjet = true`) : moyenne pondérée des `avancementTache` par leur `duree`
  - `avancementProjet = round(Σ(avancementTache × duree) / Σduree)` sur les tâches avec duree > 0
  - Les tâches sans durée sont exclues du calcul
  - Recalculé à la volée au GET ; persisté en DB à chaque modification de tâche
- **Mode manuel** : valeur saisie directement sur le projet

#### Dépassement
Une tâche est **en dépassement** quand `Σ activités.duree > tache.duree`. Indicateur visuel rouge dans le panneau détail projet.

### 5.5 Calcul positions Gantt (frontend)
Logique dans `lib/gantt.ts` :
1. Trier les tâches topologiquement (prédécesseurs avant dépendants)
2. `computeTaskStartDates` : pour chaque tâche, la date de début = `max(dateDebut en base, fin du prédécesseur le plus tardif)`
3. Convertir date → offset px via `dateToOffset` (tient compte des week-ends)
4. Largeur barre = `businessDaysWidth(dateDebut, duree, dayWidth)`

---

## 6. Contraintes de validation cross-entités

- `dateDebut` tâche ≥ `dateDebut` projet (vérifiée backend ET frontend)
- Dépendances tâches : pas de cycle (détection BFS côté backend)
- Activités interdites sur tâche `termine`
- Suppression projet bloquée si ≥1 tâche avec activités (409)
- Suppression tâche bloquée si elle a des activités (409)
- Restauration tâche bloquée si projet parent supprimé (409)

---

## 7. Notifications (AppNotification)
Système léger de notifications in-app. Une notification a :
- `id`, `type`, `titre`, `projetTitre` (optionnel)

Endpoint `GET /notifications` retourne `{ count, items }`.

---

## 8. Recherche globale
Endpoint `GET /search?q=...` retourne `{ projets: [...], taches: [...] }`.
- `projets` : id, titre, pôle
- `taches` : id, titre, projetTitre

Accessible via une barre de recherche dans la navigation.
