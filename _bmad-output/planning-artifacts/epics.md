---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
inputDocuments:
  - _bmad-output/specs/spec-commande/SPEC.md
  - _bmad-output/specs/spec-commande/state-machines.md
  - _bmad-output/planning-artifacts/architecture/architecture-commande-2026-08-26/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/architecture/architecture-commande-2026-08-26/architecture-commande-2026-08-26-explainer.md
  - CONTEXT.md
  - docs/architecture/application.md
  - docs/research/adonis-transformers-inertia-generated-types.md
  - docs/adr/0001-monorepo-with-adonis-bff-and-modular-core.md
  - docs/adr/0002-use-postgres-through-kysely.md
  - docs/adr/0003-use-command-models-and-read-model-projections.md
  - docs/adr/0004-use-result-for-expected-business-outcomes.md
---

# poc-event-ddd - Epic Breakdown

## Overview

Ce document décompose le périmètre initial du contexte `Commande` en exigences, puis en epics et stories implémentables. `SPEC-commande` est la source fonctionnelle canonique ; l’architecture et les documents techniques précisent les frontières d’implémentation.

## Requirements Inventory

### Functional Requirements

FR1: Un utilisateur peut créer une commande `DineIn` avec une table ou `Takeaway` sans table ; la commande créée est `Draft` et possède un identifiant.

FR2: Un utilisateur peut ajouter une ligne à une commande `Draft` avec un `menuItemId`, un nom, une quantité strictement positive et un prix supérieur ou égal à zéro.

FR3: Lorsqu’un article ayant le même `menuItemId` est ajouté plusieurs fois, sa ligne existante est fusionnée en augmentant sa quantité ; aucune ligne dupliquée n’est créée.

FR4: La ligne capture le nom et le prix au premier ajout ; les changements ultérieurs du menu ne modifient pas la ligne existante.

FR5: Un utilisateur peut confirmer une commande `Draft` non vide ; elle passe à `Confirmed` et ne peut plus être modifiée dans le flux initial.

FR6: Un utilisateur peut envoyer en cuisine une commande `Confirmed` non vide via une action distincte de la confirmation.

FR7: Un nouvel envoi d’une commande déjà `SentToKitchen` réussit sans mutation ni nouvel effet métier.

FR8: Un utilisateur peut annuler une commande `Draft` ou `Confirmed` ; une commande `SentToKitchen` ou `Cancelled` ne peut pas progresser dans le cycle normal.

FR9: L’envoi en cuisine transmet `orderId`, `menuItemId`, `name` et `quantity`, sans transmettre le prix.

FR10: Un échec du contrat Cuisine laisse la commande `Confirmed` afin de permettre un nouvel essai ; les envois concurrents d’une même commande sont sérialisés et utilisent `orderId` comme clé d’idempotence.

### NonFunctional Requirements

NFR1: Les invariants de commande sont protégés par l’agrégat `Order`, qui est l’unique propriétaire de ses lignes, de son type de service et de ses transitions.

NFR2: Chaque intention métier est exposée par une Action dédiée avec paramètres explicites et `Result` discriminé ; les refus attendus restent indépendants d’HTTP, d’Inertia et des textes traduits.

NFR3: La persistance utilise Postgres via Kysely ; le mapping agrégat/base de données reste dans les repositories et les contraintes de données sont renforcées par la base.

NFR4: Le prix est représenté dans le domaine par un Value Object et persisté comme entier en centimes, sans calcul monétaire en flottants.

NFR5: Les écritures atomiques sont détenues par les Actions ; l’ajout de ligne protège l’unicité `(order_id, menu_item_id)` et les mises à jour concurrentes.

NFR6: La dépendance respecte la séparation `app`/`src` : `app/commande` adapte HTTP/Inertia et `src/commande` ne dépend ni de `app` ni d’Inertia.

NFR7: Les contrôleurs Adonis ont au plus `render` et `execute`, valident l’entrée avec VineJS, invoquent les Actions et mappent tous les résultats attendus.

NFR8: Si une réponse Inertia expose une ressource, elle passe par un transformer explicite et les pages consomment les types générés `Data.*` ; les artefacts `.adonisjs` restent générés, jamais édités manuellement.

NFR9: Le contrat synchrone Cuisine est borné par un timeout ; les refus métier, les échecs d’intégration et les pannes inattendues restent distinguables.

