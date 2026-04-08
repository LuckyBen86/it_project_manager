# UI/UX — IT Project Manager

Ce document décrit les conventions visuelles, les patterns d'interaction et la structure des pages de l'application. Il sert de référentiel pour recréer ou étendre l'interface.

---

## 1. Design system

### Palette de couleurs

**Couleur brand (bleu) — couleur principale de l'app**

| Token         | Valeur hex | Usage                             |
|---------------|------------|-----------------------------------|
| `brand-50`    | `#eff6ff`  | Fonds actifs (nav, badges pôle)   |
| `brand-100`   | `#dbeafe`  | —                                 |
| `brand-400`   | `#60a5fa`  | Barres de progression tâche       |
| `brand-500`   | `#3b82f6`  | Barres de progression projet      |
| `brand-600`   | `#2563eb`  | Boutons primaires, onglet actif   |
| `brand-700`   | `#1d4ed8`  | Hover boutons primaires, texte actif |

Défini dans `frontend/src/index.css` via `@theme` (Tailwind v4).

**Couleurs de statut projet (badges pill)**

| Statut        | Classes Tailwind                       |
|---------------|----------------------------------------|
| Non validé    | `bg-gray-100 text-gray-700`            |
| À planifier   | `bg-yellow-100 text-yellow-700`        |
| Planifié      | `bg-blue-100 text-blue-700`            |
| En cours      | `bg-orange-100 text-orange-700`        |
| Terminé       | `bg-green-100 text-green-700`          |

**Couleurs de statut tâche**

| Statut    | Classes Tailwind                       |
|-----------|----------------------------------------|
| À faire   | `bg-gray-100 text-gray-600`            |
| En cours  | `bg-orange-100 text-orange-700`        |
| Terminé   | `bg-green-100 text-green-700`          |

**Couleurs fonctionnelles**

- Rouge `red-500 / red-600` : dates butoires dépassées, dépassement de charge, suppression, déconnexion
- Vert `green-500` : avancement à 100%
- Amber `amber-400` : avancement en cours (< 100%)
- Orange `orange-500` : badge "À valider" (responsable)
- Bleu `blue-50 / blue-700` : dépendances de tâches

### Typographie

- **Police** : `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` (stack système)
- Titres de page : `text-lg font-semibold text-gray-900`
- Titres de section : `text-xs font-bold text-gray-400 uppercase tracking-widest`
- Corps courant : `text-sm text-gray-700`
- Labels tableaux : `text-xs font-semibold text-gray-500 uppercase tracking-wide`
- Badges / méta : `text-xs`, `text-[10px]`, `text-[9px]` pour les très petits éléments

### Espacements et rayons

- Rayon standard : `rounded-lg` (8px)
- Rayon large : `rounded-xl` (12px), `rounded-2xl` (16px) pour les tuiles KPI
- Rayon pill : `rounded-full` pour badges, compteurs, jauges
- Padding boutons primaires : `px-4 py-2`
- Padding boutons secondaires/inline : `px-3 py-1.5` ou `px-2 py-1`

---

## 2. Structure globale

