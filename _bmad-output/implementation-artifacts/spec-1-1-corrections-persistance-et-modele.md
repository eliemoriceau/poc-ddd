---
title: 'Story 1.1 — Corrections de persistance et de modèle'
type: 'refactor'
created: '2026-08-27'
status: 'done'
baseline_commit: 'c19c347fd53c1a0b65065ffeb5504893df320681'
review_loop_iteration: 0
context:
  - '/Users/elie/Dev/poc-event-ddd/_bmad-output/implementation-artifacts/spec-1-1-creer-une-commande-selon-son-service.md'
  - '/Users/elie/Dev/poc-event-ddd/docs/architecture/application.md'
  - '/Users/elie/Dev/poc-event-ddd/CONTEXT.md'
---

<frozen-after-approval reason="human-owned correction intent — do not modify unless human renegotiates">

## Intent

**Problem:** La première implémentation de la Story 1.1 couvre le cas nominal mais laisse des écarts de robustesse : la persistance réelle n'est pas testée, le contrat du repository expose un `Result` sans erreur possible, et le mapping des statuts ainsi que leur cohérence avec PostgreSQL sont implicites.

**Approach:** Renforcer la preuve d'intégration PostgreSQL, simplifier les contrats qui ne portent aucun refus métier, rendre explicites les conversions de statut et clarifier le nom du Value Object de service. Préserver strictement les invariants et le périmètre de la Story 1.1 existante.

## Boundaries & Constraints

**Always:** La création reste transactionnelle et retourne un `Result` uniquement à la frontière de l'Action pour les refus métier attendus. Le repository retourne directement un `Order` après une écriture réussie. Les statuts acceptés par le domaine et la contrainte SQL restent exactement synchronisés. Le parsing d'une valeur persistée invalide lève une erreur d'infrastructure/état impossible. Les tests d'intégration utilisent PostgreSQL et couvrent création, rechargement et contraintes.

**Ask First:** Toute modification du contrat public de l'Action, des invariants service/table, de la migration déjà appliquée ou de l'architecture `src`/`app`.

**Never:** Ne pas modifier le bloc frozen-after-approval de la spécification originale. Ne pas ajouter de route, UI, lignes de commande, transitions métier ou vérification d'existence de table. Ne pas éditer manuellement les types Kysely générés.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| PERSISTED_ORDER | PostgreSQL migré, création DineIn ou Takeaway | L'Action crée puis le repository recharge un agrégat équivalent | N/A |
| SQL_SERVICE_TABLE_CONSTRAINT | Insertion directe d'une relation service/table invalide | PostgreSQL refuse l'écriture | Erreur SQL attendue |
| SQL_STATUS_CONSTRAINT | Insertion directe d'un statut inconnu | PostgreSQL refuse l'écriture | Erreur SQL attendue |
| INVALID_PERSISTED_STATUS | Ligne rechargée avec statut non reconnu (si simulable) | Le mapping refuse l'état impossible | Exception explicite |

</frozen-after-approval>

## Code Map

- `apps/web/src/commande/repositories/order_repository.ts` -- contrat `createOrder`, mapping Kysely et rehydratation; supprimer `Result<Order, never>` et déléguer le parsing à une fonction nommée.
- `apps/web/src/commande/domain/order_status.ts` -- source TypeScript des statuts; exposer un parseur de persistance explicite et testable.
- `apps/web/src/commande/domain/order.ts` -- création initiale; remplacer tout littéral d'état par `OrderStatus.Draft`.
- `apps/web/src/commande/domain/service_type.ts` -- Value Object actuel; évaluer et appliquer le renommage en `OrderService` avec mise à jour des imports et types.
- `apps/web/database/migrations/1761955200000_create_orders_table.ts` -- contrainte SQL des services et statuts; conserver les invariants et rendre leur liste vérifiable par test.
- `apps/web/tests/unit/commande/create_order.spec.ts` -- tests de l'Action; adapter le double de repository au nouveau retour direct et remplacer les littéraux de statut.
- `apps/web/tests/integration/commande/order_persistence.spec.ts` -- nouveau test PostgreSQL; migrer la base de test, créer/recharger une commande et vérifier les contraintes.
- `apps/web/src/shared/services/db.ts`, `apps/web/src/shared/file_migration_provider.ts`, `apps/web/commands/migrate.ts` -- conventions existantes pour la connexion et les migrations Kysely à réutiliser, sans déplacer leur responsabilité.
- `apps/web/types/db.ts` -- types générés à régénérer avec `yarn workspace @boilerplate/web db:codegen` après toute évolution du schéma.

## Tasks & Acceptance

**Execution:**

