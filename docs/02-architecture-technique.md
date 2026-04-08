# Architecture Technique — IT Project Manager

> Document de référence pour toute reconstruction dans une autre stack.
> Décrit la stack actuelle, le modèle de données, les patterns d'architecture et les décisions techniques.

---

## 1. Stack actuelle (v1 — référence)

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18 + TypeScript + Vite |
| Style | Tailwind CSS v3 |
| State management | Zustand (auth uniquement) |
| Data fetching | Custom hooks + axios |
| Validation formulaires | React Hook Form + Zod |
| Drag & drop | @dnd-kit/core |
| Dates | date-fns |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma (PostgreSQL) |
| Auth | JWT (access token 15min + refresh token 7j) |
| Hashing mdp | bcryptjs |
| Rate limiting | express-rate-limit |
| Infrastructure | Docker Compose (3 services) |
| Proxy | Nginx (sert le frontend + reverse proxy vers backend) |

---

## 2. Infrastructure Docker

```
┌─────────────────────────────────────────────┐
│                 Browser                      │
│         http://localhost:3100               │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  frontend (Nginx)  :80                       │
│  - Sert les fichiers statiques React         │
│  - Reverse proxy /api/* → backend:4000       │
└──────────────────┬──────────────────────────┘
                   │ /api/*
┌──────────────────▼──────────────────────────┐
│  backend (Express)  :4000                    │
│  - API REST                                  │
│  - Seed admin au démarrage                  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  db (PostgreSQL 16)  :5432                   │
│  - Volume persistant postgres_data           │
└─────────────────────────────────────────────┘
```

**Variables d'environnement backend :**
```
DATABASE_URL          # postgresql://user:pass@db:5432/dbname
JWT_SECRET            # secret access token
JWT_REFRESH_SECRET    # secret refresh token
JWT_EXPIRES_IN        # défaut : 15m
JWT_REFRESH_EXPIRES_IN # défaut : 7d
PORT                  # 4000
FRONTEND_URL          # pour CORS
SEED_ADMIN_EMAIL      # compte admin initial
SEED_ADMIN_PASSWORD
SEED_ADMIN_NOM
```

---

## 3. Modèle de données

### 3.1 Entités principales

#### Ressource (= utilisateur)
```
id            UUID (PK)
nom           String
email         String (unique)
passwordHash  String
role          Enum(responsable | utilisateur | direction_generale)
createdAt     DateTime
loggedOutAt   DateTime? -- utilisé pour invalider les tokens
```

#### Pole
```
id    UUID (PK)
nom   String (unique)
```

#### Projet
```
id                   UUID (PK)
titre                String
description          String?
poleId               UUID (FK → Pole)
referentId           UUID? (FK → Ressource)
dateButoire          DateTime?
dateDebut            DateTime?
duree                Int?           -- jours ouvrés
statut               Enum(non_valide | a_planifier | planifie | en_cours | termine)
avancementProjet     Int     (défaut 0)    -- % d'avancement 0-100
avancementAutoProjet Boolean (défaut true) -- si true : calculé depuis les tâches (pondéré par durée)
createdAt            DateTime
updatedAt            DateTime
deletedAt            DateTime?      -- soft delete
deletedById          UUID?          -- qui a supprimé
```

#### Tache
```
id                   UUID (PK)
projetId             UUID (FK → Projet, cascade delete)
titre                String
description          String?
dateDebut            DateTime?
dateButoire          DateTime?
duree                Int?           -- jours ouvrés
statut               Enum(a_faire | en_cours | termine)
enAttenteValidation  Boolean (défaut false)
avancementTache      Int     (défaut 0)   -- % d'avancement 0-100
avancementAutoTache  Boolean (défaut true) -- si true : calculé depuis activités
createdAt            DateTime
updatedAt            DateTime
deletedAt            DateTime?
deletedById          UUID?
deletedWithProjetId  UUID?  -- renseigné si supprimée en cascade avec un projet
```

#### Activite
```
id           UUID (PK)
description  String
date         DateTime
duree        Float          -- heures (décimales)
ressourceId  UUID (FK → Ressource)
tacheId      UUID? (FK → Tache, cascade delete)
createdAt    DateTime
```

