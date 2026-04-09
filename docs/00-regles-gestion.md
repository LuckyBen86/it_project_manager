# Cahier des Charges Fonctionnel — Gestionnaire de Projets IT

> Ce fichier décrit les règles de gestion fonctionnelles de l'application.
> - Si du code introduit une **nouvelle règle**, demander si elle doit être ajoutée ici.
> - Si du code **contredit une règle existante**, prévenir l'utilisateur avant de procéder.
> - Pour les flux UI, formulaires et comportements de chaque page, voir `01-fonctionnel.md`.

---

## RG-NAV — Navigation

### RG-NAV-01 : Authentification obligatoire
Toutes les vues de l'application sont accessibles uniquement aux utilisateurs authentifiés. Un utilisateur non connecté est systématiquement redirigé vers la page de connexion.

### RG-NAV-02 : Vues principales
L'application comporte les vues suivantes accessibles depuis la navigation :
- Vue **Kanban** (`/`) — vue par défaut
- Vue **Gantt** (`/gantt`)
- **Mes Tâches** (`/mes-taches`)
- **Synthèse** (`/synthese`)
- **Vue Charge** (`/charge`)
- **Corbeille** (`/corbeille`) — responsable et direction_generale uniquement
- **Demandes** (`/demandes`) — responsable et direction_generale uniquement
- **Mes Demandes** (`/mes-demandes`)
- **Administration** (`/admin`) — responsable et direction_generale uniquement

### RG-NAV-03 : Vue par défaut
À la connexion, l'utilisateur est redirigé vers la vue **Kanban**.

---

## RG-AUTH — Authentification

### RG-AUTH-01 : Deux modes d'authentification
L'application supporte deux modes d'authentification, configurables depuis l'espace Administration :
- **Entra ID (Azure AD)** : authentification SSO via le fournisseur d'identité Microsoft de l'organisation. Mode recommandé en production.
- **Compte local** : authentification par email / mot de passe stocké localement (bcrypt). Réservé au compte administrateur initial et aux environnements sans Entra ID.

Le flux de connexion est identique pour les deux modes en point d'entrée : l'utilisateur saisit son email, l'application détermine le mode associé à ce compte, puis soit redirige vers Microsoft (Entra ID), soit affiche le champ mot de passe (compte local).

### RG-AUTH-02 : Première connexion
La toute première connexion s'effectue **obligatoirement avec le compte administrateur local** (credentials définis dans le `.env` via `SEED_ADMIN_*`). Ce compte permet ensuite de configurer Entra ID et de créer les autres ressources.

### RG-AUTH-03 : Coexistence des deux modes
Les deux modes peuvent coexister : le compte admin local reste toujours disponible comme accès de secours, même si Entra ID est activé. Les comptes Entra ID et les comptes locaux partagent le même modèle `Ressource` en base, avec un champ `authProvider` indiquant l'origine.

### RG-AUTH-04 : Gestion de session JWT
Quel que soit le mode d'authentification, la session applicative est maintenue via un access token JWT. Un refresh token permet de renouveler la session sans reconnexion manuelle.

### RG-AUTH-05 : Déconnexion
L'utilisateur peut se déconnecter depuis n'importe quelle vue. La déconnexion invalide les tokens côté client (et déclenche le logout Entra ID si applicable).

### RG-AUTH-06 : Expiration de session
Si l'access token expire et que le refresh token est invalide ou absent, l'utilisateur est redirigé vers la page de connexion.

---

## RG-ROLE — Rôles et Permissions

### RG-ROLE-01 : Trois niveaux de rôle
- **direction_generale** : accès total à tous les pôles et toutes les données. Hérite de tous les droits `responsable`.
- **responsable** : gestion des projets/tâches de ses pôles (via `responsablePole`). Accès en lecture et écriture, administration des catégories et des ressources de son périmètre.
- **utilisateur** : accès en lecture seule sur les vues générales + saisie d'activités sur ses tâches assignées.

### RG-ROLE-02 : Référent de projet
Un `utilisateur` peut être désigné **référent** d'un projet. Dans ce cas, il obtient des droits d'écriture sur ce projet (PATCH projet, CRUD tâches) même sans rôle `responsable`.

