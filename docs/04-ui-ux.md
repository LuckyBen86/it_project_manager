# UI/UX — IT Project Manager

Ce document décrit les conventions visuelles, les patterns d'interaction et la structure des pages de l'application. Il sert de référentiel pour recréer ou étendre l'interface.

**Principes généraux non négociables :**
- **Responsive first — écrans ET interactions tactiles** : l'application doit être pleinement utilisable sur smartphone et appareils nomades. Cela implique deux dimensions indissociables :
  - **Adaptation de la mise en page** : chaque page, composant et modal s'adapte aux petits écrans (320 px et plus) via les breakpoints Tailwind `sm` / `md` / `lg`.
  - **Interactions tactiles** : toutes les interactions doivent fonctionner au doigt, sans souris. Les contraintes spécifiques au tactile sont les suivantes :
    - **Zone de tap minimale** : toute cible interactive (bouton, lien, icône, toggle) fait au minimum **44 × 44 px** pour être activable confortablement au doigt (recommandation Apple/Google HIG).
    - **Pas de hover-only** : aucune action ou information ne doit être accessible uniquement au survol (`hover`). Ce qui est affiché au `group-hover` (boutons Modifier/Supprimer) doit avoir un équivalent tactile — par exemple un bouton "…" toujours visible sur mobile, ou une action accessible via un appui long.
    - **Drag & drop tactile** : les interactions de glisser-déposer (Kanban, Gantt) doivent utiliser des events compatibles touch (`onTouchStart`, `onTouchMove`, `onTouchEnd`) ou une librairie gérant nativement le tactile (ex. `@dnd-kit` avec `TouchSensor`).
    - **Sous-menus au tap** : les sous-menus de la navbar (Projets, Mon espace) s'ouvrent au tap, pas au hover. Un tap en dehors ferme le sous-menu ouvert.
    - **Scrolls natifs** : les zones scrollables (colonnes Kanban, Gantt, listes) utilisent le scroll natif du navigateur (`overflow-x-auto`, `-webkit-overflow-scrolling: touch`) sans bloquer le scroll de la page parente.
    - **Espacement entre éléments** : prévoir un `gap` suffisant entre les éléments interactifs proches pour éviter les taps accidentels.
- **Pas de fermeture de modal au clic extérieur** : aucune fenêtre de saisie (formulaire, confirmation, panel détail) ne se ferme au clic sur l'overlay. La fermeture se fait uniquement via un bouton dédié (✕ ou Annuler), pour protéger la saisie en cours.
- **Onglets plutôt que colonnes dans les modales** : lorsqu'une modale contient plusieurs blocs d'informations distincts, ils sont organisés en **onglets** (tabs) et non en colonnes côte à côte. Cela améliore la lisibilité sur tous les formats d'écran et évite les layouts surchargés. Exemple : la modale projet comporte un onglet "Informations" (métadonnées du projet) et un onglet "Tâches" (liste des tâches associées).

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

**Mode sombre :** Tailwind configuré en mode `class` (`darkMode: 'class'`). Toutes les couleurs de fond, texte, bordure et ombre doivent avoir leur variante `dark:` correspondante. Les tokens `brand-*` restent identiques en dark mode ; seuls les gris de fond et de surface sont inversés.

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

**Couleurs de priorité projet (badges pill)**

| Priorité | Classes Tailwind |
|----------|-----------------|
| Faible | `bg-gray-100 text-gray-500` |
| Moyenne | `bg-blue-100 text-blue-700` |
| Haute | `bg-orange-100 text-orange-700` |
| Critique | `bg-red-100 text-red-700 font-semibold` |

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

**Responsive :** sur mobile, la zone de contenu occupe toute la largeur. Les paddings horizontaux sont réduits (`px-3` au lieu de `px-6`). Les colonnes Kanban défilent horizontalement (`overflow-x-auto`). Le Gantt conserve son scroll horizontal natif.

---

## 3. Navbar (`Layout.tsx`)

**Responsive :** sur mobile, les liens de navigation principaux sont masqués ou repliés dans un menu burger. Le menu utilisateur reste accessible. La navbar ne doit jamais déborder horizontalement.