```
┌─────────────────────────────────────────────────────┐
│  NAVBAR (bg-white, border-b)                        │
│  Logo + Titre | Nav principale | Menu utilisateur   │
├─────────────────────────────────────────────────────┤
│  CONTENU (flex-1, overflow-hidden)                  │
│  ┌─────────────────────────────────────────────┐    │
│  │ Page header (border-b, bg-white, px-6 py-4)│    │
│  ├─────────────────────────────────────────────┤    │
│  │ [Barre de filtres optionnelle]              │    │
│  ├─────────────────────────────────────────────┤    │
│  │ Zone scrollable de contenu                  │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

Le layout global est `h-screen flex flex-col` avec overflow contrôlé.

---

## 3. Navbar (`Layout.tsx`)

- **Fond** : `bg-white`, bordure basse `border-b border-gray-200`
- **Logo** : icône SVG `favicon.svg` (w-7 h-7) + texte "IT Project Manager" (`font-bold text-lg text-gray-900`)
- **Navigation principale** (toujours visible) :
  - "Liste projets" → `/` (route Kanban, toggle Kanban/Liste)
  - "Gantt" → `/gantt`
  - "Synthèse" → `/synthese`
- **Style des liens nav** : `px-3 py-1.5 rounded-md text-sm font-medium`
  - Actif : `bg-brand-50 text-brand-700`
  - Inactif : `text-gray-600 hover:text-gray-900 hover:bg-gray-100`
- **Menu utilisateur** (dropdown, coin droit) :
  - Affiche le nom + badge rôle (`text-xs bg-gray-100 text-gray-500 capitalize rounded`)
  - Badge rouge si demandes en attente (compteur)
  - Chevron animé (rotation 180° à l'ouverture)
  - **Contenu dropdown** : `bg-white border rounded-xl shadow-lg min-w-[200px]`
    - Mes tâches → `/mes-taches`
    - Mes demandes → `/mes-demandes` (+ compteur rouge)
    - *(si responsable/direction_generale)* : séparateur, "À valider" → `/demandes` (compteur orange), "Administration" → `/admin`, "Corbeille" → `/corbeille`
    - Séparateur + "Déconnexion" (texte rouge, hover `bg-red-50`)

---

## 4. Pages et patterns par page

### 4.1 Login (`/login`)

- Fond : `bg-gray-50 min-h-screen flex items-center justify-center`
- Card centrale : `max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8`
- Logo (w-9 h-9) + titre h1 `text-2xl font-bold`
- Formulaire `space-y-4` : inputs `border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500`
- Erreur globale : bloc `bg-red-50 text-red-600 rounded-lg px-3 py-2`
- Bouton submit : pleine largeur, brand-600, disabled à 50% d'opacité

### 4.2 Vue Kanban (`/`) et Vue Liste (`/liste`)

Les deux vues partagent :

**Header de page** (`px-6 py-4 border-b bg-white flex items-center justify-between`) :
- Titre "Liste projets" + **toggle Kanban/Liste** : `flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium`
  - Bouton actif : `bg-brand-600 text-white`
  - Bouton inactif : `text-gray-600 hover:bg-gray-50`
- Compteur projets : `text-xs bg-gray-100 rounded-full px-2 py-0.5`
- Badge "Lecture seule" pour les utilisateurs sans droits d'édition
- Bouton "Filtrer" (toggle) : actif en `bg-brand-50 border-brand-300 text-brand-700`, point bleu si filtres actifs
- Bouton "+ Nouveau projet" (responsable uniquement) : `bg-brand-600 text-white rounded-lg px-4 py-2 text-sm`

**Barre de filtres** (collapsible, `bg-gray-50 border-b px-6 py-2.5 flex flex-wrap gap-4`) :
- Filtres : Pôle, Référent, Tag (selects `text-xs border rounded-lg`)
- Checkbox "Afficher Terminé" + select durée (conditionnel)
- Séparateurs verticaux `w-px h-4 bg-gray-300` entre filtres
- Lien "Réinitialiser" si filtres actifs

**Vue Kanban spécifique** :
- Board : `flex gap-3 h-full`, colonnes flexibles `flex-1 min-w-0`
- **Colonnes** : `bg-gray-50 rounded-xl border-t-4` avec couleur par statut :
  - Non validé : `border-t-gray-400`
  - À planifier : `border-t-yellow-400`
  - Planifié : `border-t-blue-400`
  - En cours : `border-t-orange-400`
  - Terminé : `border-t-green-400`
- Highlight drop zone : `bg-brand-50` quand `isOver`
- Compteur par colonne : badge `bg-white border rounded-full`
- **Cartes projet** (`bg-white border rounded-lg p-2 shadow-sm`) :
  - Cursor `grab` / `grabbing` si draggable
  - Titre cliquable (ouvre le panel détail) `text-xs font-semibold line-clamp-2`
  - Badges pôle (brand) + statut (pill coloré) en ligne
  - Tags : `text-[9px] bg-gray-100 text-gray-500 rounded-full`
  - Date butoire : `text-[10px] text-gray-400`
  - Jauge tâches + % avancement (h-1 rounded-full)
  - Boutons Modifier/Supprimer : `opacity-0 group-hover:opacity-100`

**Vue Liste spécifique** :
- Tableau `min-w-full text-sm border-collapse`
- En-tête sticky `bg-gray-50 border-b sticky top-0 z-10`
- Colonnes triables (clic sur th) : icône ↕ (gris) / ↑↓ (brand) selon tri actif
- Ligne : `hover:bg-gray-50/60 transition-colors group`
- Titre cliquable → panel détail
- Tags sous le titre : `text-[9px] bg-gray-100`
- Date butoire dépassée : `text-red-600 font-semibold` + ⚠
- **Cellule Durée** : valeur en jours + temps consommé entre parenthèses + jauge h-1 (verte ou rouge si dépassé)
- **Cellule Tâches** : `X/total` + % + jauge h-1.5 brand-500
- **Cellule Avancement** : % + jauge h-1.5 (amber-400 / green-500 si 100%)
- Boutons Modifier/Supprimer : `opacity-0 group-hover:opacity-100`

### 4.3 Gantt (`/gantt`)

- Layout split : panneau gauche (liste projets, largeur redimensionnable par drag, défaut 208px) + zone timeline scrollable horizontalement
- **Zoom** : 3 niveaux — `jour`, `semaine`, `mois` (boutons toggle)
- **Headers timeline** : mois/semaines selon zoom, colonnes de jours avec fond weekend
- **Barres Gantt** : colorées par projet (palette de 10 couleurs), déplaçables et redimensionnables par drag (responsable uniquement)
- **Barres tâches** : visibles si la ligne projet est expandée (toggle ▶)
- **Flèches dépendances** : SVG tracé entre tâches liées
- **Tooltip** : apparaît au survol d'une barre (titre, dates, durée, ressources)
- **Filtres** : statuts (checkboxes), référent, pôle, tag, plage de dates (DateRangeFilter)
- La colonne "Terminé" est exclue par défaut (`GANTT_STATUTS = ['a_planifier', 'planifie', 'en_cours']`)
- Ressources d'une tâche : avatars initiales `getInitials(nom)` en cercles colorés

### 4.4 Synthèse (`/synthese`)

- Page scrollable `max-w-4xl mx-auto px-6 py-6`
- **Tuiles KPI** (`rounded-2xl p-5 border shadow-sm`) : icône dans carré coloré + grand nombre + label
  - Couleurs disponibles : `red`, `amber`, `blue`, `green`, `purple`, `gray`
  - Tuiles cliquables (navigent vers la page liée)
- **Tuiles Progress** : label + grand % + barre de progression épaisse (h-3) + sous-total
- **Sections** : `text-xs font-bold text-gray-400 uppercase tracking-widest` comme titre
- Données : projets en retard, projets actifs, tâches à faire/en cours, demandes en attente

### 4.5 Mes tâches (`/mes-taches`)

- Liste des tâches assignées à l'utilisateur connecté
- Filtrables par statut, regroupées par projet
- Chaque tâche : possibilité d'ouvrir une modale "Nouvelle activité" pour saisir du temps consommé

### 4.6 Mes demandes (`/mes-demandes`)

- Liste des demandes émises par l'utilisateur (terminer, modifier durée/date)
- Statut : `en_attente` (amber), `valide` (green), `refuse` (red) — badges colorés

### 4.7 À valider (`/demandes`) — responsable uniquement

- Liste des demandes en attente de validation
- Actions : Valider / Refuser directement dans la liste

### 4.8 Administration (`/admin`) — responsable / direction_generale

- Page `max-w-5xl mx-auto px-6 py-6`
- **Tabs** : `border-b border-gray-200`, onglet actif `border-brand-600 text-brand-700 border-b-2`, inactif transparent
- Onglets : Ressources, Pôles, Tags, Catégories, Journal
  - "Pôles" visible par tous les admins
  - "Journal" visible par tous les admins (log d'activité)
- Contenu de chaque onglet : tableau CRUD avec boutons Ajouter / Modifier / Supprimer

### 4.9 Corbeille (`/corbeille`) — responsable / direction_generale

- Liste des projets supprimés, avec possibilité de restauration

---

## 5. Composants communs

### Modal (`Modal.tsx`)

- Overlay : `fixed inset-0 bg-black/50 z-50 flex items-center justify-center`
- Boîte : `bg-white rounded-2xl shadow-xl` avec tailles `sm / md / lg`
- Header : titre + bouton ✕ fermeture
- Contenu scrollable si nécessaire

### ProjetDetailPanel

- Implémenté comme une `Modal` taille `lg`
- **Section infos projet** : `bg-gray-50 rounded-lg p-3`
  - Badges statut + pôle + tags + catégories en ligne
  - Méta : référent, date butoire, durée estimée, durée réelle, temps consommé
  - Description en texte gris
  - Barre d'avancement projet (h-1.5)
- **Section tâches** : header gris `bg-gray-100 rounded-lg` avec compteur terminées/total + bouton "+ Nouvelle tâche"
- Chaque tâche : `border rounded-lg p-3 group hover:border-gray-300`
  - Titre + badge statut + description + méta (durée, ressources)
  - Jauge avancement tâche (h-1) avec couleur dynamique (brand / green / red si dépassé)
  - Section dépendances : badges bleus `bg-blue-50 text-blue-700 border-blue-200 rounded-full` + bouton "+ Lier" en tirets

### ConfirmDialog

- Modal taille `sm` avec message de confirmation
- Boutons : Annuler (outline) + Confirmer (rouge pour suppression)
- Affiche l'erreur backend si la suppression échoue

### Formulaires (ProjetFormModal, TacheFormModal)

- Champs via composant `FormField` : label + input/select/textarea
- Validation Zod + react-hook-form
- Erreurs inline sous le champ en `text-xs text-red-600`
- Bouton submit : `bg-brand-600 text-white`, disabled pendant l'envoi

### Barres de progression

- Hauteur : `h-1` (tâche inline), `h-1.5` (projet liste/détail), `h-3` (synthèse)
- Toujours `rounded-full overflow-hidden` sur le fond + `rounded-full transition-all` sur la barre
- Couleur : `bg-brand-500` (en cours), `bg-green-500` (100%), `bg-red-500` (dépassé), `bg-amber-400` (avancement manuel)

---

## 6. Patterns d'interaction

### Visibilité des actions au hover

Les boutons d'action (Modifier, Supprimer) sont masqués par défaut :
```
opacity-0 group-hover:opacity-100 transition-opacity
```
Le parent porte la classe `group`.

### Badges compteurs (notifications)

```html
<span class="min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
  3
