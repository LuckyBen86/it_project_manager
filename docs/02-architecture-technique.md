# Architecture Technique — IT Project Manager

> Document de référence pour toute reconstruction dans une autre stack.
> Décrit la stack actuelle, le modèle de données, les patterns d'architecture et les décisions techniques.

> **Règle pour l'IA** : tout le code généré doit respecter les configurations ESLint et Prettier du projet. Avant de générer du code impliquant une librairie ou un framework listé dans ce document, utiliser **context7** (`mcp__context7__resolve-library-id` + `mcp__context7__query-docs`) pour récupérer la documentation à jour. Les APIs évoluent entre versions majeures — ne jamais supposer que la syntaxe connue en entraînement est encore valide.

---

## 1. Stack actuelle (v1 — référence)

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19 + TypeScript + Vite |
| Style | Tailwind CSS v4 |
| State management | Zustand (auth uniquement) |
| Data fetching | Custom hooks + axios |
| Validation formulaires | React Hook Form + Zod |
| Linting | ESLint |
| Formatage | Prettier |
| Drag & drop | @dnd-kit/core |
| Dates | date-fns |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma (SQLite) |
| Auth | JWT (access token + refresh token) + Entra ID (MSAL) |
| Hashing mdp | bcryptjs (comptes locaux uniquement) |
| Rate limiting | express-rate-limit |
| Infrastructure | Docker Compose (3 services) |
| Proxy | Nginx (sert le frontend + reverse proxy vers backend) |

---

## 2. Infrastructure Docker

```
┌─────────────────────────────────────────────┐
│           Nginx reverse proxy               │
│         (TLS/HTTPS, hors Docker)            │
│     redirige → http://localhost:3200        │
└──────────────────┬──────────────────────────┘
                   │ HTTP
┌──────────────────▼──────────────────────────┐
│  frontend (Nginx)  3200:80                   │
│  - Sert les fichiers statiques React         │
│  - Reverse proxy /api/* → backend:4000       │
│  - Écoute en HTTP uniquement (pas de TLS)    │
└──────────────────┬──────────────────────────┘
                   │ /api/*
┌──────────────────▼──────────────────────────┐
│  backend (Express)  :4000                    │
│  - API REST                                  │
│  - Seed admin au démarrage                  │
└──────────────────┬──────────────────────────┘
                   │
└─────────────────────────────────────────────┘
```
Le service `db` (PostgreSQL) est supprimé. SQLite est un fichier embarqué dans le conteneur backend, monté depuis l'hôte.

> **HTTP interne uniquement** : le conteneur frontend écoute en HTTP sur le port 80 (exposé en `3200:80`). Le chiffrement TLS est délégué au Nginx hôte (hors Docker), qui gère le redirect HTTP→HTTPS et termine la connexion SSL avant de proxifier vers `localhost:3200`. Cela évite un double chiffrement inutile. Pour les détails de configuration Nginx hôte, certificats et headers de sécurité, voir `HTTP.md`.

**Variables d'environnement backend :**
```
DATABASE_URL          # file:/opt/docker/data/gprojet/gprojet.db
JWT_SECRET            # secret access token
JWT_REFRESH_SECRET    # secret refresh token
PORT                  # 4000
FRONTEND_URL          # pour CORS
SEED_ADMIN_EMAIL      # compte admin initial (seed uniquement)
SEED_ADMIN_PASSWORD
SEED_ADMIN_NOM
```

**Volumes :**
```yaml
# docker-compose.yml
volumes:
  - /opt/docker/data/gprojet:/opt/docker/data/gprojet           # base SQLite
  - /opt/docker/data/gprojet/logs:/opt/docker/data/gprojet/logs # logs applicatifs
```

- `/opt/docker/data/gprojet/gprojet.db` — fichier de base de données SQLite
- `/opt/docker/data/gprojet/logs/` — logs applicatifs persistés sur l'hôte :
  - `auth.log` : tentatives de connexion (succès, échecs, rate-limit), déconnexions, refresh de token
  - `app.log` : erreurs applicatives et events notables (optionnel)
  - Format recommandé : JSON structuré (une ligne par événement) avec `timestamp`, `level`, `event`, `userId`, `ip`

Ces deux répertoires sont la cible des sauvegardes Veame (objectif à terme). La sauvegarde de la base se réduit à copier le fichier `.db`.

> **Principe : .env minimal** — Seules les valeurs qui ne peuvent pas être stockées en base (secrets cryptographiques, URL de connexion, paramètres réseau au démarrage) appartiennent au `.env`. Tout le reste (durées JWT, timeouts, paramètres métier, configuration applicative) doit être gérable depuis l'espace d'administration sans redémarrage du serveur. Voir décision technique 6.8.

---

## 3. Modèle de données

### 3.1 Entités principales

#### Ressource (= utilisateur)
```
id            UUID (PK)
nom           String
email         String (unique)
passwordHash  String?              -- null pour les comptes Entra
authProvider  Enum(local | entra)  -- origine du compte
entraOid      String?              -- object ID Entra (unique par tenant, null si local)
role          Enum(responsable | utilisateur | direction_generale)
tauxActivite  Int     (défaut 100) -- % d'activité, entre 0 et 100
createdAt     DateTime
loggedOutAt   DateTime?            -- utilisé pour invalider les tokens
```

