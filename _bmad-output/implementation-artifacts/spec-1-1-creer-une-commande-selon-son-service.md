---
title: 'Story 1.1 — Créer une commande selon son service'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 0
baseline_commit: '8d85ce418df920347bac45365e7757e598092482'
context:
  - '/Users/elie/Dev/poc-event-ddd/_bmad-output/specs/spec-commande/SPEC.md'
  - '/Users/elie/Dev/poc-event-ddd/_bmad-output/planning-artifacts/architecture/architecture-commande-2026-08-26/ARCHITECTURE-SPINE.md'
  - '/Users/elie/Dev/poc-event-ddd/docs/architecture/application.md'
  - '/Users/elie/Dev/poc-event-ddd/CONTEXT.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le contexte Commande ne possède pas encore le cas d’usage permettant de démarrer une prise de commande. Sans cette capacité, aucune commande `Draft` valide ne peut être le point de départ des stories suivantes.

**Approach:** Ajouter l’agrégat `Order` et ses Value Objects minimaux pour modéliser le service, puis exposer `CreateOrder` comme Action transactionnelle. Persister la commande via un repository Kysely et retourner un `Result` discriminé pour les refus attendus.

## Boundaries & Constraints

**Always:** `DineIn` exige un `tableId` non nul ; `Takeaway` exige un `tableId` nul. Le service et l’identifiant de table doivent être validés par le domaine, l’identifiant de commande est unique, l’état initial est `Draft`, et l’écriture passe par une transaction. Le repository possède le mapping Kysely/base de données. Les erreurs métier restent indépendantes du transport.

**Ask First:** aucune décision ouverte n’est requise pour cette story. Si l’implémentation révèle une contradiction avec le schéma Postgres ou l’architecture canonique, arrêter et demander une décision.

**Never:** ne pas vérifier l’existence ou la disponibilité de la table, du Menu ou d’un utilisateur ; ne pas ajouter les lignes, la confirmation, l’annulation, l’envoi Cuisine, une UI, une route Adonis ou une projection de lecture. Ne pas mettre de logique métier dans `app`, ni éditer `apps/web/types/db.ts` manuellement.

## I/O & Edge-Case Matrix

| Scénario               | Entrée / état                                          | Sortie / comportement attendu                                                         | Gestion d’erreur                                                        |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| HAPPY_PATH_DINE_IN     | `serviceType: 'DineIn'`, `tableId` UUID                | `Ok<Order>` avec UUID unique, service `DineIn`, table fournie, état `Draft`, persisté | N/A                                                                     |
| HAPPY_PATH_TAKEAWAY    | `serviceType: 'Takeaway'`, `tableId: null` ou absent   | `Ok<Order>` avec table absente et état `Draft`, persisté                              | N/A                                                                     |
| INVALID_SERVICE        | service inconnu                                        | Aucun accès repository                                                                | `Err<{ type: 'invalid_service_type' }>`                                 |
| INVALID_TABLE_RELATION | `DineIn` sans table ou `Takeaway` avec table           | Aucun accès repository                                                                | Erreur métier typée                                                     |
| INVALID_TABLE_ID       | identifiant de table absent, vide ou de forme invalide | Aucun accès repository                                                                | Erreur métier typée                                                     |
| PERSISTENCE_FAILURE    | demande valide, repository en échec                    | Pas de succès ni de commande partielle                                                | L’exception d’infrastructure est propagée et la transaction est annulée |

</frozen-after-approval>

## Code Map

- `apps/web/src/core/result.ts` -- fournit `Result`, `ok` et `err` à réutiliser pour les résultats attendus.
- `apps/web/src/core/domain/entity.ts` -- base des entités identifiées ; `Order` doit l’étendre.
- `apps/web/src/core/domain/identifier.ts` -- génération UUID via `Identifier.generate` et reconstruction via `fromString`.
- `apps/web/src/core/domain/value_object.ts` -- base des Value Objects immuables.
- `apps/web/src/shared/services/transaction_manager.ts` -- `run` ouvre/réutilise la transaction et `currentDatabase` expose Kysely.
- `apps/web/src/identity/actions/register_user.ts` -- convention locale d’Action injectée, paramètres explicites et Result.
- `apps/web/src/identity/repositories/user_repository.ts` -- convention de repository, insertion Kysely, mapping et gestion d’erreur attendue.
- `apps/web/database/migrations/1761885935168_create_users_table.ts` -- style de migration Kysely à suivre ; créer une migration Commande sans modifier celle-ci.
- `apps/web/types/db.ts` -- types Kysely générés ; régénérer avec `yarn workspace @boilerplate/web db:codegen` après la migration.
- `apps/web/tests/unit/identity/register_user.spec.ts` -- style de tests unitaires par doubles de repository et de transaction à reprendre pour `CreateOrder`.
- `apps/web/package.json` -- alias `#commande/*` à ajouter si nécessaire pour le nouveau module, en conservant la direction `app` vers `src`.