### RG-ROLE-03 : Périmètre de visibilité des projets
| Rôle | Projets visibles |
|------|-----------------|
| `direction_generale` | Tous les projets |
| `responsable` | Projets appartenant à ses pôles (via `responsablePole`) |
| `utilisateur` | Projets où il est assigné à ≥1 tâche OU référent |

### RG-ROLE-04 : Actions réservées au responsable (et direction_generale)
- Créer, modifier, supprimer un projet
- Créer, modifier, supprimer une tâche
- Changer le statut d'un projet (via Kanban drag & drop)
- Modifier les dates / durées via Gantt (drag & resize)
- Administrer les catégories, tags, pôles
- Gérer les ressources (utilisateurs)
- Promouvoir un utilisateur au rôle `responsable`
- Valider ou refuser les demandes de validation
- Accéder à la Corbeille, au Journal, à la page Administration

### RG-ROLE-05 : Feedback pour les actions non autorisées
Un `utilisateur` voit les contrôles d'édition désactivés ou masqués. Une tentative d'action non autorisée affiche un message d'erreur explicite. Le backend retourne `403 Forbidden`.

---

## RG-KANBAN — Vue Kanban

### RG-KANBAN-01 : Colonnes et ordre
La vue Kanban affiche exactement **5 colonnes** dans l'ordre immuable suivant :
1. Non validé
2. À planifier
3. Planifié
4. En cours
5. Terminé

### RG-KANBAN-02 : Contenu des cartes projet
Chaque carte affiche au minimum :
- Le titre du projet
- Le référent (nom)
- La date butoire
- Un badge de statut coloré
- La progression des tâches (ex : `3 / 5 terminées`)
- Tags (badges)
- Pôle

### RG-KANBAN-03 : Drag & drop entre colonnes
Un `responsable` ou `direction_generale` peut glisser une carte d'une colonne vers une autre. Le déplacement met à jour le statut du projet immédiatement (appel API en arrière-plan). Un `utilisateur` ne peut pas effectuer cette action.

### RG-KANBAN-04 : Tri des cartes
Dans chaque colonne, les cartes sont triées par **date butoire croissante** par défaut.

### RG-KANBAN-05 : Toggle Kanban / Liste
La vue peut basculer entre affichage Kanban (colonnes) et affichage tabulaire (liste des projets).

---

## RG-GANTT — Vue Gantt

### RG-GANTT-01 : Périmètre d'affichage
La vue Gantt affiche uniquement les projets dont le statut est : `à planifier`, `planifié`, `en cours`. Les projets `non validé` et `terminé` n'y apparaissent pas.

### RG-GANTT-02 : Représentation temporelle
Chaque projet est représenté par une barre horizontale positionnée sur un axe de temps.

### RG-GANTT-03 : Décalage d'un projet
Un `responsable` ou `direction_generale` peut glisser la barre d'un projet horizontalement pour modifier sa **date de début**. La durée est conservée ; la date de fin est recalculée automatiquement.

### RG-GANTT-04 : Modification de durée
Un `responsable` ou `direction_generale` peut étirer le **bord droit** de la barre pour modifier la **durée** du projet. La date de début reste fixe.

### RG-GANTT-05 : Tâches dans le Gantt
Les tâches d'un projet sont affichables en **sous-lignes** du projet dans le Gantt (expand/collapse). Elles suivent les mêmes règles de drag & resize que les projets.

### RG-GANTT-06 : Niveaux de zoom
L'axe de temps propose deux niveaux de zoom :
- Vue **semaine** : 40 px/jour ouvré, 4 px week-end
- Vue **mois** : 14 px/jour ouvré, 4 px week-end

### RG-GANTT-07 : Dépendances de tâches
Des flèches SVG relient les tâches ayant des dépendances. La date de début affichée est calculée côté frontend en tenant compte des dépendances (`computeTaskStartDates`), même si la `dateDebut` stockée en base est obsolète.

---

## RG-PROJET — Gestion des Projets

### RG-PROJET-01 : Champs obligatoires à la création
Les champs suivants sont obligatoires : **titre**, **pôle**. Le statut initial est automatiquement `non validé`.

### RG-PROJET-02 : Statut initial
Tout nouveau projet est créé avec le statut `non validé`.

