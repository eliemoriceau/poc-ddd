---
title: 'Corriger la review des tests de persistance PostgreSQL'
type: 'bugfix'
created: '2026-08-29'
status: 'done'
baseline_commit: '40537c5c0957a7bc1ae0e367819a74148f5eca17'
review_loop_iteration: 0
context:
  - '/Users/elie/Dev/poc-event-ddd/CONTEXT.md'
  - '/Users/elie/Dev/poc-event-ddd/docs/architecture/application.md'
  - '/Users/elie/Dev/poc-event-ddd/apps/web/tests/integration/commande/order_persistence.spec.ts'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La review a identifié deux faiblesses dans le test PostgreSQL de `Order` : le schéma de test porte un nom fixe, ce qui crée un risque de collision entre exécutions, et les assertions `assert.rejects()` acceptent toute erreur SQL sans prouver que la contrainte métier attendue a refusé l’écriture.

**Approach:** Rendre le schéma unique à chaque exécution et renforcer les assertions pour vérifier le code et le nom de la contrainte PostgreSQL. Le repository conservera `public` par défaut afin de ne pas modifier le comportement applicatif.

## Boundaries & Constraints

**Always:** Le test ne doit ni supprimer ni recréer `public.orders`. Chaque exécution doit posséder son propre schéma. Les trois scénarios invalides doivent identifier l’erreur de contrainte correspondante. Le comportement de `OrderRepository` en production reste inchangé avec le schéma `public` par défaut.

**Ask First:** Toute modification des invariants métier, de la migration de production, du contrat de `CreateOrder` ou du modèle DDD.

**Never:** Ne pas désactiver les contraintes SQL, masquer une erreur de connexion par une assertion trop large, utiliser une base partagée sans isolation, ni éditer manuellement `apps/web/types/db.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| PARALLEL_TEST_SCHEMA | Deux exécutions simultanées | Chaque exécution possède un schéma distinct | Aucune suppression croisée |
| INVALID_DINE_IN_TABLE | `DineIn` avec `table_id` nul | PostgreSQL refuse l’insertion | Code `23514`, contrainte `orders_service_table_check` |
| INVALID_TAKEAWAY_TABLE | `Takeaway` avec table | PostgreSQL refuse l’insertion | Code `23514`, contrainte `orders_service_table_check` |
| INVALID_STATUS | Statut `Unknown` | PostgreSQL refuse l’insertion | Code `23514`, contrainte `orders_status_check` |

</frozen-after-approval>

## Code Map

- `apps/web/tests/integration/commande/order_persistence.spec.ts` -- créer un nom de schéma unique par processus/exécution, l’utiliser pour la migration et les requêtes, puis supprimer uniquement ce schéma ; préciser les assertions des trois violations SQL.
- `apps/web/src/commande/repositories/order_repository.ts` -- conserver le paramètre de schéma optionnel avec `public` comme valeur par défaut ; vérifier que les écritures et lectures utilisent le même schéma sans modifier le mapping DDD.
- `apps/web/database/migrations/1761955200000_create_orders_table.ts` -- lecture seule ; réutiliser `up` avec le schéma de test sans changer les contraintes de production.
- `apps/web/src/shared/services/transaction_manager.ts` -- lecture seule ; confirmer que le repository reçoit bien la connexion active et que l’isolation de schéma ne dépend pas d’un `search_path` global.
- `apps/web/types/db.ts` -- généré ; ne pas modifier manuellement.

## Tasks & Acceptance

**Execution:**

- [x] `apps/web/tests/integration/commande/order_persistence.spec.ts` -- générer un schéma unique et remplacer les `assert.rejects` permissifs par des vérifications du code `23514` et des contraintes attendues -- empêcher les collisions et les faux positifs.
- [x] `apps/web/src/commande/repositories/order_repository.ts` -- conserver l’usage du schéma configurable avec `public` par défaut -- isoler le test sans changer la production.

**Acceptance Criteria:**

- Given deux exécutions du test en parallèle, when elles initialisent leur persistance, then elles n’utilisent ni ne suppriment le même schéma.
- Given une insertion `DineIn` sans table, when PostgreSQL l’exécute, then le test vérifie précisément `23514` et `orders_service_table_check`.
- Given une insertion `Takeaway` avec table, when PostgreSQL l’exécute, then le test vérifie précisément `23514` et `orders_service_table_check`.
- Given une insertion avec le statut `Unknown`, when PostgreSQL l’exécute, then le test vérifie précisément `23514` et `orders_status_check`.
- Given le runtime applicatif sans schéma explicite, when `OrderRepository` écrit ou lit une commande, then il utilise `public` comme avant.

## Verification

**Commands:**

- `yarn lint` -- expected: aucune erreur Oxlint.
- `yarn format` -- expected: tous les fichiers sont conformes à Oxfmt.
- `yarn typecheck` -- expected: tous les workspaces compilent.
- `NODE_ENV=test HOST=127.0.0.1 LOG_LEVEL=info APP_KEY=<clé-locale> DATABASE_URL=<.env.test> APP_URL=http://127.0.0.1:3333 yarn workspace @boilerplate/web test unit integration` -- expected: tests unitaires et intégration verts, sans suppression de `public.orders`.

## Suggested Review Order

**Isolation de la persistance**

- Le repository qualifie chaque requête avec `public` par défaut ou le schéma de test explicite.
  [`order_repository.ts:14`](../../apps/web/src/commande/repositories/order_repository.ts#L14)

- Le test génère un schéma unique et ne supprime jamais `public.orders`.
  [`order_persistence.spec.ts:12`](../../apps/web/tests/integration/commande/order_persistence.spec.ts#L12)

**Preuves de contraintes SQL**

- Le helper distingue une erreur PostgreSQL d’un échec arbitraire et vérifie `23514`.
  [`order_persistence.spec.ts:15`](../../apps/web/tests/integration/commande/order_persistence.spec.ts#L15)

- Chaque scénario associe l’insertion invalide à la contrainte métier attendue.
  [`order_persistence.spec.ts:82`](../../apps/web/tests/integration/commande/order_persistence.spec.ts#L82)

**Couverture du comportement par défaut**

- Le test unitaire verrouille l’usage du schéma `public` sans configuration explicite.
  [`order_repository.spec.ts:7`](../../apps/web/tests/unit/commande/order_repository.spec.ts#L7)

- Les suites unitaires et d’intégration constituent la preuve d’exécution finale.
  [`order_persistence.spec.ts:50`](../../apps/web/tests/integration/commande/order_persistence.spec.ts#L50)