#### Tag
```
id    UUID (PK)
nom   String
type  Enum(projet | tache)
      -- unicité : (nom, type)
```

#### Categorie
```
id   UUID (PK)
nom  String (unique)   -- catégorie de projet uniquement
```

#### DemandeValidation
```
id                 UUID (PK)
tacheId            UUID (FK → Tache, cascade)
auteurId           UUID (FK → Ressource, cascade)
type               Enum(terminer | modifier_duree | modifier_date_debut)
statut             Enum(en_attente | valide | refuse)
valeurDemandee     String?  -- durée (int en string) ou date ISO
statutOrigine      String?  -- statut de la tâche avant la demande "terminer"
commentaireRefus   String?
archivedByAuteur   Boolean (défaut false)
createdAt          DateTime
updatedAt          DateTime
```

#### TacheDependance (table de liaison)
```
tacheId     UUID (FK → Tache)
precedentId UUID (FK → Tache)
PK: (tacheId, precedentId)
```

#### JournalAction
```
id             UUID (PK)
action         Enum(STATUT_PROJET | STATUT_TACHE | DATE_DEBUT_PROJET | DATE_DEBUT_TACHE | SUPPRESSION_PROJET | SUPPRESSION_TACHE | RESTAURATION_PROJET | RESTAURATION_TACHE)
auteurId       UUID? (FK → Ressource, SetNull si supprimé)
auteurNom      String        -- dénormalisé pour conserver l'info si ressource supprimée
entityId       UUID
entityTitre    String        -- dénormalisé pour la même raison
ancienneValeur String?
nouvelleValeur String?
createdAt      DateTime
```

### 3.2 Tables de liaison

| Table | Relations |
|-------|-----------|
| `ressource_poles` | Ressource ↔ Pole (appartenance) |
| `responsable_poles` | Ressource ↔ Pole (responsabilité) |
| `projet_tags` | Projet ↔ Tag |
| `tache_tags` | Tache ↔ Tag |
| `tag_poles` | Tag ↔ Pole (filtrage par pôle) |
| `projet_categories` | Projet ↔ Categorie |
| `categorie_poles` | Categorie ↔ Pole |
| `tache_ressources` | Tache ↔ Ressource (assignation) |

### 3.3 Schéma ERD (simplifié)

```
Pole ──< RessourcePole >── Ressource
Pole ──< ResponsablePole >── Ressource
Pole ──< TagPole >── Tag
Pole ──< CategoriePolе >── Categorie
Pole ──< Projet

Ressource ──< Activite
Ressource ──< TacheRessource >── Tache
Ressource ──< JournalAction
Ressource ──< DemandeValidation

Projet ──< Tache
Projet ──< ProjetTag >── Tag
Projet ──< ProjetCategorie >── Categorie

Tache ──< Activite
Tache ──< TacheTag >── Tag
Tache ──< TacheDependance (self-referencing)
Tache ──< DemandeValidation
```

---

## 4. Architecture backend

### 4.1 Structure des fichiers
```
backend/src/
├── app.ts                  # Express app + montage des routes
├── server.ts               # Point d'entrée, seed admin
├── middleware/
│   ├── auth.middleware.ts  # JWT decode + attach req.user
│   └── validate.middleware.ts # Zod validation body
├── lib/
│   ├── prisma.ts           # Singleton PrismaClient
│   ├── jwt.ts              # signAccessToken, signRefreshToken, verifyRefreshToken
│   ├── journal.ts          # logAction() helper
│   ├── labels.ts           # STATUT_LABELS_FR, formatDateFr
│   └── avancement.ts       # maybeRecalculerTache(), maybeRecalculerProjet()
├── routes/
│   ├── auth.routes.ts
│   ├── projets.routes.ts
│   ├── taches.routes.ts    # Monté sous /projets/:projetId/taches
│   ├── mes-taches.routes.ts
│   ├── activites.routes.ts
│   ├── ressources.routes.ts
│   ├── poles.routes.ts
│   ├── tags.routes.ts
│   ├── categories.routes.ts
│   ├── corbeille.routes.ts
│   ├── demandes.routes.ts
│   ├── mes-demandes.routes.ts
│   ├── synthese.routes.ts
│   ├── charge.routes.ts
│   ├── journal.routes.ts
│   ├── search.routes.ts
│   └── notifications.routes.ts
└── schemas/
    ├── auth.schema.ts
    ├── projet.schema.ts    # createProjetSchema, updateProjetSchema, updateGanttSchema
    ├── tache.schema.ts
    ├── activite.schema.ts
    ├── demande.schema.ts
    ├── ressource.schema.ts
    └── tag.schema.ts
```