### RG-PROJET-03 : Cycle de vie du statut
```
non_valide → a_planifier → planifie → en_cours → termine
```
- Changement via drag & drop Kanban
- Quand `dateDebut` est renseignée sans activités → statut forcé à `planifie`
- Quand `dateDebut` est renseignée avec des activités → statut forcé à `en_cours`

### RG-PROJET-04 : Suppression en cascade
La suppression d'un projet n'est pas définitive (soft delete). Le projet et toutes ses tâches non encore supprimées sont déplacés dans la **Corbeille**. Une **confirmation explicite** est demandée avant exécution.

### RG-PROJET-05 : Interdiction de suppression si activités présentes
La suppression d'un projet est **interdite** si au moins une de ses tâches (non encore supprimée) contient au moins une activité de saisie. Le backend retourne `409 Conflict` avec un message explicite. Le frontend affiche ce message à l'utilisateur dans la boîte de confirmation.

### RG-PROJET-06 : Priorité
Chaque projet possède un champ **priorité** parmi : `faible`, `moyenne`, `haute`, `critique`. La valeur par défaut est `moyenne`. La priorité est indicative (pas de blocage métier) mais est utilisée pour le tri et la mise en évidence visuelle.

### RG-PROJET-09 : Dépendances entre projets
Un projet peut dépendre d'un ou plusieurs autres projets du même système. La mécanique est identique aux dépendances entre tâches :
- La `dateDebut` d'un projet dépendant est **clampée** à la `dateFin` de son projet prédécesseur (calculée en jours ouvrés).
- Si la `dateFin` du prédécesseur est modifiée, le décalage se propage **en cascade** à tous les projets qui en dépendent (et récursivement à leurs dépendants).
- Les dépendances ne peuvent pas former un **cycle** : détection BFS côté backend, retour `409 Conflict` en cas de cycle.
- Un projet peut avoir plusieurs prédécesseurs ; sa `dateDebut` effective est alors `max(dateFin de tous ses prédécesseurs)`.

### RG-PROJET-10 : Catégories et tags
Les catégories et tags sont administrables par le `responsable`/`direction_generale`. Un projet peut ne pas avoir de catégorie ni de tag.

### RG-PROJET-07 : Durée totale modulée
Le champ **durée totale modulée** d'un projet est la somme des `dureeModulee` de toutes ses tâches non supprimées.
`dureeTotaleModulee = Σ dureeModulee des tâches`
Ce champ est calculé automatiquement et non modifiable manuellement. Il est recalculé à chaque création, modification ou suppression d'une tâche du projet.

### RG-PROJET-08 : Date de fin calculée
La **date de fin** du projet est calculée automatiquement à partir de la date de début et de la durée totale modulée :
`dateFin = dateDebut + dureeTotaleModulee (jours ouvrés)`
- Si `dateDebut` ou `dureeTotaleModulee` est nulle, `dateFin` n'est pas calculée.
- `dateFin` est un champ calculé, non modifiable manuellement. Elle est distincte de `dateButoire` (date limite fixée par le responsable) : `dateFin` est la projection réaliste tenant compte des taux d'activité.

---

## RG-TACHE — Gestion des Tâches

### RG-TACHE-01 : Rattachement obligatoire
Une tâche est **toujours** rattachée à un projet parent. Elle ne peut pas exister sans projet.

### RG-TACHE-02 : Statut initial et cycle de vie
Toute nouvelle tâche est créée avec le statut `à faire`.
```
a_faire → en_cours → termine
```
- `a_faire → en_cours` : automatique à la première saisie d'activité (durée > 0)
- `→ termine` : via demande de validation (utilisateur) OU directement par responsable/référent

### RG-TACHE-03 : Ressources associées
Une tâche peut avoir **une ou plusieurs ressources** associées. L'association est optionnelle à la création.

### RG-TACHE-09 : Durée modulée
La **durée modulée** d'une tâche est un champ calculé automatiquement, non modifiable manuellement. Elle représente le nombre de jours ouvrés réellement nécessaires pour réaliser la tâche, en tenant compte du taux d'activité de la ressource assignée.

**Formule :** `dureeModulee = arrondi(duree / (tauxActivite / 100))`