#### Pole
```
id    UUID (PK)
nom   String (unique)
```

#### Projet
```
id                    UUID (PK)
titre                 String
description           String?
poleId                UUID (FK → Pole)
referentId            UUID? (FK → Ressource)
priorite              Enum(faible | moyenne | haute | critique)  (défaut moyenne)
dateButoire           DateTime?
dateDebut             DateTime?
duree                 Int?           -- jours ouvrés (durée estimée globale du projet)
dureeTotaleModulee    Int?           -- calculé : Σ dureeModulee des tâches non supprimées
dateFin               DateTime?      -- calculé : dateDebut + dureeTotaleModulee (jours ouvrés)
statut                Enum(non_valide | a_planifier | planifie | en_cours | termine)
avancementProjet      Int     (défaut 0)    -- % d'avancement 0-100
avancementAutoProjet  Boolean (défaut true) -- si true : calculé depuis les tâches (pondéré par durée)
createdAt             DateTime
updatedAt             DateTime
deletedAt             DateTime?      -- soft delete
deletedById           UUID?          -- qui a supprimé
```

#### Tache
```
id                   UUID (PK)
projetId             UUID (FK → Projet, cascade delete)
titre                String
description          String?
dateDebut            DateTime?
dateButoire          DateTime?
duree                Int?           -- jours ouvrés (durée prévue, saisie manuellement)
dureeModulee         Int?           -- jours ouvrés (calculé : duree / tauxActivite minimal des ressources)
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

#### ProjetDependance (table de liaison)
```
projetId    UUID (FK → Projet)
precedentId UUID (FK → Projet)
PK: (projetId, precedentId)
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
Projet ──< ProjetDependance (self-referencing)
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

### 4.2 Authentification — deux modes

#### Mode Entra ID (Azure AD)
- Librairie : `@azure/msal-node` côté backend, `@azure/msal-browser` côté frontend
- **Flux utilisateur** :
  1. L'utilisateur saisit son email sur la page de login de l'application
  2. Le frontend détecte que le domaine correspond à Entra ID (ou que le mode Entra est activé) et déclenche la redirection vers la page de connexion Microsoft (`login.microsoftonline.com`)
  3. Microsoft authentifie l'utilisateur et redirige vers le callback de l'application avec un code d'autorisation
  4. Le frontend envoie ce code au backend via `POST /auth/entra`
  5. Le backend échange le code contre un `id_token`, valide le token, crée ou met à jour la `Ressource` correspondante (matching par `entraOid` puis par email), puis émet ses propres JWT applicatifs
- Configuration Entra (tenant ID, client ID, client secret) stockée en base via `ConfigurationApp` (voir §6.8), modifiable depuis l'admin sans redémarrage

#### Mode compte local
- Email + mot de passe, hashé bcrypt
- Réservé au compte admin initial (seed) et comme accès de secours si Entra ID est indisponible
- Route : `POST /auth/login`

#### Champ `authProvider` sur Ressource
```
authProvider  Enum(local | entra)  -- origine du compte
entraOid      String?              -- object ID Entra (unique par tenant)
```

### 4.3 JWT Payload
```typescript
// Access token payload (commun aux deux modes)
{
  sub: string,                    // ressource ID interne
  email: string,
  role: 'responsable' | 'utilisateur' | 'direction_generale',
  responsablePoleIds?: string[],  // IDs des pôles dont il est responsable
}

// Refresh token payload
{ sub: string }  // ressource ID uniquement
```

**Invalidation de session :** Le champ `Ressource.loggedOutAt` permet de blacklister tous les tokens émis avant cette date. Le middleware auth vérifie `token.iat > loggedOutAt`.

### 4.4 Middleware auth
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

### 4.5 Validation Zod
Chaque route utilise `validate(schema)` avant le handler. Le middleware renvoie `400` avec les erreurs Zod si la validation échoue.

### 4.6 Pattern de filtrage par rôle (exemple projet)
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

### 6.8 Dépendances entre projets — calcul en cascade

Même mécanique que les dépendances de tâches (§6.3) appliquée aux projets :

- **Tri topologique** des projets par leurs dépendances avant tout calcul de position
- **`computeProjectStartDates`** (frontend, analogue à `computeTaskStartDates`) : pour chaque projet, `dateDebutEffective = max(dateDebut en base, max(dateFin des prédécesseurs))`
- La `dateFin` d'un prédécesseur utilisée pour le calcul est `dateDebut + dureeTotaleModulee` (jours ouvrés)
- **Décalage en cascade** : si la `dateFin` d'un projet est modifiée, tous ses successeurs directs et transitifs sont recalculés (BFS depuis le projet modifié)
- **Détection de cycle** : côté backend à chaque création/modification de dépendance, retour `409 Conflict` si cycle détecté
- **Plusieurs prédécesseurs** : `dateDebutEffective = max(dateFin de tous les prédécesseurs)`
- La `dateDebut` stockée en base peut être obsolète si un prédécesseur a bougé — la source de vérité visuelle est le calcul frontend (même principe que §6.3)