NFR10: Les tests couvrent les transitions valides et invalides, les invariants de lignes et de prix, l’idempotence Cuisine, l’absence de prix dans son DTO et le mapping de livraison des résultats.

### Additional Requirements

- Organiser la capacité par métier sous `apps/web/src/commande` et `apps/web/app/commande`, avec seulement les dossiers nécessaires.
- Implémenter les Actions `CreateOrder`, `AddOrderLine`, `ConfirmOrder`, `SendOrderToKitchen` et `CancelOrder`.
- Modéliser `Order`, `OrderLine`, les états de commande, le type de service et le prix comme objets du domaine appropriés.
- Persister `orders` et `order_lines` via un repository Kysely ; prévoir les contraintes de service/table et l’unicité `(order_id, menu_item_id)` dans la migration.
- Garder `Cuisine` derrière un contrat local synchrone isolé dans `src/commande/integrations`, sans imposer une outbox ou un bus dans le périmètre initial.
- Utiliser un DTO d’intégration Cuisine distinct du modèle de commande et exclure `unitPrice` de ce DTO.
- Les contrôleurs et routes appartiennent à `app/commande`; les Queries et projections ne sont introduites que si un écran de lecture concret le justifie.
- Les erreurs métier ne contiennent ni statut HTTP, ni nom de champ de formulaire, ni redirection ; l’adaptateur de livraison assure ce mapping.
- Respecter les conventions du monorepo Yarn, Oxlint/Oxfmt et les dépendances de livraison `app` vers `src`.
- Régénérer les types et registries Adonis par le cycle prévu ; ne pas modifier `apps/web/.adonisjs/` à la main.
- Hors périmètre : paiement, stock, disponibilité complète du menu, suivi détaillé en cuisine, modification après confirmation, autorisation opérateur et garantie de livraison durable/outbox.

### UX Design Requirements

Aucun contrat UX dédié n’a été trouvé. Les écrans Inertia et leurs besoins de lecture seront définis lorsqu’un besoin UI concret sera ajouté.

### FR Coverage Map

FR1: Epic 1 — création d’une commande `DineIn` ou `Takeaway` avec un état initial `Draft`.
FR2: Epic 1 — ajout d’une ligne avec quantité positive et prix valide.
FR3: Epic 1 — fusion des lignes selon `menuItemId`.
FR4: Epic 1 — capture du nom et du prix au premier ajout.
FR5: Epic 1 — confirmation d’une commande non vide.
FR6: Epic 1 — envoi d’une commande confirmée en cuisine.
FR7: Epic 1 — idempotence d’un nouvel envoi.
FR8: Epic 1 — annulation selon l’état courant.
FR9: Epic 1 — contrat Cuisine sans prix.
FR10: Epic 1 — timeout, sérialisation, clé d’idempotence et conservation de `Confirmed` en cas d’échec.

## Epic List

### Epic 1: Gérer le cycle complet d’une commande

L’utilisateur peut créer une commande `DineIn` ou `Takeaway`, ajouter et fusionner ses articles, conserver les prix capturés, confirmer ou annuler la commande, puis envoyer une commande confirmée en cuisine sans doublon ni transmission de prix.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10

Cet epic est livré verticalement : chaque story doit produire une capacité vérifiable de bout en bout, tout en respectant l’agrégat `Order`, les Actions dédiées, les repositories Kysely, les résultats `Result` et les adaptateurs de livraison. Les règles d’idempotence et d’échec Cuisine restent dans des stories explicites. Le passage à `SentToKitchen` intervient après le succès du contrat Cuisine ; un échec conserve `Confirmed`.

### Story 1.1: Créer une commande selon son service

As a personne prenant une commande,
I want créer une commande `DineIn` ou `Takeaway`,
So that disposer d’une commande `Draft` prête à recevoir des articles.

**FRs covered:** FR1

**Acceptance Criteria:**

**Given** le service `DineIn` avec un `tableId` fourni et non nul
**When** l’Action `CreateOrder` est exécutée
**Then** une commande est créée avec un identifiant unique, le service `DineIn`, le `tableId` indiqué et l’état `Draft`.

**Given** le service `Takeaway` sans `tableId`
**When** l’Action `CreateOrder` est exécutée
**Then** une commande est créée avec un identifiant unique, le service `Takeaway`, aucune table et l’état `Draft`.

