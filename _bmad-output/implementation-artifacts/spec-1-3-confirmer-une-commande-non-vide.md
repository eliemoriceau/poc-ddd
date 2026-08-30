---
title: 'Story 1.3 — Confirmer une commande non vide'
type: 'feature'
created: '2026-08-30'
status: 'done'
review_loop_iteration: 0
baseline_commit: '4131e0792e10b70d40fc4ff9344ea5557afdc7ff'
context:
  - '/Users/elie/.codex/worktrees/bb00/poc-event-ddd/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '/Users/elie/.codex/worktrees/bb00/poc-event-ddd/docs/architecture/application.md'
  - '/Users/elie/.codex/worktrees/bb00/poc-event-ddd/CONTEXT.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Une commande `Draft` contenant des lignes ne peut pas encore signaler qu’elle a été validée par la personne prenant la commande. La transition doit protéger l’exigence métier qu’une commande vide ne soit jamais confirmée.

**Approach:** Ajouter la décision de confirmation à l’agrégat `Order`, puis exposer `ConfirmOrder` comme Action transactionnelle. Charger l’agrégat complet avec verrouillage, demander sa décision et persister son nouvel état via le repository existant.

## Boundaries & Constraints

**Always:** Seule une commande `Draft` contenant au moins une ligne peut devenir `Confirmed`. Les commandes vides et tous les autres statuts sont refusés par un résultat métier discriminé, sans sauvegarde ni mutation métier observable. La validation de l’état précède celle de la vacuité. La transition est atomique et conserve l’identifiant, le service, la table éventuelle et les lignes. `ConfirmOrder` retourne `Result<Order, ConfirmOrderError>` uniquement après une sauvegarde réussie ; l’agrégat retourné représente donc l’état validé par la base. L’Action reste indépendante d’HTTP et de l’interface de livraison ; le repository conserve le mapping Kysely.

**Ask First:** Si la persistance actuelle ne permet pas de sauvegarder le statut sans réécrire ou perdre les lignes, arrêter et demander une décision d’architecture avant de modifier le contrat du repository.

**Never:** Ne pas envoyer la commande en cuisine, revalider le Menu, modifier les lignes, ajouter de route ou d’UI, introduire une règle de paiement ou déplacer la logique métier dans `app`. Ne pas éditer manuellement les types Kysely générés.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| CONFIRM | `Draft` avec au moins une ligne | Résultat succès, statut `Confirmed` persisté | N/A |
| EMPTY_ORDER | `Draft` sans ligne | Résultat `order_empty`, statut inchangé | Refus métier typé |
| INVALID_STATE | `Confirmed`, `SentToKitchen` ou `Cancelled` | Résultat `order_not_draft`, aucune mutation | Refus métier typé |
| NOT_FOUND | Identifiant absent du repository | Aucun chargement exploitable | Résultat `order_not_found` |
| INVALID_IDENTIFIER | Identifiant qui n’est pas un UUID valide | Aucun accès au repository | Résultat `invalid_order_identifier` |
| PERSISTENCE_FAILURE | Transition valide puis échec de sauvegarde | Pas de commit partiel | L’erreur d’infrastructure est propagée |

</frozen-after-approval>

## Code Map

