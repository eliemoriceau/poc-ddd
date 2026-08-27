# Epic 1 Context: Gérer le cycle complet d’une commande

<!-- Compilé depuis les artefacts de planification. Modifier librement. Régénérer avec compile-epic-context si les documents changent. -->

## Goal

Permettre à une personne prenant une commande de gérer le cycle initial d’une commande, depuis sa création pour un service donné jusqu’à sa confirmation, son envoi en cuisine ou son annulation. Le contexte Commande protège ces règles dans un agrégat unique et expose chaque intention par une Action testable, afin d’éviter les mutations incohérentes et le couplage au transport HTTP.

## Stories

- Story 1.1: Créer une commande selon son service
- Story 1.2: Ajouter et fusionner les lignes d’une commande
- Story 1.3: Confirmer une commande non vide
- Story 1.4: Annuler une commande selon son état
- Story 1.5: Envoyer une commande confirmée en cuisine
- Story 1.6: Exposer le parcours de commande via Adonis

## Requirements & Constraints

Une commande nouvellement créée possède un identifiant, commence dans l’état `Draft` et utilise exactement un service : `DineIn` avec une table, ou `Takeaway` sans table. Une quantité doit être strictement positive et un prix doit être nul ou positif ; les lignes identifient un article par `menuItemId` et capturent son nom et son prix au premier ajout. Une commande vide ne peut pas être confirmée ni envoyée en cuisine. Les transitions autorisées sont `Draft → Confirmed`, `Confirmed → SentToKitchen` et `Draft/Confirmed → Cancelled`.

Les refus attendus sont des résultats métier discriminés, indépendants de HTTP, d’Inertia et des textes traduits. Les échecs d’intégration Cuisine doivent rester distincts des refus métier. Les écritures atomiques et les contraintes de données sont garanties par Postgres ; les lignes sont uniques par `(order_id, menu_item_id)`. Paiement, stock, disponibilité complète du menu, suivi détaillé en cuisine, autorisation opérateur, modification après confirmation et outbox sont hors périmètre.

## Technical Decisions

Le monolithe est organisé par capacité : `apps/web/src/commande` contient le domaine, les Actions, repositories et intégrations ; `apps/web/app/commande` contient les adaptateurs Adonis/Inertia. Le code `src` ne dépend jamais de `app` ou d’Inertia. `Order` est l’agrégat qui possède ses lignes, son service et ses transitions ; les Actions demandent ses décisions et possèdent leurs transactions. Les repositories Kysely sont responsables du mapping agrégat/base de données.

Les identifiants sont typés, le prix métier est un Value Object stocké en entier de centimes et aucun calcul monétaire ne se fait en flottant. Les contrôleurs ont au plus `render` et `execute`, valident avec VineJS et mappent les résultats. Les Queries et projections ne sont ajoutées que lorsqu’un écran de lecture concret le justifie. Cuisine est derrière un contrat synchrone local recevant un DTO distinct sans `unitPrice`, borné par timeout et utilisant `orderId` comme clé d’idempotence.

## Cross-Story Dependencies

La story 1.1 fournit l’agrégat, le type de service, l’état initial et la persistance nécessaires à la story 1.2. Les stories 1.3 et 1.4 dépendent ensuite des transitions et du repository introduits par la création. La story 1.5 dépend de `Confirmed` et de la structure des lignes ; la story 1.6 adapte les Actions exposées par les stories métier sans déplacer leurs règles dans Adonis.