### 4.2 JWT Payload
```typescript
// Access token payload
{
  sub: string,                    // ressource ID
  email: string,
  role: 'responsable' | 'utilisateur' | 'direction_generale',
  responsablePoleIds?: string[],  // IDs des pôles dont il est responsable
}

// Refresh token payload
{ sub: string }  // ressource ID uniquement
```

**Invalidation de session :** Le champ `Ressource.loggedOutAt` permet de blacklister tous les tokens émis avant cette date. Le middleware auth vérifie `token.iat > loggedOutAt`.

### 4.3 Middleware auth
```typescript
// req.user est toujours disponible après authenticate()
interface AuthUser {
  sub: string
  email: string
  role: Role
  responsablePoleIds?: string[]
}
```

`requireRole(...roles)` : middleware qui retourne 403 si `req.user.role` n'est pas dans la liste.

### 4.4 Validation Zod
Chaque route utilise `validate(schema)` avant le handler. Le middleware renvoie `400` avec les erreurs Zod si la validation échoue.

### 4.5 Pattern de filtrage par rôle (exemple projet)
```typescript
function projetWhereForUser(userId, role, responsablePoleIds) {
  if (role === 'direction_generale') return { deletedAt: null }
  if (role === 'responsable') return { deletedAt: null, poleId: { in: responsablePoleIds } }
  // utilisateur : assigné à ≥1 tâche OU référent
  return {
    deletedAt: null,
    OR: [
      { taches: { some: { deletedAt: null, ressources: { some: { ressourceId: userId } } } } },
      { referentId: userId },
    ],
  }
}
```

---

## 5. Architecture frontend

### 5.1 Structure des fichiers
```
frontend/src/
├── main.tsx
├── App.tsx                 # Routes React Router
├── store/
│   └── auth.store.ts       # Zustand : user, token, login(), logout()
├── lib/
│   ├── api.ts              # Instance axios avec intercepteur JWT
│   ├── types.ts            # Tous les types TypeScript
│   └── gantt.ts            # Logique Gantt (offsets, dépendances, zoom)
├── pages/
│   ├── KanbanPage.tsx
│   ├── GanttPage.tsx
│   ├── AdminPage.tsx
│   ├── MesTachesPage.tsx
│   ├── SynthesePage.tsx
│   ├── CorbeillePage.tsx
│   ├── DemandesResponsablePage.tsx
│   └── MesDemandesPage.tsx
├── components/
│   ├── Kanban/
│   │   └── KanbanColumn.tsx
│   ├── Gantt/
│   │   ├── GanttBarre.tsx
│   │   ├── TacheBarre.tsx
│   │   ├── GanttArrows.tsx
│   │   └── GanttTooltip.tsx
│   ├── ProjetDetailPanel.tsx
│   ├── ProjetFormModal.tsx
│   ├── TacheFormModal.tsx
│   ├── RessourceFormModal.tsx
│   ├── CategorieFormModal.tsx
│   ├── AdminCategories.tsx
│   ├── AdminPoles.tsx
│   ├── AdminRessources.tsx
│   ├── AdminJournal.tsx
│   ├── TokenField.tsx      # Sélecteur multi-valeurs
│   ├── Modal.tsx           # Modal générique
│   └── FormField.tsx       # Champ avec label + erreur
└── hooks/
    ├── useProjets.ts        # GET/PATCH /projets, optimistic updates
    ├── useTags.ts
    ├── usePoles.ts
    ├── useRessources.ts
    ├── useMesTaches.ts
    ├── useActivitesTache.ts
    ├── useSynthese.ts
    ├── useMesDemandes.ts
    └── useDemandesResponsable.ts
```