- `apps/web/src/commande/domain/order.ts` — agrégat propriétaire du statut et des lignes ; ajouter la décision `confirm` et ses résultats métier.
- `apps/web/src/commande/domain/order_status.ts` — constantes de statut existantes ; réutiliser `Draft` et `Confirmed` sans créer de doublon.
- `apps/web/src/commande/actions/confirm_order.ts` — nouvelle Action ; valider l’identifiant, charger avec `findOrderForUpdate`, appliquer la décision et appeler `saveOrder` dans `TransactionManager`. Son contrat est `Result<Order, ConfirmOrderError>` et aucun `Order` n’est retourné après un échec de persistance.
- `apps/web/src/commande/repositories/order_repository.ts` — persistance existante ; vérifier que `saveOrder` écrit bien le statut et recharge l’agrégat complet sans altérer les lignes.
- `apps/web/tests/unit/commande/order.spec.ts` — tests de la transition, commande vide, statuts interdits et conservation des lignes.
- `apps/web/tests/unit/commande/confirm_order.spec.ts` — tests du contrat de l’Action, résultats typés, absence de sauvegarde sur refus et propagation des échecs.
- `apps/web/tests/integration/commande/order_persistence.spec.ts` — preuve PostgreSQL du rechargement après confirmation, conservation du service/table/lignes et rollback.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/commande/domain/order.ts` — implémenter `confirm()` et les erreurs métier — centraliser l’invariant `Draft` non vide dans l’agrégat, avec priorité à `order_not_draft`.
- [x] `apps/web/src/commande/actions/confirm_order.ts` — créer l’Action transactionnelle — isoler le cas d’usage du transport et préserver l’atomicité.
- [x] `apps/web/src/commande/repositories/order_repository.ts` — compléter ou vérifier la sauvegarde du statut — conserver le mapping et l’agrégat complet.
- [x] `apps/web/tests/unit/commande/order.spec.ts` et `confirm_order.spec.ts` — couvrir la matrice nominale, les quatre erreurs typées, la priorité des refus et l’absence de sauvegarde — fournir un contrat exécutable.
- [x] `apps/web/tests/integration/commande/order_persistence.spec.ts` — tester confirmation, rechargement et rollback — prouver la persistance PostgreSQL.

**Acceptance Criteria:**
- Given une commande `Draft` avec au moins une ligne, when `ConfirmOrder` s’exécute, then elle devient `Confirmed`.
- Given une commande `Draft` vide, when `ConfirmOrder` s’exécute, then un refus `order_empty` est retourné et la commande reste `Draft`.
- Given une commande non-`Draft`, when `ConfirmOrder` s’exécute, then un refus `order_not_draft` est retourné sans sauvegarde ni mutation.
- Given une commande vide dans un état non-`Draft`, when `ConfirmOrder` s’exécute, then `order_not_draft` est retourné avant `order_empty`.
- Given un identifiant invalide, when `ConfirmOrder` s’exécute, then `invalid_order_identifier` est retourné sans accès au repository.
- Given une demande valide, when la sauvegarde échoue, then l’exception est propagée, aucun `Order` n’est retourné et aucune modification partielle n’est commitée.
- Given une demande valide, when `ConfirmOrder` retourne un succès, then l’`Order` retourné est `Confirmed` et cohérent avec l’état persisté dans la même transaction.
- Given une commande confirmée rechargée, when elle est lue depuis le repository, then son statut est `Confirmed`, ses lignes et ses informations de service sont inchangées.

## Design Notes

La méthode de domaine doit modifier le statut uniquement après avoir vérifié toutes les préconditions, en retournant `order_not_draft` avant de tester les lignes. L’Action doit charger avec verrouillage comme `AddOrderLine` afin que la décision et la sauvegarde appartiennent à la même transaction. `saveOrder` doit persister le statut et conserver les lignes existantes. Le succès de l’Action n’est retourné qu’une fois `saveOrder` terminé ; une exception de persistance interrompt le flux et empêche tout retour d’agrégat incohérent avec la base.

## Verification

**Commands:**
- `yarn test` — attendu : toute la suite passe, y compris les tests Commande.
- `yarn lint` — attendu : aucune erreur Oxlint.
- `yarn format` — attendu : aucun fichier non conforme à Oxfmt.
- `yarn typecheck` — attendu : tous les workspaces compilent.

## Suggested Review Order

**Orchestration du cas d’usage**

- L’Action valide l’identifiant, verrouille l’agrégat et ne retourne un succès qu’après sauvegarde.
  [`confirm_order.ts:30`](../../../apps/web/src/commande/actions/confirm_order.ts#L30)

**Invariant métier**

- L’agrégat impose l’ordre des refus et la transition unique `Draft → Confirmed`.
  [`order.ts:60`](../../../apps/web/src/commande/domain/order.ts#L60)

**Persistance atomique**

- Le repository persiste le statut, vérifie la ligne cible et conserve la synchronisation des lignes.
  [`order_repository.ts:48`](../../../apps/web/src/commande/repositories/order_repository.ts#L48)

**Preuves**

- Les tests d’Action couvrent les résultats typés, les refus et l’absence de retour après échec.
  [`confirm_order.spec.ts:52`](../../../apps/web/tests/unit/commande/confirm_order.spec.ts#L52)

- Les tests PostgreSQL vérifient rechargement, conservation des données et rollback.
  [`order_persistence.spec.ts:203`](../../../apps/web/tests/integration/commande/order_persistence.spec.ts#L203)