</span>
```

### Drag & Drop (Kanban)

- Librairie : `@dnd-kit/core` + `@dnd-kit/sortable`
- Activation : `PointerSensor` avec `distance: 5` (évite les drags accidentels)
- Collision : `closestCorners`
- Dragging uniquement si `isResponsable`
- La carte en cours de drag a `opacity: 0.5`
- `DragOverlay` affiche la carte sans handle

### Tri de tableau

- Clic sur en-tête de colonne : bascule asc/desc
- Icône : `↕` gris (non trié), `↑` / `↓` brand (trié)
- Les valeurs nulles/vides sont toujours placées en dernier

### Filtres persistants dans la session

- Les filtres sont dans le state local React (non persistés en URL)
- La barre se toggle via un bouton "Filtrer"
- Un point bleu sur le bouton indique la présence de filtres actifs
- Lien "Réinitialiser" ramène aux valeurs par défaut

---

## 7. Gestion des droits dans l'UI

| Rôle               | Kanban drag | Créer projet | Modifier projet | Admin | Corbeille |
|--------------------|-------------|--------------|-----------------|-------|-----------|
| `utilisateur`      | Non         | Non          | Non (sauf si référent) | Non | Non |
| `responsable`      | Oui         | Oui          | Oui             | Oui   | Oui       |
| `direction_generale` | Oui       | Oui          | Oui             | Oui (tous onglets) | Oui |

- Les utilisateurs voient le badge "Lecture seule" sur les pages projets
- Les boutons Modifier/Supprimer ne s'affichent pas si l'utilisateur n'a pas les droits
- Le référent d'un projet peut modifier ce projet même s'il est simple utilisateur

---

## 8. États vides et chargement

- **Chargement** : `flex items-center justify-center h-full text-sm text-gray-500` avec texte "Chargement..."
- **Erreur** : même disposition, `text-red-500`
- **Liste vide** : message centré `text-sm text-gray-400`
- **Valeur absente** dans un tableau : tiret `—` en `text-gray-300`
