# IT Project Manager

Application web de gestion de projets pour service IT — Vue Kanban + Gantt interactif.

## Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| BDD | PostgreSQL (via Prisma) |
| Auth | JWT (access + refresh token) |
| Tests | Vitest |
| Déploiement | Docker + Portainer |

---

## Démarrage rapide (Docker)

### 1. Configurer l'environnement

```bash
cd it-project-manager
cp .env.example .env
```

Éditer `.env` et **changer impérativement** :
- `POSTGRES_PASSWORD`
- `JWT_SECRET` (64 caractères min)
- `JWT_REFRESH_SECRET` (64 caractères min)
- `SEED_ADMIN_PASSWORD`

Générer des secrets forts :
```bash
node -e "require('crypto').randomBytes(64).toString('hex')"
```

### 2. Lancer l'application

```bash
docker-compose up --build
```

Au premier démarrage, le backend :
1. Synchronise le schéma Prisma avec la BDD (`prisma db push`)
2. Crée le compte admin initial (email/mot de passe définis dans `.env`)
3. Démarre le serveur

### 3. Accéder à l'application

| Service | URL |
|---------|-----|
| Application | http://localhost |
| API backend | http://localhost:4000 |
| BDD (si exposée) | localhost:5432 |

Compte admin par défaut : `admin@it-pm.local` / `Admin1234!`
> ⚠️ Changer le mot de passe après la première connexion via Administration → Ressources

---

## Développement local

### Prérequis

- Node.js 20+
- PostgreSQL (ou Docker pour la BDD seule)

### Backend

```bash
cd backend
npm install

# Démarrer uniquement la BDD
docker-compose up db -d

# Configurer la BDD
cp ../.env.example .env.local
# Editer DATABASE_URL dans .env.local

# Pousser le schéma
npx prisma db push

# Seed (créer l'admin)
npm run seed

# Démarrer en mode dev
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

L'application frontend est accessible sur http://localhost:5173.

---

## Tests

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

---

## Déploiement sur Portainer

1. Copier `docker-compose.yml` et `.env` sur le serveur
2. Dans Portainer : **Stacks → Add stack → Upload**
3. Uploader `docker-compose.yml`
4. Ajouter les variables d'environnement ou pointer vers le fichier `.env`
5. Déployer

> Pour un déploiement derrière un reverse proxy (Traefik/Nginx), adapter `FRONTEND_URL` avec l'URL publique et activer HTTPS.

---

## Architecture

```
it-project-manager/
├── backend/
│   ├── src/
│   │   ├── routes/        # auth, projets, taches, ressources, categories, activites
│   │   ├── middleware/     # authenticate, requireRole, validate
│   │   ├── lib/           # prisma, jwt
│   │   ├── schemas/       # Zod schemas
│   │   └── seed.ts        # Création du compte admin initial
│   └── prisma/
│       └── schema.prisma
├── frontend/
│   └── src/
│       ├── pages/         # LoginPage, KanbanPage, GanttPage, AdminPage
│       ├── components/    # ProjetCard, KanbanColonne, GanttBarre, modals...
│       ├── hooks/         # useProjets, useRessources, useCategories
│       ├── store/         # auth.store (Zustand)
│       └── lib/           # api (Axios), types, gantt helpers
├── docker-compose.yml
├── .env.example
├── app-spec.md
└── cdc_fonctionnel.md
```