## Tasks & Acceptance

**Execution:**

- [x] `apps/web/src/commande/domain/` -- définir `Order`, l’identifiant, le type de service et les erreurs de création -- centraliser les invariants de service et l’état `Draft`.
- [x] `apps/web/src/commande/repositories/order_repository.ts` -- ajouter le contrat et l’insertion/mapping Kysely de l’agrégat -- isoler la persistance et préserver l’atomicité.
- [x] `apps/web/src/commande/actions/create_order.ts` -- implémenter `CreateOrder.execute` -- valider via le domaine, générer l’identité et persister dans `TransactionManager`.
- [x] `apps/web/database/migrations/<timestamp>_create_orders_table.ts` -- créer la table `orders` avec contraintes service/table et UUID -- faire respecter l’invariant par la base.
- [x] `apps/web/types/db.ts` et `apps/web/package.json` -- régénérer les types et déclarer les alias nécessaires -- synchroniser le code généré et les imports.
- [x] `apps/web/tests/unit/commande/create_order.spec.ts` -- tester les cas nominaux, refus et transaction -- couvrir toute la matrice d’entrée/sortie.

**Acceptance Criteria:**

- Given `DineIn` avec un `tableId` valide, when `CreateOrder` s’exécute, then une commande `Draft` est retournée et persistée avec ce service et cette table.
- Given `Takeaway` sans `tableId`, when `CreateOrder` s’exécute, then une commande `Draft` est retournée et persistée sans table.
- Given une combinaison service/table invalide ou un service inconnu, when l’Action s’exécute, then elle retourne un refus métier typé sans écrire.
- Given une demande valide, when la persistance échoue, then aucun succès n’est retourné et la transaction annule l’écriture.
- Given une commande créée, when elle est rechargée par le repository, then son identifiant, son service, sa table éventuelle et son état `Draft` sont conservés.

## Verification

**Commands:**

- `yarn workspace @boilerplate/web test --suites=unit,integration` -- attendu : tous les tests unitaires et d’intégration de la story passent.
- `yarn lint` -- attendu : aucune erreur Oxlint.
- `yarn format` -- attendu : tous les fichiers sont conformes à Oxfmt.
- `yarn typecheck` -- attendu : tous les workspaces compilent.
- `yarn test` -- attendu : la suite complète passe.

## Suggested Review Order

**Création et invariants**

- L’Action valide le service, crée l’agrégat et garantit le passage transactionnel.
  [`create_order.ts:23`](../../apps/web/src/commande/actions/create_order.ts#L23)

- Le Value Object encode la relation stricte entre service et table.
  [`service_type.ts:31`](../../apps/web/src/commande/domain/service_type.ts#L31)

- L’agrégat distingue explicitement création initiale et restauration persistée.
  [`order.ts:8`](../../apps/web/src/commande/domain/order.ts#L8)

**Persistance et évolutivité**

- La migration renforce les services, tables et états connus au niveau PostgreSQL.
  [`1761955200000_create_orders_table.ts:5`](../../apps/web/database/migrations/1761955200000_create_orders_table.ts#L5)

- Le repository mappe l’agrégat complet et recharge les états du cycle.
  [`order_repository.ts:18`](../../apps/web/src/commande/repositories/order_repository.ts#L18)

**Vérification**

- Les tests couvrent les chemins nominaux, refus, UUID vide et erreur transactionnelle.
  [`create_order.spec.ts:25`](../../apps/web/tests/unit/commande/create_order.spec.ts#L25)

- Les types Kysely et l’alias de capacité raccordent le module au monorepo.
  [`db.ts:23`](../../apps/web/types/db.ts#L23)