- **Fond** : `bg-white`, bordure basse `border-b border-gray-200`
- **Logo** : icône SVG `favicon.svg` (w-7 h-7) + texte "IT Project Manager" (`font-bold text-lg text-gray-900`)
- **Navigation principale** (toujours visible) :
  - **"Projets"** → lien avec chevron, sous-menu :
    - "Kanban" → `/`
    - "Liste" → `/liste`
    - "Gantt" → `/gantt`
  - **"Mon espace"** → lien avec chevron, sous-menu :
    - "Synthèse" → `/synthese`
    - "Mes tâches" → `/mes-taches`
    - "Mes demandes" → `/mes-demandes`
    - "À valider" → `/demandes` *(visible uniquement si `responsable` ou `direction_generale`)*
- **Style des liens nav** : `px-3 py-1.5 rounded-md text-sm font-medium`
  - Actif : `bg-brand-50 text-brand-700`
  - Inactif : `text-gray-600 hover:text-gray-900 hover:bg-gray-100`
  - "Projets" actif si route courante ∈ `/`, `/liste`, `/gantt`
  - "Mon espace" actif si route courante ∈ `/synthese`, `/mes-taches`, `/mes-demandes`, `/demandes`
- **Sous-menus** : `absolute bg-white border rounded-xl shadow-lg min-w-[160px] z-50`
  - Chaque entrée : `px-4 py-2 text-sm text-gray-700 hover:bg-gray-50`
  - Entrée active (vue courante) : `text-brand-700 font-medium bg-brand-50`
- **Toggle mode clair / sombre** : icône ☀️ / 🌙 dans la navbar, à gauche du menu utilisateur. Bascule la classe `dark` sur `<html>`. Préférence persistée en `localStorage`. Respect de `prefers-color-scheme` au premier chargement (défaut automatique).