### 5.2 Intercepteur axios (lib/api.ts)
- Attache automatiquement `Authorization: Bearer <token>` à chaque requête
- Sur 401 : tente un refresh automatique (`POST /auth/refresh`)
- Si refresh échoue : logout + redirection login

### 5.3 Auth store (Zustand)
```typescript
interface AuthStore {
  user: AuthUser | null
  token: string | null
  refreshToken: string | null
  login(user, token, refreshToken): void
  logout(): void
}
```
Persisté en localStorage.

### 5.4 Pattern hooks data-fetching
Chaque hook :
- Fait un `useEffect` → appel API au mount
- Expose `{ data, loading, error, refetch }`
- Certains hooks (ex. `useProjets`) incluent des **optimistic updates** : mise à jour locale immédiate avant confirmation serveur

### 5.5 Protection des routes
```tsx
// Route protégée : redirige vers /login si non authentifié
<PrivateRoute>
  <KanbanPage />
</PrivateRoute>
```

---

## 6. Décisions techniques notables

### 6.1 Soft delete
Les suppressions ne sont jamais physiques. Les champs `deletedAt` / `deletedById` / `deletedWithProjetId` permettent la corbeille et la restauration. Toutes les requêtes normales filtrent sur `deletedAt: null`.

### 6.2 Dénormalisation dans le journal
`JournalAction.auteurNom` et `entityTitre` sont dénormalisés pour garantir la lisibilité du journal même après suppression de la ressource ou du projet/tâche.

### 6.3 Calcul de dates Gantt côté frontend
Les positions Gantt ne dépendent pas uniquement des données en base — elles sont recalculées en tenant compte des dépendances (`computeTaskStartDates`). Une `dateDebut` en base peut être obsolète si une dépendance a été modifiée. La source de vérité visuelle est le calcul frontend.

### 6.4 Calcul d'avancement à la volée (GET /projets)
Le champ `avancementProjet` et `avancementTache` sont stockés en base mais leur valeur peut être obsolète si des activités ont été créées avant l'activation du mode auto. Pour garantir la cohérence, les deux valeurs sont **recalculées à la volée** dans la fonction `flattenTags` à chaque réponse GET, lorsque `avancementAutoProjet` / `avancementAutoTache` sont activés :

- **Tâche (auto)** : `avancementTache = min(100, round(Σ activites.duree / tache.duree × 100))`
- **Projet (auto)** : `avancementProjet = round(Σ(avancementTache × duree) / Σ duree)` — uniquement sur les tâches ayant une durée > 0

Cette approche est analogue au calcul des positions Gantt (section 6.3) : la source de vérité visuelle est le calcul à la lecture, pas la valeur stockée.

La persistance en DB (`maybeRecalculerTache` / `maybeRecalculerProjet` dans `lib/avancement.ts`) reste utile pour maintenir la cohérence lors des écritures (ajout d'activité, modification de tâche).

### 6.5 Transition `planifie → en_cours` automatique
Lorsqu'un `PATCH /projets/:id` inclut une `dateDebut` ET que des activités existent sur ce projet, le backend force le statut à `en_cours` (et non `planifie`). Même logique dans le Gantt (`PATCH /projets/:id/gantt`).

### 6.6 `responsablePoleIds` dans le JWT
Pour éviter des requêtes DB supplémentaires sur chaque requête, les pôles dont un responsable est responsable sont inclus dans le payload JWT. Ils sont mis à jour à chaque login ou refresh.

### 6.7 Invalidation de session côté serveur
Le champ `loggedOutAt` sur `Ressource` permet d'invalider tous les tokens d'une session. Le middleware compare `token.iat` avec `loggedOutAt` (converti en secondes).

---

## 7. Sécurité

- Toutes les routes API (sauf `/auth/login` et `/auth/refresh`) exigent un JWT valide → 401 sinon
- Contrôle de rôle côté serveur sur chaque opération d'écriture → 403 sinon
- Mots de passe hashés bcrypt (salt rounds : 10 par défaut)
- Pas de secret en dur dans le code source (variables d'environnement)
- Rate limiting sur `/auth/login` : 10 req/15min par IP
- CORS configuré pour n'accepter que `FRONTEND_URL`
- Validation Zod en entrée sur toutes les routes