**Given** le service `DineIn` sans `tableId`
**When** l’Action `CreateOrder` est exécutée
**Then** la création est refusée avec un résultat métier typé.

**Given** le service `Takeaway` avec un `tableId`
**When** l’Action `CreateOrder` est exécutée
**Then** la création est refusée avec un résultat métier typé.

**Given** un type de service inconnu ou un identifiant de table de forme invalide
**When** l’Action `CreateOrder` est exécutée
**Then** la création est refusée avec un résultat métier typé.

**Given** une demande de création valide
**When** l’Action termine son exécution
**Then** l’agrégat est persisté via le repository Kysely dans une transaction.

**Given** une erreur de persistance
**When** l’Action termine son exécution
**Then** aucun succès n’est retourné et aucune commande partiellement créée ne reste persistée.

**Given** une commande nouvellement créée
**When** elle est rechargée depuis le repository
**Then** son identifiant, son type de service, son `tableId` et son état `Draft` sont conservés.

La disponibilité ou l’existence métier de la table n’est pas vérifiée par cette story. Cette règle appartient à un contexte ou une capacité `Table` ultérieure.

### Story 1.2: Ajouter et fusionner les lignes d’une commande

As a personne prenant une commande,
I want ajouter des articles à une commande `Draft`,
So that la commande reflète les articles et quantités demandés.

**FRs covered:** FR2, FR3, FR4

**Acceptance Criteria:**

**Given** une commande dans l’état `Draft`
**When** un article est ajouté avec un `menuItemId`, un nom obligatoire, une quantité entière strictement positive et un prix entier en centimes supérieur ou égal à zéro
**Then** une ligne contenant ces valeurs est ajoutée à la commande.

**Given** une commande `Draft` contenant déjà une ligne pour un `menuItemId`
**When** le même article est ajouté avec une quantité valide
**Then** la quantité de la ligne existante augmente et aucune nouvelle ligne n’est créée.

**Given** une ligne existante pour un `menuItemId`
**When** le même article est ajouté avec un nom ou un prix différent
**Then** le nom et le prix capturés au premier ajout sont conservés.

**Given** une commande `Draft`
**When** un article avec un autre `menuItemId` est ajouté
**Then** une nouvelle ligne indépendante est créée.

**Given** un nom absent, une quantité nulle ou négative, ou un prix négatif
**When** l’Action `AddOrderLine` est exécutée
**Then** l’ajout est refusé avec un résultat métier typé et la commande reste inchangée.

**Given** une entrée dont la forme runtime est invalide, par exemple un prix qui n’est pas un entier en centimes
**When** la demande arrive depuis un adaptateur
**Then** elle est rejetée par la validation de l’adaptateur avant l’exécution de l’Action.

**Given** une commande qui n’est pas dans l’état `Draft`
**When** l’Action `AddOrderLine` est exécutée
**Then** l’ajout est refusé avec un résultat métier typé.

**Given** deux ajouts simultanés du même `menuItemId`
**When** les Actions sont exécutées en concurrence
**Then** une seule ligne existe en base et sa quantité finale correspond à la somme des deux ajouts acceptés.

**Given** un ajout valide
**When** l’Action termine son exécution
**Then** la commande et ses lignes sont persistées atomiquement via le repository Kysely, avec une contrainte d’unicité `(order_id, menu_item_id)`.

**Given** une erreur de persistance
**When** l’Action termine son exécution
**Then** ni nouvelle ligne ni nouvelle quantité fusionnée ne sont persistées.

Aucune règle de longueur ou de contenu du nom, aucune quantité maximale et aucune vérification du Menu ou de la disponibilité de l’article ne sont introduites dans cette story.

### Story 1.3: Confirmer une commande non vide

As a personne prenant une commande,
I want confirmer une commande `Draft` contenant au moins une ligne,
So that indiquer qu’elle est prête à être envoyée en cuisine.

**FRs covered:** FR5

**Acceptance Criteria:**

**Given** une commande `Draft` contenant au moins une ligne
**When** l’Action `ConfirmOrder` est exécutée
**Then** la commande passe à l’état `Confirmed`.

**Given** une commande `Draft` sans ligne
**When** l’Action `ConfirmOrder` est exécutée
**Then** la confirmation est refusée avec un résultat métier typé et la commande reste `Draft`.