### 6.9 Calcul de la durée modulée et de la date de fin projet

**Durée modulée d'une tâche** (`dureeModulee`) :
- Déclencheur : toute modification des ressources assignées à une tâche, du `tauxActivite` d'une ressource, ou de la `duree` de la tâche
- Formule : `dureeModulee = round(duree / (tauxActiviteMin / 100))`
  - `tauxActiviteMin` = taux d'activité le plus bas parmi les ressources assignées
  - Si aucune ressource ou `tauxActivite = 100` : `dureeModulee = duree`
  - Si `duree` est nulle : `dureeModulee = null`
- Stockée en base (pas recalculée à la volée) car utilisée en agrégat pour le projet

**Durée totale modulée du projet** (`dureeTotaleModulee`) :
- `dureeTotaleModulee = Σ dureeModulee` des tâches non supprimées du projet (nulls exclus)
- Recalculée à chaque CREATE/UPDATE/DELETE d'une tâche du projet

**Date de fin calculée** (`dateFin`) :
- `dateFin = dateDebut + dureeTotaleModulee` (addition en jours ouvrés, hors week-ends)
- Recalculée à chaque modification de `dateDebut` ou de `dureeTotaleModulee`
- Distincte de `dateButoire` : `dateFin` est une projection réaliste (modulée par les taux d'activité), `dateButoire` est la date limite contractuelle fixée par le responsable

### 6.10 SQLite — implications et contraintes

- **Pas de service `db` séparé** : SQLite est un fichier embarqué, accédé directement par le processus backend via Prisma. L'infrastructure Docker passe de 3 à 2 services (`frontend` + `backend`).
- **Concurrence** : SQLite gère les accès concurrents en écriture via un verrou exclusif. Acceptable pour un usage interne à charge modérée. Activer le mode WAL (`PRAGMA journal_mode=WAL`) pour améliorer les performances en lecture concurrente.
- **Sauvegarde** : la sauvegarde se réduit à copier le fichier `gprojet.db` (et optionnellement `gprojet.db-wal`). Le répertoire `/opt/docker/data/gprojet/` est la cible des sauvegardes Veame.
- **Migrations Prisma** : `prisma migrate deploy` s'exécute au démarrage du conteneur backend. Les migrations sont des fichiers SQL générés par Prisma, compatibles SQLite.
- **Pas de `DATABASE_URL` avec credentials** : l'URL est un simple chemin de fichier (`file:/opt/docker/data/gprojet/gprojet.db`), sans utilisateur ni mot de passe — la sécurité repose sur les permissions du système de fichiers hôte.
- **Logs** : écrits dans `/opt/docker/data/gprojet/logs/`, montés sur l'hôte. Les logs d'authentification (connexions, échecs, rate-limit, déconnexions) sont obligatoires. Rotation des logs à prévoir (ex. `winston-daily-rotate-file`) pour éviter la croissance illimitée des fichiers.

### 6.11 Principe : .env minimal — configuration via l'administration
Le fichier `.env` ne doit contenir que ce qui est **strictement impossible à stocker en base** :
- Secrets cryptographiques (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`) — leur compromission nécessiterait de toute façon un redémarrage
- Paramètres réseau nécessaires **avant** toute connexion à la base (`PORT`, `FRONTEND_URL`)
- Credentials de seed du compte admin initial (`SEED_ADMIN_*`) — utilisés une seule fois au premier démarrage

**Tout le reste doit être configurable depuis l'espace Administration**, stocké en base dans une table `Configuration` (clé/valeur), et appliqué sans redémarrage. Exemples de valeurs qui ne doivent PAS être dans le `.env` :
- Durées des tokens JWT (`JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`) → paramètre admin
- Paramètres du rate limiting (nb de tentatives, fenêtre de temps) → paramètre admin
- Tout paramètre métier susceptible d'évoluer (seuils, libellés, comportements) → paramètre admin

**Conséquence sur le modèle de données :** prévoir une entité `Configuration` :
```
ConfigurationApp
  cle    String (PK)   -- ex : "jwt_expires_in", "login_rate_limit_max"
  valeur String        -- valeur sérialisée
  label  String        -- libellé lisible pour l'UI admin
  updatedAt DateTime
```
Le backend charge ces valeurs au démarrage et les met en cache, avec une invalidation sur écriture depuis l'admin.

---

## 7. Sécurité

- Toutes les routes API (sauf `/auth/login` et `/auth/refresh`) exigent un JWT valide → 401 sinon
- Contrôle de rôle côté serveur sur chaque opération d'écriture → 403 sinon
- Mots de passe hashés bcrypt (salt rounds : 10 par défaut)
- Pas de secret en dur dans le code source (variables d'environnement)
- Rate limiting sur `/auth/login` : 10 req/15min par IP
- CORS configuré pour n'accepter que `FRONTEND_URL`
- Validation Zod en entrée sur toutes les routes