- **Menu utilisateur** (dropdown, coin droit) :
  - Affiche le nom + badge rôle (`text-xs bg-gray-100 text-gray-500 capitalize rounded`)
  - Badge rouge si demandes en attente (compteur) — pointe vers "À valider" dans "Mon espace" (responsable/DG) ou vers "Mes demandes" (utilisateur)
  - Chevron animé (rotation 180° à l'ouverture)
  - **Contenu dropdown** : `bg-white border rounded-xl shadow-lg min-w-[200px]`
    - *(si responsable/direction_generale)* : "Administration" → `/admin`, "Corbeille" → `/corbeille`, séparateur
    - "Déconnexion" (texte rouge, hover `bg-red-50`)

---

## 4. Pages et patterns par page

### 4.1 Login (`/login`)

- Fond : `bg-gray-50 min-h-screen flex items-center justify-center`
- Card centrale : `max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8`
- Logo (w-9 h-9) + titre h1 `text-2xl font-bold`

**Étape 1 — saisie de l'email (toujours affichée en premier) :**
- Champ email unique + bouton "Continuer"
- Placeholder : `votre@email.fr`
- À la soumission, le frontend interroge le backend (`POST /auth/check-email`) pour déterminer le mode d'authentification de cet email

**Étape 2a — redirection Entra ID :**
- Si le compte est Entra : affichage bref d'un message `"Redirection vers Microsoft..."` puis redirection automatique vers `login.microsoftonline.com`
- Après authentification Microsoft, retour sur l'application (callback) qui finalise la session

**Étape 2b — saisie du mot de passe (compte local) :**
- Si le compte est local (admin) : le champ mot de passe apparaît sous l'email (ou la page affiche l'étape 2 avec l'email pré-rempli en lecture seule + champ mot de passe)
- Placeholder mot de passe : `••••••••`
- Lien "Modifier l'email" pour revenir à l'étape 1

**Erreurs et états :**
- Erreur globale : bloc `bg-red-50 text-red-600 rounded-lg px-3 py-2`
- Email inconnu : `"Aucun compte associé à cet email."` (affiché dès l'étape 1)
- Mot de passe incorrect : `"Mot de passe incorrect."` (ne pas distinguer email/mdp — RG-SEC)
- Bouton submit : pleine largeur, brand-600, disabled à 50% d'opacité pendant l'envoi
- **RG reminder** : après 10 tentatives échouées en 15 min, afficher `"Trop de tentatives. Réessayez dans quelques minutes."` à la place du formulaire

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
- **Légende Kanban** : affichée sous le board (ou en tooltip sur le bouton "?") :
  > `Glissez une carte d'une colonne à l'autre pour changer le statut du projet. Cliquez sur une carte pour voir le détail.`
  > Visible uniquement pour les `responsable` / `direction_generale` (les `utilisateur` voient : `"Vous êtes en lecture seule"`)
- **Cartes projet** (`bg-white border rounded-lg p-2 shadow-sm`) :
  - Cursor `grab` / `grabbing` si draggable, `default` sinon
  - Titre cliquable (ouvre le panel détail) `text-xs font-semibold line-clamp-2`
  - Badges pôle (brand) + statut (pill coloré) + **priorité** (pill coloré selon le niveau) en ligne
  - Tags : `text-[9px] bg-gray-100 text-gray-500 rounded-full`
  - Date butoire : `text-[10px] text-gray-400` — devient `text-red-500 font-semibold` si dépassée, avec tooltip `"Date butoire dépassée"`
  - Jauge tâches + % avancement (h-1 rounded-full) — tooltip au survol : `"X tâches terminées sur Y — avancement : Z%"`
  - Boutons Modifier/Supprimer : `opacity-0 group-hover:opacity-100`

**Vue Liste spécifique** :
- Tableau `min-w-full text-sm border-collapse`
- En-tête sticky `bg-gray-50 border-b sticky top-0 z-10`
- Colonnes triables (clic sur th) : icône ↕ (gris) / ↑↓ (brand) selon tri actif — tooltip sur th : `"Cliquer pour trier"`
- Ligne : `hover:bg-gray-50/60 transition-colors group`
- Titre cliquable → panel détail
- Tags sous le titre : `text-[9px] bg-gray-100`
- Date butoire dépassée : `text-red-600 font-semibold` + ⚠ — tooltip : `"Date butoire dépassée depuis X jour(s)"`
- **Cellule Durée** : valeur en jours + temps consommé entre parenthèses + jauge h-1 (verte ou rouge si dépassé)
  - Tooltip : `"Durée estimée : X j — Temps consommé : Y j"` ; si rouge : `"Dépassement de Z jour(s)"`
- **Cellule Tâches** : `X/total` + % + jauge h-1.5 brand-500 — tooltip : `"X tâches terminées sur Y"`
- **Cellule Avancement** : % + jauge h-1.5 (amber-400 / green-500 si 100%) — tooltip : `"Avancement calculé automatiquement"` ou `"Avancement saisi manuellement"` selon le mode
- Boutons Modifier/Supprimer : `opacity-0 group-hover:opacity-100`
- **Légende sous le tableau** (`text-xs text-gray-400 mt-2 flex gap-4`) :
  - `🟥 Durée dépassée` · `⚠ Date butoire dépassée` · `↑↓ Colonnes triables` · `Cliquez sur un projet pour voir le détail`

### 4.3 Gantt (`/gantt`)

- Layout split : panneau gauche (liste projets, largeur redimensionnable par drag, défaut 208px) + zone timeline scrollable horizontalement
- **Zoom** : 3 niveaux — `jour`, `semaine`, `mois` (boutons toggle)
- **Headers timeline** : mois/semaines selon zoom, colonnes de jours avec fond weekend
- **Barres Gantt** : colorées par projet (palette de 10 couleurs), déplaçables et redimensionnables par drag (responsable uniquement)
  - Cursor `grab` sur la barre entière (déplacement), `ew-resize` sur le bord droit (resize)
  - Pour les `utilisateur` : cursor `default`, pas de drag possible
- **Barres tâches** : visibles si la ligne projet est expandée (toggle ▶)
- **Flèches dépendances tâches** : SVG tracé entre tâches liées — tooltip au survol : `"Dépend de : [Titre tâche]"`
- **Flèches dépendances projets** : SVG tracé entre barres de projets liés (style distinct des dépendances de tâches, ex. trait plus épais ou couleur différente) — tooltip : `"Ce projet dépend de : [Titre projet]"`
- **Tooltip barre** : apparaît au survol (titre, date début, date fin, durée en jours ouvrés, ressources assignées)
- **Filtres** : statuts (checkboxes), référent, pôle, tag, plage de dates (DateRangeFilter)
- La colonne "Terminé" est exclue par défaut (`GANTT_STATUTS = ['a_planifier', 'planifie', 'en_cours']`)
- Ressources d'une tâche : avatars initiales `getInitials(nom)` en cercles colorés — tooltip au survol de l'avatar : nom complet de la ressource
- **Légende sous le Gantt** (`text-xs text-gray-400 mt-2 flex gap-6`) :
  - `■ Couleur` = projet · `▬` fin de barre = redimensionner la durée · `→` flèche = dépendance entre tâches
  - `▓` fond grisé = week-end (non compté dans la durée)
  - *(responsable/DG uniquement)* : `Glissez une barre pour déplacer · Étirez le bord droit pour modifier la durée`
- **Bandeau d'information** si rôle `utilisateur` : `"Vous consultez le planning en lecture seule. Contactez un responsable pour modifier les dates."` (`bg-blue-50 text-blue-700 text-xs px-4 py-2 border-b border-blue-100`)

### 4.4 Synthèse (`/synthese`)

- Page scrollable `max-w-4xl mx-auto px-6 py-6`
- **Tuiles KPI** (`rounded-2xl p-5 border shadow-sm`) : icône dans carré coloré + grand nombre + label
  - Couleurs disponibles : `red`, `amber`, `blue`, `green`, `purple`, `gray`
  - Tuiles cliquables (navigent vers la page liée) — tooltip : `"Cliquer pour voir le détail"`
- **Tuiles Progress** : label + grand % + barre de progression épaisse (h-3) + sous-total
- **Sections** : `text-xs font-bold text-gray-400 uppercase tracking-widest` comme titre
- Données : projets en retard, projets actifs, tâches à faire/en cours, demandes en attente
- **Aide contextuelle sur les KPIs** (tooltip ou texte sous la tuile, `text-xs text-gray-400`) :
  - "En retard" → `"Projets/tâches dont la date butoire est dépassée et le statut n'est pas Terminé"`
  - "En dépassement" → `"Temps consommé (activités) supérieur à la durée planifiée"`
  - "Sans données" → `"Ni durée ni date de début renseignées (hors projets Terminés)"`
  - "Prochaine échéance" → `"Date butoire dans les 5 prochains jours ouvrés"`
- **Périmètre affiché** : mention discrète sous le titre de la page (`text-xs text-gray-400`) indiquant le périmètre selon le rôle : `"Données limitées à vos pôles"` (responsable) ou `"Toutes les données"` (direction_generale)

### 4.5 Mes tâches (`/mes-taches`)

- Tâches assignées à l'utilisateur connecté
- **Toggle Vue Liste / Vue Planning** : `flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium` (même pattern que Kanban/Liste)
  - Bouton actif : `bg-brand-600 text-white` · Bouton inactif : `text-gray-600 hover:bg-gray-50`

---

#### Vue Liste (défaut)

- Tâches filtrables par statut, regroupées par projet
- Chaque tâche : possibilité d'ouvrir une modale "Nouvelle activité" pour saisir du temps consommé
- **Aide contextuelle sur le bouton "+ Activité"** :
  - Si tâche `terminée` : bouton masqué
  - Si tâche `en attente de validation` : bouton désactivé, tooltip `"Une demande de validation est en cours sur cette tâche"`
- **Aide sur les demandes de validation** : bandeau informatif (`bg-blue-50`) : `"Pour terminer une tâche ou modifier sa durée / date de début, utilisez le bouton 'Demande' — votre responsable recevra la demande pour validation."`
- **Légende des statuts de tâche** (sous les filtres, `text-xs text-gray-400`) :
  - `⬜ À faire` · `🟠 En cours` · `✅ Terminé` · `🕐 En attente de validation`

---

#### Vue Planning

Affiche les tâches **non terminées** (`à faire`, `en cours`) sous forme de planning personnel (mini-Gantt).

**Structure :**
- Axe de temps horizontal (semaines) — même logique de rendu que le Gantt global mais centré sur l'utilisateur
- Zoom : vue **semaine** et vue **mois** (boutons toggle, même style que le Gantt)
- Chaque tâche est représentée par une barre colorée selon son statut :
  - À faire : `bg-gray-300`
  - En cours : `bg-brand-500`
  - En dépassement : `bg-red-500`
- Les week-ends apparaissent en fond grisé (non comptés dans la durée)
- Les barres sont **en lecture seule** (pas de drag & drop — l'utilisateur ne peut pas modifier les dates)
- Tooltip au survol d'une barre : titre de la tâche, projet parent, date début, date fin calculée, durée, % avancement

**Tâches sans planification :**
- Les tâches non terminées sans `dateDebut` ou sans `duree` ne peuvent pas être positionnées sur l'axe
- Elles sont regroupées dans un encadré **"Sans planification"** sous le planning (`bg-amber-50 border border-amber-200 rounded-lg p-3`)
- Contenu : liste compacte des tâches avec nom, projet parent et bouton d'accès rapide à la tâche
- Aide : `"Ces tâches n'ont pas encore de date de début ou de durée planifiée. Contactez votre responsable pour les planifier."`

**Légende sous le planning** (`text-xs text-gray-400 mt-2 flex gap-4`) :
- `■ À faire` · `■ En cours` · `■ Dépassement` · `▓ Week-end`

**Pas de tâches à afficher :**
- Message : `"Toutes vos tâches en cours sont terminées, ou aucune n'est encore planifiée."` + lien vers la Vue Liste

### 4.6 Mes demandes (`/mes-demandes`)

- Liste des demandes émises par l'utilisateur (terminer, modifier durée/date)
- Statut : `en_attente` (amber), `valide` (green), `refuse` (red) — badges colorés
- **Légende des statuts** (`text-xs text-gray-400`) :
  - `🟡 En attente` = votre responsable n'a pas encore traité la demande · `🟢 Validée` = modification appliquée · `🔴 Refusée` = voir le commentaire de refus
- Commentaire de refus : affiché en bloc `bg-red-50 text-red-700 rounded-lg text-xs px-3 py-2` sous la demande
- Demandes archivées : masquées par défaut, toggle "Afficher les archivées" en bas de page

### 4.7 À valider (`/demandes`) — responsable uniquement

- Liste des demandes en attente de validation
- Actions : Valider / Refuser directement dans la liste
- **Aide contextuelle** : tooltip sur le bouton "Valider" → `"Applique la modification demandée immédiatement (statut, durée ou date de début)"` ; sur "Refuser" → `"Permet d'ajouter un commentaire visible par l'auteur de la demande"`
- **Rappel RG** : texte discret sous le titre de la page (`text-xs text-gray-400`) : `"Les demandes listées concernent uniquement les projets de vos pôles."`

### 4.8 Administration (`/admin`) — responsable / direction_generale

- Page `max-w-5xl mx-auto px-6 py-6`
- **Tabs** : `border-b border-gray-200`, onglet actif `border-brand-600 text-brand-700 border-b-2`, inactif transparent
- Onglets : Ressources, Pôles, Tags, Catégories, Journal
  - "Pôles" visible par tous les admins
  - "Journal" visible par tous les admins (log d'activité)
- Contenu de chaque onglet : tableau CRUD avec boutons Ajouter / Modifier / Supprimer

**Onglet Ressources :**
- Tooltip sur le bouton "Promouvoir responsable" : `"Donne à cet utilisateur les droits de gestion sur ses pôles (création de projets, tâches, administration)"`
- Champ email : placeholder `prenom.nom@entreprise.fr` + aide `"L'email sert d'identifiant de connexion, il ne peut pas être modifié après création."`
- Champ **% d'activité** : input numérique (`min=0 max=100 step=1`), placeholder `100`, aide : `"Part du temps de travail consacrée aux projets de l'application. Impacts les durées modulées des tâches assignées."` — défaut 100
- **RG reminder** : `"Le rôle par défaut d'une nouvelle ressource est 'Utilisateur'. Seul un responsable ou la direction peut le modifier."`

**Import depuis Entra ID :**
- Bouton `"Importer depuis Entra ID"` (direction_generale uniquement) ouvre une modale de recherche dans l'annuaire Microsoft
- La modale propose une recherche par nom/prénom/email dans l'annuaire Entra, avec sélection du pôle avant confirmation
- Aide dans la modale : `"L'utilisateur sera créé avec le rôle 'Utilisateur'. Vous pourrez modifier son rôle et son pôle après l'import."`
- Badge distinctif sur les ressources importées depuis Entra : `"Entra ID"` (`text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2`)

**Droits de modification selon le rôle :**

| Action | `direction_generale` | `responsable` |
|--------|----------------------|---------------|
| Importer depuis Entra | Oui | Non |
| Modifier le pôle d'une ressource | Oui | Non |
| Modifier le rôle (jusqu'à `responsable`) | Oui | Oui (ses pôles uniquement) |
| Attribuer le rôle `direction_generale` | Oui | Non |
| Modifier nom / email | Oui | Non |

- Le champ "Pôle" est **en lecture seule** pour les `responsable` (affiché mais non éditable, avec tooltip : `"Seule la direction peut modifier le pôle d'une ressource."`)
- Le sélecteur de rôle ne propose `direction_generale` que si l'utilisateur connecté est lui-même `direction_generale`

**Onglet Pôles :**
- Aide sous le champ nom : `"Le pôle regroupe des projets et des responsables. Un projet doit obligatoirement être rattaché à un pôle."`

**Onglet Tags :**
- Aide : `"Les tags sont libres et peuvent être associés aux projets ou aux tâches. Précisez le type (Projet / Tâche) lors de la création."`

**Onglet Journal :**
- **Légende des types d'action** (au-dessus des filtres) :
  - `🔄 Statut changé` · `📅 Date modifiée` · `🗑 Suppression`
- Aide sur le filtre : `"Filtrez par type d'action ou par entité (projet / tâche)"`
- **RG reminder** sous le tableau : `"Le journal est en lecture seule. Les entrées sont générées automatiquement et ne peuvent pas être supprimées."`

### 4.9 Corbeille (`/corbeille`) — responsable / direction_generale

- Deux sections : **Projets supprimés** + **Tâches supprimées indépendamment**
- Chaque entrée affiche : titre, date de suppression, auteur de la suppression
- **Aide contextuelle sur la restauration** :
  - Bouton "Restaurer" projet — tooltip : `"Restaure le projet et toutes les tâches supprimées avec lui en cascade. Les tâches supprimées indépendamment avant ne sont pas restaurées."`
  - Bouton "Restaurer" tâche — tooltip : `"Disponible uniquement si le projet parent n'est pas supprimé"` ; bouton désactivé (`opacity-50 cursor-not-allowed`) si projet parent supprimé
  - Quand le bouton est désactivé : message explicite sous la tâche : `"Le projet parent est supprimé. Restaurez d'abord le projet."`
- **Légende** (haut de page, `bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800`) :
  > `"Les éléments dans la corbeille ne sont pas définitivement supprimés. Vous ne voyez que les éléments que vous avez vous-même supprimés."`

---

## 5. Composants communs

### Modal (`Modal.tsx`)

- Overlay : `fixed inset-0 bg-black/50 z-50 flex items-center justify-center`
- Boîte : `bg-white rounded-2xl shadow-xl` avec tailles `sm / md / lg`
- Header : titre + bouton ✕ fermeture
- Contenu scrollable si nécessaire
- **Fermeture uniquement via le bouton dédié (✕ ou Annuler)** : un clic sur l'overlay de fond ne ferme PAS la modale. Ce comportement protège la saisie en cours contre les fermetures accidentelles. S'applique à toutes les modales de l'application (formulaires, confirmations, panels détail).

### ProjetDetailPanel

- Implémenté comme une `Modal` taille `lg`
- **Structure en onglets** (principe général des modales multi-blocs) :
  - **Onglet "Informations"** : métadonnées du projet
    - Badges statut + pôle + **priorité** + tags + catégories en ligne
    - Méta : référent, date butoire, durée estimée, durée réelle, temps consommé
      - Tooltip sur "Durée estimée" : `"Somme des durées planifiées des tâches"`
      - Tooltip sur "Temps consommé" : `"Somme des activités saisies sur toutes les tâches"`
    - Description en texte gris
    - Barre d'avancement projet (h-1.5) — tooltip : `"Avancement : X% — calculé automatiquement (pondéré par la durée des tâches)"` ou `"... — saisi manuellement"`
    - **Section dépendances projet** : badges des projets prédécesseurs (`bg-purple-50 text-purple-700 border-purple-200 rounded-full`) + bouton "+ Lier un projet" en tirets — tooltip sur chaque badge : `"Ce projet dépend de : [Titre]"`
    - Actions : Modifier le projet, Supprimer le projet
  - **Onglet "Tâches"** : liste des tâches associées au projet
    - Header avec compteur terminées/total + bouton "+ Nouvelle tâche"
    - Chaque tâche : `border rounded-lg p-3 group hover:border-gray-300`
      - Titre + badge statut + description + méta (durée, ressources)
      - Jauge avancement tâche (h-1) avec couleur dynamique :
        - Bleu brand : avancement en cours (normal)
        - Vert : 100% terminé
        - **Rouge** : dépassement (activités > durée) — tooltip : `"Dépassement : X j consommés pour Y j prévus (+Z j)"`
      - Icône ⚠ rouge en cas de dépassement — tooltip : `"Le temps consommé dépasse la durée planifiée. Ce n'est pas bloquant."`
      - Texte sous la barre (si ≥1 activité) : `"X j consommés / Y j prévus"` — en rouge + `(+Z j)` si dépassement
      - Section dépendances : badges bleus `bg-blue-50 text-blue-700 border-blue-200 rounded-full` — tooltip sur chaque badge : `"Cette tâche dépend de : [Titre]"` + bouton "+ Lier" en tirets
      - Bouton Supprimer tâche : tooltip si tâche a des activités → `"Impossible : cette tâche contient des activités saisies. Archivez-la depuis la corbeille."` ; bouton désactivé (`opacity-50 cursor-not-allowed`) dans ce cas

### ConfirmDialog

- Modal taille `sm` avec message de confirmation
- Boutons : Annuler (outline) + Confirmer (rouge pour suppression)
- Affiche l'erreur backend si la suppression échoue (ex : `"Impossible de supprimer ce projet : il contient des tâches avec des activités saisies."` — RG-PROJET-05)
- **Aide contextuelle dans la boîte de confirmation de suppression d'un projet** :
  > `"Cette action déplacera le projet et toutes ses tâches dans la Corbeille. Vous pourrez les restaurer depuis la page Corbeille."` (`text-xs text-gray-500 mt-1`)

### Formulaires (ProjetFormModal, TacheFormModal)

- Champs via composant `FormField` : label + input/select/textarea
- Validation Zod + react-hook-form
- Erreurs inline sous le champ en `text-xs text-red-600`
- Bouton submit : `bg-brand-600 text-white`, disabled pendant l'envoi

**Aides à la saisie — Formulaire Projet :**

| Champ | Placeholder | Texte d'aide sous le champ |
|-------|-------------|----------------------------|
| Titre | `Nom du projet` | — |
| Priorité | `Moyenne` (défaut) | — — sélecteur : Faible · Moyenne · Haute · Critique |
| Pôle | `Sélectionner un pôle` | `"Un projet doit obligatoirement appartenir à un pôle."` |
| Référent | `Sélectionner un référent` | `"Le référent peut modifier ce projet même sans rôle responsable."` |
| Description | `Décrivez l'objectif du projet...` | — |
| Date de début | — | `"Utilisée pour le positionnement dans le Gantt et le calcul de la date de fin."` |
| Durée | — | `"En jours ouvrés (hors week-ends). Durée estimée globale du projet."` |
| Date butoire | — | `"Date limite de livraison fixée par le responsable. Affichée en rouge si dépassée."` |
| Avancement auto | — (toggle) | `"Si activé, l'avancement est calculé automatiquement à partir des tâches (pondéré par leur durée)."` |
| Avancement manuel | `0` | `"Saisissez un pourcentage entre 0 et 100."` (visible uniquement si auto désactivé) |
| Dépendances | `Sélectionner des projets prédécesseurs` | `"Ce projet ne peut pas démarrer avant la fin des projets sélectionnés. Le décalage se propage en cascade."` |

**Champs calculés affichés en lecture seule dans le détail projet :**
- **Durée totale modulée** : somme des durées modulées des tâches — libellé `"Durée modulée totale"`, badge `"calculé"` (`text-xs bg-gray-100 text-gray-500 rounded`), tooltip : `"Durée réaliste tenant compte du taux d'activité des ressources assignées."`
- **Date de fin** : calculée depuis `dateDebut + dureeTotaleModulee` — libellé `"Date de fin estimée"`, même badge `"calculé"`, tooltip : `"Calculée automatiquement : date de début + durée modulée totale (jours ouvrés). Distincte de la date butoire."` — affichée en rouge si postérieure à `dateButoire`

**Aides à la saisie — Formulaire Tâche :**

| Champ | Placeholder | Texte d'aide sous le champ |
|-------|-------------|----------------------------|
| Titre | `Nom de la tâche` | — |
| Description | `Décrivez la tâche...` | — |
| Ressources assignées | `Sélectionner des ressources` | `"Les ressources assignées pourront saisir des activités sur cette tâche."` |
| Date de début | — | `"Ne peut pas être antérieure à la date de début du projet."` |
| Durée | — | `"En jours ouvrés. Nécessaire pour le calcul automatique de l'avancement."` |
| Date butoire | — | `"Date limite de cette tâche."` |
| Dépendances | `Sélectionner des tâches prédécesseurs` | `"Cette tâche ne peut pas commencer avant la fin des tâches sélectionnées."` |
| Avancement auto | — (toggle) | `"Si activé, l'avancement = temps consommé (activités) / durée planifiée."` |
| Avancement manuel | `0` | `"Saisissez un pourcentage entre 0 et 100."` (visible uniquement si auto désactivé) |

**Champ calculé affiché en lecture seule sous le champ Durée :**
- **Durée modulée** : `"X j"` — badge `"calculé"`, tooltip : `"Durée ajustée en fonction du taux d'activité de la ressource assignée (taux le plus bas si plusieurs ressources). Formule : Durée / taux d'activité."` — s'affiche uniquement si au moins une ressource est assignée et que `duree` est renseignée.
- Si `tauxActivite = 100` : pas d'écart, le champ n'est pas affiché (ou affiche `"= durée prévue"`)
- Si plusieurs ressources avec taux différents : mention `"taux retenu : X% (Benjamin)"` sous la durée modulée

**Aides à la saisie — Formulaire Activité :**

| Champ | Placeholder | Texte d'aide sous le champ |
|-------|-------------|----------------------------|
| Description | `Ex : développement de la fonctionnalité X` | — |
| Date | — | `"Date à laquelle le travail a été effectué."` |
| Durée | `0.5` | `"En heures décimales (ex : 1.5 = 1h30). Minimum : 0.01."` |

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

## 8. Aides contextuelles — patterns généraux

### Tooltips

Tous les éléments interactifs non évidents portent un tooltip natif (`title="..."`) ou un composant tooltip dédié. Règles :
- **Icône seule** (sans libellé texte) : tooltip obligatoire
- **Bouton désactivé** : tooltip expliquant pourquoi (`cursor-not-allowed opacity-50`)
- **Badge ou jauge** : tooltip précisant la valeur et son interprétation
- **Champ de formulaire avec contrainte métier** : texte d'aide statique sous le champ (`text-xs text-gray-500 mt-0.5`)

### Boutons d'action bloqués

Quand une action est interdite par une règle de gestion (RG), le bouton reste visible mais est désactivé et porte un tooltip explicite. Ne jamais masquer silencieusement une action sans explication.

| Situation | Bouton | Tooltip |
|-----------|--------|---------|
| Supprimer un projet avec activités | Désactivé | `"Ce projet contient des tâches avec activités. Impossible de le supprimer."` |
| Supprimer une tâche avec activités | Désactivé | `"Cette tâche contient des activités saisies. Impossible de la supprimer."` |
| Ajouter une activité sur tâche terminée | Masqué | — (bouton absent) |
| Restaurer une tâche dont le projet est supprimé | Désactivé | `"Restaurez d'abord le projet parent."` |
| Action réservée au responsable | Désactivé | `"Action réservée aux responsables."` |

### Bandeaux d'information

Utilisés pour rappeler une règle de gestion ou un contexte particulier, sans bloquer l'utilisateur. Style : `rounded-lg px-4 py-3 text-sm flex items-start gap-2` avec variantes :

| Type | Couleur | Usage |
|------|---------|-------|
| Info | `bg-blue-50 text-blue-700 border border-blue-100` | Lecture seule, aide workflow |
| Avertissement | `bg-amber-50 text-amber-800 border border-amber-200` | Dépassement, attention |
| Succès | `bg-green-50 text-green-700 border border-green-100` | Confirmation action |
| Erreur | `bg-red-50 text-red-700 border border-red-100` | Erreur API, validation |

### Messages d'état vide

Les listes vides affichent toujours un message explicite ET une suggestion d'action :
- Kanban vide : `"Aucun projet dans cette colonne."` — pas de bouton (il est dans le header)
- Liste tâches vide : `"Aucune tâche sur ce projet."` + bouton `"+ Ajouter une tâche"` (si droits)
- Corbeille vide : `"Votre corbeille est vide. Les projets et tâches supprimés apparaîtront ici."`
- Journal vide (filtres actifs) : `"Aucun résultat pour ces filtres."` + lien `"Réinitialiser les filtres"`

---

## 9. États vides et chargement

- **Chargement** : `flex items-center justify-center h-full text-sm text-gray-500` avec texte "Chargement..."
- **Erreur** : même disposition, `text-red-500`
- **Liste vide** : message centré `text-sm text-gray-400`
- **Valeur absente** dans un tableau : tiret `—` en `text-gray-300`