**Given** une commande `Confirmed`
**When** l’Action `ConfirmOrder` est exécutée
**Then** la confirmation est refusée avec un résultat métier typé et aucune donnée n’est modifiée.

**Given** une commande `SentToKitchen`
**When** l’Action `ConfirmOrder` est exécutée
**Then** la confirmation est refusée avec un résultat métier typé et l’état reste inchangé.

**Given** une commande `Cancelled`
**When** l’Action `ConfirmOrder` est exécutée
**Then** la confirmation est refusée avec un résultat métier typé et l’état reste inchangé.

**Given** une demande de confirmation valide
**When** l’Action termine son exécution
**Then** la transition `Draft → Confirmed` est persistée atomiquement via le repository Kysely.

**Given** une erreur de persistance
**When** l’Action termine son exécution
**Then** la commande reste `Draft` et aucun changement partiel n’est persisté.

**Given** une commande confirmée
**When** elle est rechargée depuis le repository
**Then** son état est `Confirmed`, ses lignes restent inchangées et son type de service ainsi que son éventuelle table sont conservés.

La confirmation vérifie uniquement la présence d’au moins une ligne. Elle ne déclenche pas l’envoi en cuisine et ne revalide pas le Menu.

### Story 1.4: Annuler une commande selon son état

As a personne prenant une commande,
I want annuler une commande `Draft` ou `Confirmed`,
So that empêcher sa progression dans le cycle normal.

**FRs covered:** FR8

**Acceptance Criteria:**

**Given** une commande `Draft`, vide ou non vide
**When** l’Action `CancelOrder` est exécutée
**Then** la commande passe à l’état `Cancelled`.

**Given** une commande `Confirmed`
**When** l’Action `CancelOrder` est exécutée
**Then** la commande passe à l’état `Cancelled`.

**Given** une commande `SentToKitchen`
**When** l’Action `CancelOrder` est exécutée
**Then** l’annulation est refusée avec un résultat métier typé et l’état reste `SentToKitchen`.

**Given** une commande `Cancelled`
**When** l’Action `CancelOrder` est exécutée
**Then** l’annulation est refusée avec un résultat métier typé et aucune donnée n’est modifiée.

**Given** une commande `Draft` ou `Confirmed`
**When** `CancelOrder` est exécutée
**Then** aucun appel au contrat Cuisine n’est effectué.

**Given** une annulation valide
**When** l’Action termine son exécution
**Then** la transition est persistée atomiquement via le repository Kysely.

**Given** une erreur de persistance
**When** l’Action termine son exécution
**Then** la commande conserve son état initial et aucun changement partiel n’est persisté.

**Given** une commande annulée rechargée depuis le repository
**When** son état est consulté
**Then** elle est `Cancelled`, ses lignes, son type de service et son éventuelle table sont inchangés.

**Given** une commande `Cancelled`
**When** une opération de progression du cycle normal est demandée
**Then** l’opération est refusée par le modèle métier.

L’annulation ne supprime pas la commande ni ses lignes. Elle ne déclenche ni événement externe, ni remboursement, ni libération de table dans le périmètre initial.

### Story 1.5: Envoyer une commande confirmée en cuisine

As a personne prenant une commande,
I want envoyer une commande confirmée en cuisine,
So that sa préparation puisse commencer sans doublon ni exposition du prix.

**FRs covered:** FR6, FR7, FR9, FR10

**Acceptance Criteria:**

**Given** une commande `Confirmed` contenant au moins une ligne
**When** l’Action `SendOrderToKitchen` est exécutée
**Then** le contrat local Cuisine est appelé avec `orderId`, `menuItemId`, `name` et `quantity` pour chaque ligne.

**Given** une commande `Confirmed` contenant au moins une ligne
**When** le contrat Cuisine répond avec succès
**Then** la commande passe à l’état `SentToKitchen` dans une écriture locale atomique.

**Given** une commande `Confirmed`
**When** le DTO Cuisine est construit
**Then** sa structure ne contient aucun prix, ni unitaire ni total.

**Given** une commande `Confirmed` sans ligne
**When** l’Action `SendOrderToKitchen` est exécutée
**Then** l’envoi est refusé avec un résultat métier typé et aucun appel Cuisine n’est effectué.

