---
title: 'Corriger les retours de review de la story 1.1'
type: 'bugfix'
created: '2026-08-29'
status: 'done'
route: 'one-shot'
review_loop_iteration: 0
context:
  - '/Users/elie/Dev/poc-event-ddd/CONTEXT.md'
  - '/Users/elie/Dev/poc-event-ddd/docs/architecture/application.md'
  - '/Users/elie/Dev/poc-event-ddd/_bmad-output/implementation-artifacts/spec-1-1-creer-une-commande-selon-son-service.md'
---

# Corriger les retours de review de la story 1.1

## Intent

**Problem:** La création d’une commande pouvait provoquer une exception technique lorsque `tableId` recevait une valeur non textuelle au runtime, au lieu de retourner l’erreur métier `invalid_table_id`. La commande de vérification documentée dans la story devait aussi refléter la syntaxe réellement supportée par la configuration Japa.

**Approach:** Rendre les entrées de la frontière de commande tolérantes aux valeurs runtime inconnues, valider le type de `tableId` dans le Value Object `OrderService`, ajouter le cas de test correspondant et documenter la commande de test qui a été vérifiée localement.

## Suggested Review Order

**Validation runtime du Value Object**

- Le Value Object refuse les valeurs non textuelles avant toute méthode de chaîne.
  [`order_service.ts:34`](../../apps/web/src/commande/domain/order_service.ts#L34)

- L’Action expose le résultat métier pour une entrée runtime non fiable.
  [`create_order.ts:9`](../../apps/web/src/commande/actions/create_order.ts#L9)

**Preuve de non-régression**

- Le test vérifie le refus typé et l’absence d’appel au repository.
  [`create_order.spec.ts:66`](../../apps/web/tests/unit/commande/create_order.spec.ts#L66)

- Les suites unitaires et d’intégration sont lancées avec la commande documentée.
  [`spec-1-1-creer-une-commande-selon-son-service.md:81`](spec-1-1-creer-une-commande-selon-son-service.md#L81)