- Si la tâche a **une seule ressource** assignée : le taux d'activité de cette ressource est utilisé.
- Si la tâche a **plusieurs ressources** : la durée modulée est calculée avec le **taux d'activité le plus bas** parmi les ressources assignées (cas le plus contraignant).
- Si la tâche n'a **aucune ressource** ou que `duree` est nulle : `dureeModulee = duree` (pas de modulation).
- Si `tauxActivite = 100` : `dureeModulee = duree` (pas d'écart).

**Exemple :** une tâche de 10 jours assignée à une ressource à 80% → `10 / 0.8 = 12.5` → arrondi à **12 jours**.

### RG-TACHE-04 : Dépendances entre tâches
Une tâche peut dépendre d'une ou plusieurs autres tâches du même projet. Pas de cycle autorisé (détection BFS côté backend). La date de début d'une tâche dépendante doit être ≥ à la fin de ses prédécesseurs.

### RG-TACHE-05 : Contrainte de date
La `dateDebut` d'une tâche doit être ≥ à la `dateDebut` du projet parent. Vérifiée côté backend ET côté frontend.

### RG-TACHE-06 : Suppression
La suppression d'une tâche n'est pas définitive : la tâche et ses activités sont conservées en base de données (soft delete) et déplacées dans la **Corbeille**. Une **confirmation** est demandée à l'utilisateur.

### RG-TACHE-07 : Interdiction de suppression si activités présentes
La suppression d'une tâche est **interdite** si cette tâche contient au moins une activité de saisie. Le backend retourne `409 Conflict` avec un message explicite.

### RG-TACHE-08 : Catégories et tags
Les catégories et tags de tâches sont administrables par le `responsable`/`direction_generale`. Une tâche peut ne pas avoir de catégorie ni de tag.

---

## RG-RESSOURCE — Gestion des Ressources

### RG-RESSOURCE-01 : Unicité par email
Une ressource est identifiée par son **email**, qui doit être unique dans le système.

### RG-RESSOURCE-02 : Taux d'activité
Chaque ressource possède un champ **% d'activité** (`tauxActivite`, entier entre 0 et 100, défaut : 100). Il représente la part de son temps de travail consacrée aux projets gérés dans l'application. Ce champ est pris en compte dans le calcul de la durée modulée des tâches qui lui sont assignées.

### RG-RESSOURCE-03 : Rôle par défaut
Toute nouvelle ressource créée (manuellement ou par import) a le rôle `utilisateur` par défaut.

### RG-RESSOURCE-04 : Import depuis Entra ID
Depuis l'espace Administration, il est possible d'importer des utilisateurs directement depuis l'annuaire Entra ID. L'import crée automatiquement la `Ressource` en base avec :
- Le **nom** et le **prénom** (depuis le profil Entra)
- L'**email** (identifiant unique)
- Le **pôle** (sélectionné au moment de l'import)
- Le rôle `utilisateur` par défaut
- `authProvider = entra`

L'import ne crée pas de doublon : si un compte avec le même email existe déjà, il est mis à jour.

### RG-RESSOURCE-05 : Modification des pôles après import
- `direction_generale` : peut modifier le ou les pôles d'une ressource à tout moment.
- `responsable` : **ne peut pas** modifier les pôles d'une ressource.

### RG-RESSOURCE-06 : Modification des rôles après import
- `direction_generale` : peut modifier le rôle de n'importe quelle ressource.
- `responsable` : peut modifier le rôle des ressources appartenant à ses pôles, **dans la limite du rôle `responsable`** (ne peut pas attribuer `direction_generale`).

### RG-RESSOURCE-07 : Modification manuelle toujours possible
Après import, `direction_generale` peut toujours modifier manuellement le nom, le prénom, l'email, le pôle et le rôle d'une ressource, quelle que soit son origine (`local` ou `entra`).

---

## RG-POLE — Gestion des Pôles

### RG-POLE-01 : Définition
Un pôle est une unité organisationnelle regroupant des projets et des responsables. Un projet appartient obligatoirement à un pôle.

### RG-POLE-02 : Responsable de pôle
Un `responsable` peut être associé à un ou plusieurs pôles. Il ne voit et ne gère que les projets de ses pôles.

### RG-POLE-03 : CRUD
Les pôles sont administrables par `responsable` et `direction_generale` depuis la page Administration.

---

## RG-CORBEILLE — Corbeille

### RG-CORBEILLE-01 : Soft delete
La suppression d'un projet ou d'une tâche est un **soft delete** : l'enregistrement est conservé en base de données avec un champ `deletedAt`. Il n'apparaît plus dans les vues normales mais reste accessible depuis la Corbeille.

### RG-CORBEILLE-02 : Cascade projet → tâches
Lorsqu'un projet est supprimé, toutes ses tâches non déjà supprimées sont également soft-deletées, marquées comme `deletedWithProjetId`. Les activités ne sont pas supprimées ; elles suivent leur tâche.

### RG-CORBEILLE-03 : Périmètre de la corbeille
Un utilisateur ne voit dans sa corbeille que les éléments qu'**il a lui-même supprimés** (`deletedById = utilisateurCourant`).

### RG-CORBEILLE-04 : Restauration d'un projet
La restauration d'un projet restaure en même temps toutes les tâches supprimées en cascade avec lui (`deletedWithProjetId`). Les tâches supprimées **indépendamment** avant la suppression du projet ne sont pas restaurées.

### RG-CORBEILLE-05 : Restauration d'une tâche
Une tâche individuelle peut être restaurée si et seulement si son projet parent **n'est pas supprimé**. Dans le cas contraire, l'utilisateur doit d'abord restaurer le projet.

### RG-CORBEILLE-06 : Accès
La page Corbeille est accessible uniquement aux `responsable` et `direction_generale`. Elle est disponible via la navigation principale.

---

## RG-DEMANDE — Demandes de Validation

### RG-DEMANDE-01 : Périmètre
Un `utilisateur` assigné à une tâche peut créer une demande de validation pour :
- Terminer la tâche (passage au statut `terminé`)
- Modifier la durée de la tâche
- Modifier la date de début de la tâche

### RG-DEMANDE-02 : État en attente
Dès qu'une demande est créée, la tâche passe en `enAttenteValidation = true`.

### RG-DEMANDE-03 : Traitement par le responsable
Les `responsable` et `direction_generale` voient les demandes en attente sur leurs projets dans `/demandes`. Ils peuvent :
- **Valider** : la modification est appliquée immédiatement
- **Refuser** : avec un commentaire optionnel

### RG-DEMANDE-04 : Retour à l'état normal
Lorsqu'il n'y a plus aucune demande `en_attente` sur une tâche, `enAttenteValidation` repasse à `false`.

### RG-DEMANDE-05 : Consultation par l'auteur
L'auteur d'une demande peut consulter ses demandes dans `/mes-demandes` avec leur statut (`en_attente`, `validé`, `refusé`) et le commentaire de refus le cas échéant. Il peut archiver ses demandes traitées.

---

## RG-JOURNAL — Journal d'activité

### RG-JOURNAL-01 : Actions tracées
Les actions suivantes sont enregistrées automatiquement dans le journal :
- Changement de statut d'un **projet** (qui, quand, ancienne → nouvelle valeur)
- Changement de statut d'une **tâche** (qui, quand, ancienne → nouvelle valeur)
- Modification de la **date de début** d'un projet (via PATCH ou Gantt)
- Modification de la **date de début** d'une tâche
- **Suppression** d'un projet (le titre est conservé dans le journal)
- **Suppression** d'une tâche (le titre est conservé dans le journal)

### RG-JOURNAL-02 : Données conservées
Chaque entrée du journal conserve : l'auteur de l'action (nom, même si la ressource est supprimée ultérieurement), la date et heure exacte, l'entité concernée (type + titre + id), et les valeurs avant/après le cas échéant.

### RG-JOURNAL-03 : Accès réservé
La consultation du journal est réservée aux utilisateurs de rôle `responsable` et `direction_generale`. Le backend retourne `403 Forbidden` pour les autres rôles.

### RG-JOURNAL-04 : Consultation
Le journal est accessible depuis l'onglet **Journal** de la page Administration. Il est filtrable par type d'action et paginé.

---

## RG-ACTIVITE — Activités

### RG-ACTIVITE-01 : Rattachement obligatoire
Une activité est toujours rattachée à une **ressource** et à une **tâche**.

### RG-ACTIVITE-02 : Interdiction sur tâche terminée
Il est **interdit** d'ajouter une activité sur une tâche dont le statut est `terminé`. Le bouton `+ Activité` est masqué côté frontend. Le backend retourne `403 Forbidden` si la règle est contournée.

### RG-ACTIVITE-03 : Champs obligatoires
Description, date, et durée (heures décimales > 0) sont obligatoires.

---

## RG-AVANCEMENT — Avancement des tâches et projets

### RG-AVANCEMENT-01 : Mode de calcul par défaut
L'avancement d'une tâche et d'un projet est calculé **automatiquement** par défaut (`avancementAutoTache = true`, `avancementAutoProjet = true`). Le mode manuel doit être activé explicitement.

### RG-AVANCEMENT-02 : Calcul automatique de l'avancement d'une tâche
En mode auto, `avancementTache = min(100, round(Σ activités.duree / tache.duree × 100))`.
- Requiert que `duree` soit renseignée ; sinon l'avancement reste à 0.
- Recalculé à chaque ajout ou modification d'activité sur la tâche.

### RG-AVANCEMENT-03 : Calcul automatique de l'avancement d'un projet
En mode auto, `avancementProjet` est la **moyenne pondérée par la durée** des tâches :
`avancementProjet = round(Σ(avancementTache × duree) / Σduree)`
- Seules les tâches avec `duree > 0` participent au calcul.
- Recalculé à chaque modification d'une tâche du projet.

### RG-AVANCEMENT-04 : Mode manuel
Un `responsable` ou `direction_generale` peut désactiver le mode auto sur une tâche ou un projet et saisir un % d'avancement manuellement (0-100). La valeur manuelle n'est jamais écrasée par le calcul auto tant que le mode reste désactivé.

### RG-AVANCEMENT-05 : Indicateur de dépassement
Une tâche est **en dépassement** lorsque `Σ activités.duree > tache.duree`. Le dépassement est signalé visuellement (barre rouge, icône ⚠, texte avec écart en jours). Il n'est pas bloquant.

---

## RG-CHARGE — Vue Charge

### RG-CHARGE-01 : Définition
La vue Charge présente une matrice ressource × semaine indiquant la charge prévisionnelle en jours ouvrés.

### RG-CHARGE-02 : Alimentation
La charge d'une ressource sur une semaine est calculée à partir des tâches qui lui sont assignées ayant `dateDebut` et `duree` renseignées, en répartissant les jours ouvrés sur les semaines couvertes.

### RG-CHARGE-03 : Format de l'axe temps
L'axe X utilise le lundi de chaque semaine comme clé (`YYYY-MM-DD`).

---

## RG-NOTIFICATION — Notifications in-app

### RG-NOTIFICATION-01 : Périmètre
L'application dispose d'un système de notifications in-app léger (AppNotification). Endpoint : `GET /notifications` → `{ count, items }`.

### RG-NOTIFICATION-02 : Structure
Une notification a : `id`, `type`, `titre`, `projetTitre` (optionnel).

---

## RG-RECHERCHE — Recherche globale

### RG-RECHERCHE-01 : Périmètre
Endpoint `GET /search?q=...` retourne `{ projets: [...], taches: [...] }`.
- `projets` : id, titre, pôle
- `taches` : id, titre, projetTitre

### RG-RECHERCHE-02 : Accès
Disponible via une barre de recherche dans la navigation, pour tous les rôles.

---

## RG-VALID — Validation des Données

### RG-VALID-01 : Validation côté frontend
Tous les formulaires utilisent **Zod** pour valider les données avant envoi.

### RG-VALID-02 : Validation côté backend
Le backend **revalide** toutes les données reçues via Zod, indépendamment du frontend.

### RG-VALID-03 : Messages d'erreur utilisateur
Les erreurs de validation sont affichées clairement, au niveau du champ concerné.

---

## RG-SEC — Sécurité

### RG-SEC-01 : Authentification de toutes les routes API
Toutes les routes API (hors `/login`) exigent un token JWT valide. Un token absent ou invalide retourne `401 Unauthorized`.

### RG-SEC-02 : Contrôle des permissions côté serveur
Le backend vérifie le rôle de l'utilisateur pour chaque action d'écriture. Un rôle insuffisant retourne `403 Forbidden`.

### RG-SEC-03 : Données sensibles
Les mots de passe ne sont **jamais** renvoyés dans les réponses API. Ils sont stockés hashés (bcrypt). Aucun secret n'est codé en dur dans le code source.

### RG-SEC-04 : Rate limiting
La route `/login` est soumise à un rate limiting (10 tentatives / 15 min par IP).
