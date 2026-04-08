# Référence API — IT Project Manager

> Toutes les routes sont préfixées `/api` (via le reverse proxy Nginx).
> Toutes les routes (sauf `/auth/login` et `/auth/refresh`) nécessitent : `Authorization: Bearer <access_token>`
> Les erreurs retournent `{ message: string }`.

---

## Auth

### POST /auth/login
Authentification par email/mot de passe.

**Body :**
```json
{ "email": "user@example.com", "password": "secret" }
```

**Réponse 200 :**
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id": "uuid", "nom": "Alice", "email": "...", "role": "responsable" }
}
```

**Erreurs :** 401 (identifiants invalides), 429 (rate limit)

---

### POST /auth/refresh
Renouvelle l'access token via le refresh token.

**Body :** `{ "refreshToken": "..." }`

**Réponse 200 :** `{ "accessToken": "...", "refreshToken": "..." }`

**Erreurs :** 401 (refresh invalide/expiré)

---

### POST /auth/logout
Invalide la session (met à jour `loggedOutAt`). Nécessite auth.

**Réponse :** 204 No Content

---

## Projets

### GET /projets
Retourne les projets visibles selon le rôle de l'utilisateur.

**Query params :** aucun (filtrage côté backend selon rôle)

**Réponse 200 :** `Projet[]`

Chaque `Projet` contient :
```typescript
{
  id, titre, description?, poleId,
  pole: { id, nom },
  referent?: { id, nom, email },
  tags: Tag[],
  categories: Categorie[],
  dateButoire?, dateDebut?, duree?,
  statut: StatutProjet,
  avancementProjet: number,      // % 0-100, calculé à la volée si avancementAutoProjet = true
  avancementAutoProjet: boolean, // true = pondéré par durée des tâches ; false = manuel
  taches: Tache[],  // tâches non supprimées, avec leurs ressources/tags/dépendances/activités
  createdAt, updatedAt
}
```

Chaque `Tache` dans la liste inclut :
```typescript
{
  id, titre, description?, dateDebut?, dateButoire?, duree?,
  statut: StatutTache,
  avancementTache: number,      // % 0-100, calculé à la volée si avancementAutoTache = true
  avancementAutoTache: boolean, // true = depuis activités (Σduree/duree×100) ; false = manuel
  enAttenteValidation: boolean,
  ressources: TacheRessource[],
  tags: Tag[],
  dependances: TacheDependanceItem[],
  activites: { duree: number }[], // duree uniquement (pour calcul avancement)
  createdAt, updatedAt
}
```

---

### GET /projets/:id
Projet unique par ID.

**Réponse :** `Projet` ou 404

---

### POST /projets
**Rôle requis :** `responsable` ou `direction_generale`

**Body :**
```typescript
{
  titre: string,              // requis
  poleId: string,             // requis
  referentId?: string,
  description?: string,
  dateButoire?: string,       // ISO date
  dateDebut?: string,
  duree?: number,
  avancementAutoProjet?: boolean, // défaut true
  tagIds?: string[],
  categorieIds?: string[]
}
```

**Réponse 201 :** `Projet`

---

### PATCH /projets/:id
Mise à jour d'un projet. Accessible au responsable/DG ou au référent du projet.

**Body :** même structure que POST, tous les champs optionnels. Inclut notamment :
- `avancementAutoProjet` : passer à `false` pour saisir `avancementProjet` manuellement
- `avancementProjet` : valeur manuelle (ignorée si `avancementAutoProjet = true`)

**Logique spéciale :**
- Si `dateDebut` est modifiée ET le projet a des activités → `statut` forcé à `en_cours`
- Si `dateDebut` est modifiée ET pas d'activités → `statut` forcé à `planifie`
- Si `statut` change → entrée dans le journal
- Si `dateDebut` change → entrée dans le journal

**Réponse 200 :** `Projet`

---

### PATCH /projets/:id/gantt
Mise à jour Gantt (dateDebut, duree uniquement). Même règle d'accès que PATCH.

**Body :**
```typescript
{ dateDebut?: string, duree?: number }
```

**Réponse 200 :** `Projet`

---

### DELETE /projets/:id
Soft delete. **Rôle requis :** `responsable` ou `direction_generale`.

**Conditions bloquantes :**
- 409 : si au moins une tâche du projet a des activités

**Effets :**
- `projet.deletedAt = now`, `projet.deletedById = userId`
- Toutes les tâches non supprimées → `deletedAt = now`, `deletedWithProjetId = projetId`
- Entrée journal `SUPPRESSION_PROJET`

**Réponse :** 204

---

## Tâches (sous-ressource projet)

Base URL : `/projets/:projetId/taches`

### GET /projets/:projetId/taches
Tâches non supprimées du projet.

**Réponse 200 :** `Tache[]`

---

### POST /projets/:projetId/taches
**Accès :** responsable/DG ou référent du projet

**Body :**
```typescript
{
  titre: string,
  description?: string,
  dateDebut?: string,           // doit être ≥ dateDebut projet
  dateButoire?: string,
  duree?: number,
  avancementAutoTache?: boolean, // défaut true
  ressourceIds?: string[],
  tagIds?: string[],
  dependances?: string[]        // IDs des tâches prédécesseurs
}
```

**Réponse 201 :** `Tache`

---

### PATCH /projets/:projetId/taches/:id
**Accès :** responsable/DG ou référent du projet

**Body :** même structure que POST, tous optionnels. Inclut notamment :
- `avancementAutoTache` : passer à `false` pour saisir `avancementTache` manuellement
- `avancementTache` : valeur manuelle 0-100 (ignorée si `avancementAutoTache = true`)

**Effets journaux :**
- Changement `statut` → journal `STATUT_TACHE`
- Changement `dateDebut` → journal `DATE_DEBUT_TACHE`

**Réponse 200 :** `Tache`

---

### DELETE /projets/:projetId/taches/:id
**Rôle requis :** `responsable`

**Conditions bloquantes :**
- 409 : si la tâche a des activités

**Réponse :** 204

---

### POST /projets/:projetId/taches/:id/dependances
**Accès :** responsable/DG ou référent

**Body :** `{ "precedentId": "uuid" }`

**Conditions bloquantes :**
- 400 : dépendance sur soi-même
- 400 : cycle détecté (BFS)

**Réponse :** 201

---

### DELETE /projets/:projetId/taches/:id/dependances/:precedentId
**Accès :** responsable/DG ou référent

**Réponse :** 204

---

### GET /projets/:projetId/taches/:id/activites
**Réponse 200 :** `Activite[]` (ordre décroissant par date)

---

### POST /projets/:projetId/taches/:id/activites
**Rôle requis :** `responsable` ou `direction_generale`

**Body :**
```typescript
{ description: string, date: string, duree: number, ressourceId: string }
```

**Effet :** si tâche en `a_faire` et duree > 0 → passage à `en_cours` + journal

**Réponse 201 :** `Activite`

---

### DELETE /projets/:projetId/taches/:id/activites/:activiteId
**Rôle requis :** `responsable` ou `direction_generale`

**Réponse :** 204

---

## Mes tâches

### GET /mes-taches
Tâches assignées à l'utilisateur connecté. Inclut projet, tags, ressources, activités.

**Réponse 200 :** `Tache[]` (triées par statut asc, dateDebut asc)

---

### POST /mes-taches/:tacheId/activites
Saisie d'activité par l'utilisateur lui-même (doit être assigné).

**Body :**
```typescript
{ description: string, date: string, duree: number }
```

**Conditions bloquantes :**
- 403 : non assigné à la tâche
- 403 : tâche terminée
- 404 : tâche introuvable

**Réponse 201 :** `Activite`

---

### PATCH /mes-taches/:tacheId/activites/:activiteId
Modification d'une activité (auteur = utilisateur courant).

**Body :** `{ description?, date?, duree? }`

**Réponse 200 :** `Activite`

---

### PATCH /mes-taches/:tacheId/statut
Changement de statut par l'utilisateur assigné.

**Body :** `{ "statut": "a_faire" | "en_cours" | "termine" }`

**Réponse 200 :** `Tache`

---

### POST /mes-taches/:tacheId/demandes
Création d'une demande de validation.

**Body :**
```typescript
{
  type: 'terminer' | 'modifier_duree' | 'modifier_date_debut',
  valeurDemandee?: string   // durée (int) ou date ISO selon le type
}
```

**Validations :**
- `terminer` : bloqué si tâche déjà terminée
- `modifier_duree` : `valeurDemandee` doit être un entier ≥ 1
- `modifier_date_debut` : date ISO valide, ≥ dateDebut projet

**Effet :** `tache.enAttenteValidation = true`

**Réponse 201 :** `DemandeValidation`

---

## Demandes (responsable/DG)

### GET /demandes
Demandes `en_attente` sur les projets du responsable/DG.

**Réponse 200 :** `DemandeValidation[]` avec tache + auteur inclus

---

### PATCH /demandes/:id/traiter
Valider ou refuser une demande.

**Body :**
```typescript
{
  action: 'valider' | 'refuser',
  commentaireRefus?: string
}
```

**Effets si `valider` :**
- `terminer` → `tache.statut = 'termine'` + journal
- `modifier_duree` → `tache.duree = parseInt(valeurDemandee)`
- `modifier_date_debut` → `tache.dateDebut = new Date(valeurDemandee)`
- `tache.enAttenteValidation = false` (si plus d'autres demandes en attente)

**Effets si `refuser` :**
- `demande.statut = 'refuse'` + `commentaireRefus`
- Si type `terminer` : restaure `tache.statut = statutOrigine`

**Réponse 200 :** `{ message: string }`

---

## Mes demandes

### GET /mes-demandes
Demandes créées par l'utilisateur connecté (tous statuts).

**Réponse 200 :** `DemandeValidation[]`

---

### PATCH /mes-demandes/:id/archiver
Archive une demande traitée (masquage côté auteur).

**Réponse 200 :** `DemandeValidation`

---

## Ressources

### GET /ressources
Liste de toutes les ressources.

**Réponse 200 :** `Ressource[]` (avec poles et responsablePoles)

---

### POST /ressources
**Rôle requis :** `responsable` ou `direction_generale`

**Body :**
```typescript
{
  nom: string,
  email: string,    // unique
  password: string,
  role?: Role       // défaut: 'utilisateur'
}
```

**Réponse 201 :** `Ressource`

---

### PATCH /ressources/:id
**Rôle requis :** `responsable` ou `direction_generale`

**Body :** `{ nom?, email?, password?, role? }`

**Réponse 200 :** `Ressource`

---

### DELETE /ressources/:id
**Rôle requis :** `responsable` ou `direction_generale`

**Réponse :** 204

---

## Pôles

### GET /poles
**Réponse 200 :** `Pole[]`

### POST /poles
**Body :** `{ nom: string }`
**Réponse 201 :** `Pole`

### PATCH /poles/:id
**Body :** `{ nom: string }`
**Réponse 200 :** `Pole`

### DELETE /poles/:id
**Réponse :** 204

---

## Tags

### GET /tags
**Query params :**
- `type` : filtrer par type (`projet` | `tache`)
- `poleId` : filtrer par pôle

**Réponse 200 :** `Tag[]`

### POST /tags
**Body :** `{ nom: string, type: TypeTag, poleIds?: string[] }`
**Réponse 201 :** `Tag`

### PATCH /tags/:id
**Body :** `{ nom?, type?, poleIds? }`
**Réponse 200 :** `Tag`

### DELETE /tags/:id
**Réponse :** 204

---

## Catégories (de projet)

### GET /categories
**Réponse 200 :** `Categorie[]` (avec poles)

### POST /categories
**Body :** `{ nom: string, poleIds?: string[] }`
**Réponse 201 :** `Categorie`

### PATCH /categories/:id
**Body :** `{ nom?, poleIds? }`
**Réponse 200 :** `Categorie`

### DELETE /categories/:id
**Réponse :** 204

---

## Corbeille

### GET /corbeille
Éléments supprimés par l'utilisateur connecté.

**Réponse 200 :**
```json
{
  "projets": [ProjetCorbeille...],
  "taches": [TacheCorbeille...]
}
```

`projets` inclut les tâches supprimées en cascade (juste `id`).
`taches` : uniquement celles supprimées indépendamment (pas via un projet).

---

### POST /corbeille/projets/:id/restaurer
Restaure le projet et ses tâches supprimées en cascade (`deletedWithProjetId = projetId`).

**Réponse :** 204 + journal `RESTAURATION_PROJET`

---

### POST /corbeille/taches/:id/restaurer
Restaure une tâche individuelle.

**Conditions bloquantes :**
- 409 : projet parent supprimé (restaurer le projet d'abord)

**Réponse :** 204 + journal `RESTAURATION_TACHE`

---

## Synthèse

### GET /synthese
Dashboard KPIs. Données filtrées selon le rôle.

**Réponse 200 :**
```typescript
{
  taches: {
    total: number,
    termine: number,
    enCours: number,
    aFaire: number,
    enDepassement: number,   // activités > durée
    enRetard: number,        // dateButoire < aujourd'hui
    prochaineEcheance: number, // dateButoire dans les 5 jours ouvrés
    sansDonnees: number      // ni duree ni dateDebut (hors terminées)
  },
  projets: {                 // null si rôle 'utilisateur'
    total, enCours, termine,
    enDepassement, enRetard, prochaineEcheance
  } | null,
  demandes: { enAttente: number }
}
```

---

## Charge

### GET /charge?from=YYYY-MM-DD&to=YYYY-MM-DD
Charge prévisionnelle par ressource et semaine.

**Réponse 200 :**
```typescript
{
  weeks: string[],  // lundis au format YYYY-MM-DD
  rows: [{
    ressourceId: string,
    ressourceNom: string,
    workload: Record<string, number>  // weekKey → nb jours ouvrés
  }]
}
```

---

## Journal

### GET /journal
**Rôle requis :** `responsable` ou `direction_generale`

**Query params :**
- `page` : numéro de page (défaut 1)
- `limit` : taille de page (défaut 20)
- `action` : filtrer par type d'action

**Réponse 200 :** `{ items: JournalAction[], total: number, page: number }`

---

## Recherche

### GET /search?q=terme
Recherche dans titres projets et tâches.

**Réponse 200 :**
```typescript
{
  projets: [{ id, titre, pole?: { nom } }],
  taches:  [{ id, titre, projetTitre }]
}
```

---

## Notifications

### GET /notifications
Notifications en attente pour l'utilisateur (ex : demandes à valider).

**Réponse 200 :** `{ count: number, items: AppNotification[] }`

```typescript
interface AppNotification {
  id: string,
  type: string,
  titre: string,
  projetTitre?: string
}
```

---

## Santé

### GET /health
Vérifie que le backend est up. Pas d'auth requise.

**Réponse 200 :** `{ status: "ok" }`

---

## Codes d'erreur récurrents

| Code | Signification |
|------|--------------|
| 400 | Validation échouée (Zod) ou contrainte métier |
| 401 | Token absent, invalide ou expiré |
| 403 | Rôle insuffisant ou accès à une ressource non autorisée |
| 404 | Entité introuvable |
| 409 | Conflit : suppression bloquée (activités présentes) ou restauration bloquée (projet parent supprimé) |
| 429 | Rate limit (login) |