**Given** une commande `Draft` ou `Cancelled`
**When** l’Action `SendOrderToKitchen` est exécutée
**Then** l’envoi est refusé avec un résultat métier typé et aucun appel Cuisine n’est effectué.

**Given** une commande `SentToKitchen`
**When** l’Action `SendOrderToKitchen` est exécutée à nouveau
**Then** l’action réussit sans modifier l’état et sans produire de nouvel effet métier Cuisine.

**Given** un contrat Cuisine qui échoue ou dépasse son délai configuré
**When** l’Action `SendOrderToKitchen` est exécutée
**Then** elle retourne un résultat d’intégration distinct d’un refus métier et la commande reste `Confirmed`.

**Given** deux demandes d’envoi concurrentes pour la même commande
**When** elles sont exécutées simultanément
**Then** leur résultat observable garantit qu’un seul effet métier Cuisine est produit et que la commande atteint au plus une fois l’état `SentToKitchen`.

**Given** Cuisine a accepté la commande mais qu’une erreur survient avant la persistance locale
**When** la même commande est envoyée à nouveau avec le même `orderId`
**Then** Cuisine reconnaît la clé d’idempotence sans produire de doublon et la commande peut atteindre `SentToKitchen`.

**Given** le contrat Cuisine répond avec succès
**When** l’écriture locale échoue
**Then** la commande reste `Confirmed` et l’échec peut être repris avec le même `orderId`.

L’outbox, les retries distribués et le suivi détaillé de préparation restent hors périmètre. Le contrat Cuisine est local, synchrone et borné par un timeout dont la valeur n’est pas définie dans cette story.

### Story 1.6: Exposer le parcours de commande via Adonis

As a personne prenant une commande,
I want utiliser les actions de commande depuis l’application,
So that créer, composer, confirmer, annuler et envoyer une commande via des points d’entrée dédiés.

**FRs covered:** FR1, FR2, FR5, FR6, FR8

**Acceptance Criteria:**

**Given** une requête de création correctement formée
**When** le point d’entrée dédié est appelé
**Then** un schéma VineJS dédié valide l’entrée, `CreateOrder` est invoquée et la réponse expose le résultat de création avec l’identifiant ainsi que l’état `Draft`.

**Given** une requête d’ajout correctement formée
**When** le point d’entrée dédié est appelé
**Then** un schéma VineJS dédié valide l’entrée, `AddOrderLine` est invoquée et le contrôleur ne recalcule ni quantité, ni prix, ni fusion.

**Given** une requête de confirmation correctement formée
**When** le point d’entrée dédié est appelé
**Then** un schéma VineJS dédié valide l’entrée et `ConfirmOrder` est invoquée.

**Given** une requête d’annulation correctement formée
**When** le point d’entrée dédié est appelé
**Then** un schéma VineJS dédié valide l’entrée et `CancelOrder` est invoquée.

**Given** une requête d’envoi en cuisine correctement formée
**When** le point d’entrée dédié est appelé
**Then** un schéma VineJS dédié valide l’entrée et `SendOrderToKitchen` est invoquée.

**Given** une entrée HTTP invalide
**When** le contrôleur reçoit la requête
**Then** le schéma VineJS de l’intention concernée la rejette avant l’exécution de l’Action.

**Given** une Action retourne un refus métier attendu
**When** le contrôleur traite le résultat
**Then** il mappe explicitement la variante vers une réponse de livraison adaptée, sans ajouter de dépendance HTTP au résultat métier.

**Given** `SendOrderToKitchen` retourne un échec d’intégration
**When** le contrôleur traite le résultat
**Then** il le distingue d’un refus métier et ne retourne pas un succès d’envoi.

**Given** une requête valide
**When** le contrôleur termine son exécution
**Then** il ne contient ni calcul métier, ni transition d’état, ni écriture directe en base.

**Given** les routes, URLs, verbes HTTP ou statuts sont définis
**When** la story est implémentée
**Then** ces contrats sont documentés avec les points d’entrée correspondants.

**Given** une page Inertia expose une ressource de commande
**When** la réponse est construite
**Then** elle utilise un transformer explicite et la page consomme le type généré `Data.*`.

Cette story ne rend pas obligatoire une page Inertia. Elle n’inclut pas de design d’écran, de Query de lecture ni de modification manuelle des artefacts Adonis générés. Chaque Action possède son propre contrôleur `execute`, sauf justification explicite d’un regroupement.