- [x] `apps/web/src/commande/domain/order_status.ts` -- ajouter une fonction explicite de parsing des statuts persistés et ses tests -- rendre les états invalides détectables sans réflexion opaque.
- [x] `apps/web/src/commande/repositories/order_repository.ts` -- retourner directement `Order`, utiliser le parseur de statut et mapper `OrderService` -- aligner le contrat sur les erreurs réellement possibles.
- [x] `apps/web/src/commande/domain/service_type.ts`, `apps/web/src/commande/domain/order.ts` et imports associés -- renommer le Value Object en `OrderService` et utiliser `OrderStatus.Draft` -- clarifier le langage métier sans changer le comportement.
- [x] `apps/web/database/migrations/1761955200000_create_orders_table.ts` et `apps/web/tests/integration/commande/order_persistence.spec.ts` -- tester la migration, la création, le rechargement et les contraintes service/table/statut -- prouver le comportement réel de PostgreSQL.
- [x] `apps/web/tests/unit/commande/create_order.spec.ts` -- adapter les doubles et compléter la cohérence des statuts -- préserver la couverture de l'Action.
- [x] `apps/web/tests/unit/commande/order_status.spec.ts` -- tester tous les statuts reconnus et les valeurs rejetées -- verrouiller le parseur.

**Acceptance Criteria:**

- Given une base PostgreSQL vierge, when les migrations puis `CreateOrder` s'exécutent, then une commande DineIn et une commande Takeaway peuvent être créées et rechargées avec identité, service, table et statut conservés.
- Given une insertion PostgreSQL avec service/table incompatible ou statut inconnu, when elle est exécutée, then la contrainte SQL la refuse.
- Given une valeur de statut persistée, when le repository la mappe, then une fonction explicite retourne le statut typé reconnu ou signale l'état invalide.
- Given le repository après correction, when une création réussit, then son contrat retourne directement `Order` et seule l'Action expose `Result` pour les refus métier.
- Given les statuts exportés par TypeScript et ceux autorisés par SQL, when le test de cohérence s'exécute, then les ensembles sont identiques.
- Given la suite complète, when lint, format, typecheck et tests s'exécutent, then toutes les vérifications passent.

## Verification

**Commands:**

- `yarn docker:up` -- attendu : PostgreSQL est disponible sur la configuration du projet.
- `yarn workspace @boilerplate/web test --files=tests/unit/commande tests/integration/commande/order_persistence.spec.ts` -- attendu : tests unitaires et intégration verts.
- `yarn lint` -- attendu : aucune erreur Oxlint.
- `yarn format` -- attendu : tous les fichiers suivis sont conformes à Oxfmt.
- `yarn typecheck` -- attendu : tous les workspaces compilent.
- `yarn test` -- attendu : la suite complète passe.

## Design Notes

`OrderStatus.fromPersistence` est la frontière de confiance entre le texte PostgreSQL et le type métier. Le test de cohérence doit comparer l'ensemble exporté par cette source TypeScript avec les valeurs de la contrainte SQL, en évitant de dupliquer silencieusement une seconde liste dans le code de production. Le test d'intégration peut isoler les données par transaction ou nettoyage explicite afin de rester répétable dans la base de test.

## Suggested Review Order

**Contrat de commande et mapping**

- Le repository retourne désormais l'agrégat directement et protège le mapping des états persistés.
  [`order_repository.ts:17`](../../apps/web/src/commande/repositories/order_repository.ts#L17)

- Le parsing explicite borne la conversion de PostgreSQL vers le type de statut métier.
  [`order_status.ts:9`](../../apps/web/src/commande/domain/order_status.ts#L9)

- Le Value Object porte explicitement le service et sa relation avec une table.
  [`order_service.ts:35`](../../apps/web/src/commande/domain/order_service.ts#L35)

**Action et schéma PostgreSQL**

- L'Action conserve `Result` à la frontière métier après le contrat direct du repository.
  [`create_order.ts:32`](../../apps/web/src/commande/actions/create_order.ts#L32)

- La migration conserve les invariants SQL et utilise les types générés de la base.
  [`1761955200000_create_orders_table.ts:4`](../../apps/web/database/migrations/1761955200000_create_orders_table.ts#L4)

**Preuves de vérification**

- Les tests d'intégration couvrent migration, création, rechargement, contraintes et cohérence SQL/TypeScript.
  [`order_persistence.spec.ts:13`](../../apps/web/tests/integration/commande/order_persistence.spec.ts#L13)

- Les tests unitaires verrouillent les statuts reconnus et les valeurs persistées inconnues.
  [`order_status.spec.ts:4`](../../apps/web/tests/unit/commande/order_status.spec.ts#L4)

- La suite d'intégration est enregistrée comme suite Adonis dédiée.
  [`adonisrc.ts:88`](../../apps/web/adonisrc.ts#L88)
