---
title: 'Story 1.4 — Annuler une commande selon son état'
type: 'feature'
created: '2026-08-31'
status: 'done'
review_loop_iteration: 4
context:
  - '/Users/elie/.codex/worktrees/3458/poc-event-ddd/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '/Users/elie/.codex/worktrees/3458/poc-event-ddd/docs/architecture/application.md'
  - '/Users/elie/.codex/worktrees/3458/poc-event-ddd/CONTEXT.md'
baseline_commit: '4131e0792e10b70d40fc4ff9344ea5557afdc7ff'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Une commande créée et éventuellement confirmée ne peut pas être annulée, ce qui laisse le cycle métier incomplet et permettrait à une commande qui ne doit plus être préparée de poursuivre son traitement.

**Approach:** Ajouter la décision d’annulation à l’agrégat `Order`, puis exposer `CancelOrder` comme Action transactionnelle. L’annulation est permise pour une commande `Draft` ou `Confirmed`; elle est idempotente pour une commande déjà `Cancelled` et interdite après l’envoi en cuisine.

## Boundaries & Constraints

**Always:** Seul `Order` décide et modifie son état. `Draft → Cancelled` et `Confirmed → Cancelled` sont les seules transitions d’annulation qui mutent l’agrégat. Une commande `SentToKitchen` ne peut pas être annulée dans le périmètre initial. Une commande déjà `Cancelled` retourne un succès idempotent sans nouvelle sauvegarde. Les refus attendus retournent un `Result` métier discriminé, indépendant de HTTP, d’Inertia et des textes traduits. L’Action charge l’agrégat pour mise à jour et persiste la mutation dans une transaction uniquement lorsqu’une mutation est nécessaire.

**Ask First:** Si l’implémentation révèle qu’un contrat existant empêche de charger et persister l’agrégat complet, ou qu’une politique d’annulation après `SentToKitchen` est déjà requise par une contrainte non documentée, arrêter et demander une décision.

**Never:** Ne pas ajouter de route, contrôleur, interface utilisateur, autorisation opérateur, remboursement, notification, intégration Cuisine, outbox ou modification des règles d’ajout/confirmation. Ne pas transformer l’idempotence en nouvelle transition d’état ou en sauvegarde répétée.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| CANCEL_DRAFT | identifiant d’une commande `Draft` | état `Cancelled` puis agrégat persisté | succès `Result` |
| CANCEL_CONFIRMED | identifiant d’une commande `Confirmed` | état `Cancelled` puis agrégat persisté | succès `Result` |
| ALREADY_CANCELLED | `Cancelled` | succès idempotent, sans mutation ni nouvelle sauvegarde | succès `Result` |
| INVALID_STATE | `SentToKitchen` | aucune mutation ni sauvegarde | refus `order_not_cancellable` |
| NOT_FOUND | identifiant valide absent | aucune mutation | refus `order_not_found` |
| INVALID_ID | identifiant absent ou mal formé | repository non appelé | refus `invalid_order_identifier` |
| PERSISTENCE_FAILURE | annulation valide puis échec de sauvegarde | aucune annulation persistée | exception propagée, transaction non validée |

</frozen-after-approval>

## Code Map

- `apps/web/src/commande/domain/order.ts` — agrégat propriétaire de `status`; ajouter une décision d’annulation sans exposer de mutation arbitraire.
- `apps/web/src/commande/domain/order_status.ts` — valeurs et parsing des états déjà persistés; ne pas dupliquer les chaînes d’état.
- `apps/web/src/commande/actions/add_order_line.ts` — modèle de validation d’identifiant, chargement `forUpdate`, `Result` et transaction à réutiliser.
- `apps/web/src/commande/actions/cancel_order.ts` — nouvelle Action de commande; charger, demander la décision à `Order`, sauvegarder seulement en cas de succès.
- `apps/web/src/commande/repositories/order_repository.ts` — contrat et mapping de l’agrégat; réutiliser `findOrderForUpdate` et `saveOrder` sans logique métier.
- `apps/web/tests/unit/commande/order.spec.ts` — tests des transitions et de l’absence de mutation en cas de refus.
- `apps/web/tests/unit/commande/cancel_order.spec.ts` — tests de l’Action, du typage des erreurs, du verrouillage et de la transaction.
- `apps/web/tests/integration/commande/order_persistence.spec.ts` — preuve PostgreSQL de la persistance de l’état annulé et du rollback si nécessaire.

## Tasks & Acceptance

**Execution:**

- [x] `apps/web/src/commande/domain/order.ts` — implémenter `cancel` avec succès idempotent et erreur métier — centraliser les transitions autorisées.
- [x] `apps/web/src/commande/actions/cancel_order.ts` — créer l’Action transactionnelle — isoler le cas d’usage du transport.
- [x] `apps/web/tests/unit/commande/order.spec.ts` et `cancel_order.spec.ts` — couvrir la matrice d’états, l’idempotence et les erreurs — empêcher les mutations silencieuses.
- [x] `apps/web/tests/integration/commande/order_persistence.spec.ts` — vérifier la persistance et le rollback — prouver le comportement transactionnel.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` — marquer la story terminée après validation — synchroniser le suivi BMAD.

**Acceptance Criteria:**

- Given une commande `Draft` ou `Confirmed`, when `CancelOrder` est exécutée, then la commande devient `Cancelled` et est persistée.
- Given une commande déjà `Cancelled`, when une annulation est demandée, then un succès idempotent est retourné sans mutation ni nouvelle sauvegarde.
- Given une commande `SentToKitchen`, when une annulation est demandée, then un refus `order_not_cancellable` est retourné sans mutation ni sauvegarde.
- Given un identifiant invalide ou une commande absente, when l’Action est exécutée, then elle retourne le refus typé correspondant sans mutation.
- Given une erreur de persistance, when l’annulation est exécutée, then l’exception est propagée et aucun état partiel n’est validé.

## Verification

**Commands:**

- `yarn lint` — attendu : aucune erreur Oxlint.
- `yarn format` — attendu : aucun fichier non conforme à Oxfmt.
- `yarn typecheck` — attendu : tous les workspaces compilent.
- `yarn test` — attendu : les tests unitaires et d’intégration passent.

## Suggested Review Order

**Cas d’usage et invariants**

- L’Action orchestre validation, verrouillage, idempotence et persistance.
  [`cancel_order.ts:26`](../../apps/web/src/commande/actions/cancel_order.ts#L26)

- L’agrégat possède les transitions et refuse les états non annulables.
  [`order.ts:58`](../../apps/web/src/commande/domain/order.ts#L58)

**Persistance transactionnelle**

- Le repository persiste le statut avant la synchronisation atomique des lignes.
  [`order_repository.ts:48`](../../apps/web/src/commande/repositories/order_repository.ts#L48)

- Les tests PostgreSQL prouvent succès, rollback et erreur après écriture du statut.
  [`order_persistence.spec.ts:244`](../../apps/web/tests/integration/commande/order_persistence.spec.ts#L244)

**Couverture de comportement**

- Les tests unitaires couvrent états autorisés, idempotence, refus et entrées invalides.
  [`cancel_order.spec.ts:39`](../../apps/web/tests/unit/commande/cancel_order.spec.ts#L39)

- Les tests de domaine vérifient l’absence de mutation pour les états interdits.
  [`order.spec.ts:121`](../../apps/web/tests/unit/commande/order.spec.ts#L121)
