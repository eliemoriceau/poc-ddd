---
title: 'Story 1.2 — Ajouter et fusionner les lignes d’une commande'
type: 'feature'
created: '2026-08-29'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
deferred: []
baseline_commit: 'f8139a3103ab61f036d97fc8cd2fbe34a678de65'
context:
  - '/Users/elie/Dev/poc-event-ddd/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '/Users/elie/Dev/poc-event-ddd/docs/architecture/application.md'
  - '/Users/elie/Dev/poc-event-ddd/CONTEXT.md'
---

<intent-contract>

## Intent

**Problem:** Une commande `Draft` créée par la story 1.1 ne peut pas encore recevoir ses articles. Sans cette capacité, les quantités demandées, la fusion des lignes et la capture du prix ne sont pas garanties par le domaine.

**Approach:** Ajouter `OrderLine`, les Value Objects nécessaires et le comportement de mutation à l’agrégat `Order`, puis exposer `AddOrderLine` comme Action transactionnelle. Étendre la persistance Kysely avec `order_lines`, son mapping et la contrainte d’unicité par commande et article.

## Boundaries & Constraints

**Always:** Seul `Order` possède et modifie ses lignes. Une ligne contient `menuItemId`, nom, quantité entière strictement positive et prix entier en centimes supérieur ou égal à zéro. Le premier nom et le premier prix sont conservés ; un nouvel ajout du même `menuItemId` augmente uniquement la quantité. L’ajout est réservé à l’état `Draft`, transactionnel et atomique. La base protège l’unicité `(order_id, menu_item_id)` et les mises à jour concurrentes ne doivent pas perdre de quantité. Les refus attendus retournent un `Result` métier indépendant du transport.

**Block If:** L’implémentation révèle que le contrat de repository de la story 1.1 ne permet pas de charger et persister l’agrégat complet, ou qu’une stratégie de concurrence compatible avec Kysely/Postgres ne peut pas être établie sans modifier une décision d’architecture.

**Never:** Ne pas ajouter de validation d’existence ou de disponibilité du Menu, de quantité maximale, de règle de longueur du nom, de modification après confirmation, de route/UI, ni de prix flottant. Ne pas modifier manuellement les types Kysely générés ni placer la logique métier dans `app`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| ADD_LINE | `Draft`, article valide | Une ligne est ajoutée avec les valeurs capturées | Succès `Result` |
| MERGE_LINE | `Draft`, même `menuItemId` | Quantité additionnée, nom/prix initiaux conservés | Succès sans ligne dupliquée |
| INVALID_INPUT | nom absent, quantité `<= 0`, prix `< 0` ou non entier | Commande inchangée | Refus métier typé |
| INVALID_STATE | commande `Confirmed`, `SentToKitchen` ou `Cancelled` | Commande inchangée | Refus métier typé |
| CONCURRENT_ADD | deux ajouts du même article | Une ligne, quantité égale à la somme | Transaction/contrainte empêchant la perte ou le doublon |

</intent-contract>

## Code Map

- `apps/web/src/commande/domain/order.ts` — agrégat existant à étendre ; il doit rester propriétaire des lignes et refuser l’ajout hors `Draft`.
- `apps/web/src/commande/domain/order_line.ts` — nouveau modèle de ligne ; porte l’identité `menuItemId`, le nom, la quantité et le prix capturé.
- `apps/web/src/commande/domain/price.ts` et `apps/web/src/commande/domain/menu_item_identifier.ts` — Value Objects à créer si aucun équivalent partagé n’existe ; valident les centimes et les identifiants.
- `apps/web/src/commande/actions/add_order_line.ts` — nouvelle Action ; charge l’agrégat, demande sa décision, puis persiste dans `TransactionManager` avec un `Result` discriminé.
- `apps/web/src/commande/repositories/order_repository.ts` — compléter le chargement et la persistance de l’agrégat avec ses lignes ; conserver tout mapping Kysely dans le repository.
- `apps/web/database/migrations/` — nouvelle migration `order_lines` avec clé étrangère, unicité `(order_id, menu_item_id)`, types entiers et contraintes de quantité/prix.
- `apps/web/types/db.ts` — artefact généré à régénérer via `yarn workspace @boilerplate/web db:codegen`, jamais édité à la main.
- `apps/web/tests/unit/commande/` — tests du domaine, de l’Action et du repository ; reprendre les doubles et conventions de la story 1.1.
- `apps/web/tests/integration/commande/` — preuve PostgreSQL de fusion, rechargement, contraintes et concurrence si l’environnement d’intégration le permet.

## Tasks & Acceptance

**Execution:**

- [x] `apps/web/src/commande/domain/order_line.ts`, `order.ts` et Value Objects associés — modéliser une ligne et implémenter ajout/fusion avec invariants — centraliser le comportement dans l’agrégat.
- [x] `apps/web/src/commande/actions/add_order_line.ts` — implémenter l’Action transactionnelle et ses erreurs typées — isoler le cas d’usage du transport.
- [x] `apps/web/src/commande/repositories/order_repository.ts` — persister et recharger les lignes atomiquement — garantir le mapping complet et la fusion concurrente.
- [x] `apps/web/database/migrations/` et `apps/web/types/db.ts` — ajouter le schéma puis régénérer les types — renforcer les invariants en base.
- [x] `apps/web/tests/unit/commande/` et `apps/web/tests/integration/commande/` — couvrir les scénarios nominaux, invalides, capture initiale et concurrence — fournir une preuve exécutable.

**Acceptance Criteria:**

- Given une commande `Draft`, when un article valide est ajouté, then une ligne contient son identifiant, nom, quantité et prix en centimes.
- Given une ligne existante du même `menuItemId`, when l’article est ajouté à nouveau, then une seule ligne subsiste avec la quantité sommée et le nom/prix du premier ajout.
- Given une entrée invalide, when `AddOrderLine` s’exécute, then un refus métier typé est retourné et la commande reste inchangée.
- Given une commande qui n’est pas `Draft`, when un ajout est demandé, then l’opération est refusée sans mutation.
- Given deux ajouts concurrents du même article, when ils sont persistés, then la base contient une seule ligne et la quantité finale est la somme des ajouts acceptés.
- Given une erreur de persistance, when l’Action termine, then aucune ligne ni quantité partiellement modifiée ne reste persistée.

## Design Notes

Le prix doit être persisté comme entier `unit_price_cents`; le domaine ne doit jamais calculer avec des flottants. Pour la concurrence, le choix concret (verrouillage de la commande, verrouillage de ligne ou upsert atomique) doit suivre les primitives déjà utilisées par le projet, mais doit préserver la contrainte unique et l’addition sans perte.

## Review Triage Log

### 2026-08-29 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 0, medium 5, low 1)
- defer: 0
- reject: 13: (high 0, medium 8, low 5)
- addressed_findings:
  - `[medium][patch]` Validation typée de `orderId` ajoutée avant l’accès au repository.
  - `[low][patch]` Copie défensive des lignes ajoutée lors de la restauration de l’agrégat.
  - `[medium][patch]` Dépassement de la capacité entière PostgreSQL refusé par le domaine.
  - `[medium][patch]` Nom de ligne vide ou blanc refusé par la contrainte SQL.
  - `[medium][patch]` Tests ajoutés pour les statuts non-Draft via l’Action, sans sauvegarde ni mutation.
  - `[medium][patch]` Test ajouté pour l’échec de sauvegarde et l’absence de commit partiel.

### 2026-08-30 — Corrections des retours de revue

- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 2, low 0)
- defer: 0
- reject: 16: (high 0, medium 5, low 11)
- addressed_findings:
  - `[medium][patch]` `saveOrder` synchronise désormais les lignes absentes de l’agrégat, y compris lorsque celui-ci ne contient aucune ligne ; tests unitaires et PostgreSQL ajoutés.
  - `[medium][patch]` La reconstruction d’une ligne depuis PostgreSQL passe par `OrderLine.restoreFromPersistence`, supprimant la validation dupliquée du repository.

## Auto Run Result

- Résumé : implémentation complète de l’ajout et de la fusion des lignes d’une commande `Draft`, avec invariants métier, persistance PostgreSQL atomique et sérialisation des ajouts concurrents.
- Fichiers modifiés : `apps/web/src/commande/domain/order.ts` et `order_line.ts` — agrégat, ligne, fusion et bornes ; `apps/web/src/commande/domain/price.ts` et `menu_item_identifier.ts` — Value Objects ; `apps/web/src/commande/actions/add_order_line.ts` — Action transactionnelle ; `apps/web/src/commande/repositories/order_repository.ts` — mapping et verrouillage ; `apps/web/database/migrations/1761955200001_create_order_lines_table.ts` — schéma et contraintes ; `apps/web/types/db.ts` — types régénérés ; tests Commande — couverture unitaire et PostgreSQL ; `sprint-status.yaml` — statut de story.
- Revue : 6 corrections appliquées, 0 élément différé, 13 constats rejetés comme faux positifs ou hors problème de cette story.
- Revue de suivi : recommandée ; 5 constats medium et 1 low corrigés, score `3 × 5 + 1 × 1 = 16`.
- Vérifications : `yarn workspace @boilerplate/web test --suites=unit,integration` — 52 tests réussis ; `yarn lint` — réussi ; `yarn format` — réussi ; `yarn typecheck` — réussi ; `yarn test` — 52 tests réussis ; `git diff --check` — réussi.
- Risques résiduels : aucun dans le périmètre de la story. Les tests utilisent PostgreSQL local et des schémas isolés par processus.

- Résumé complémentaire : corrections des deux retours thermo-nucléaires retenus ; persistance complète des lignes et mapping de restauration centralisé.
- Fichiers modifiés : `apps/web/src/commande/repositories/order_repository.ts` — synchronisation des suppressions et agrégats vides ; `apps/web/src/commande/domain/order_line.ts` — factory de restauration persistence ; tests unitaires et intégration PostgreSQL — couverture de ces comportements ; ce spec — journal de revue mis à jour.
- Revue : 2 patchs appliqués, 0 élément différé, 16 constats rejetés.
- Revue de suivi recommandée : oui ; 0 high, 2 medium, 0 low ; score `3 × 2 + 0 × 1 = 6`.
- Vérifications : 59 tests unitaires/intégration réussis, `yarn lint`, `yarn format`, `yarn typecheck` et `git diff --check` réussis.
- Risques résiduels : aucun risque identifié dans le périmètre de cette story.

### 2026-08-30 — Corrections de revue thermo-nucléaire

- 8 corrections appliquées : validation de `addQuantity`, restauration validée des lignes, détection des doublons dans `Order`, passage des montants et quantités en `bigint`, mapping sûr des valeurs `bigint`, upsert conservant le nom/prix initiaux, gestion d’un agrégat sans lignes et preuves PostgreSQL de rollback/FK/cascade.
- 0 élément différé ; les constats restants concernant le contrat d’injection partagé, la granularité de tests et la documentation de suivi ont été rejetés comme préexistants, non bloquants ou déjà couverts par l’architecture existante.
- Vérifications finales : 58 tests unitaires/intégration réussis, `yarn test` réussi, `yarn lint` réussi, `yarn format` réussi, `yarn typecheck` réussi et `git diff --check` réussi.
- Revue de suivi recommandée : oui, en raison de corrections de sévérité élevée portant sur les invariants de l’agrégat ; score de cette passe : 2 high, 4 medium, 2 low.

## Verification

**Commands:**

- `yarn workspace @boilerplate/web test --suites=unit,integration` — attendu : tests Commande verts.
- `yarn lint` — attendu : aucune erreur Oxlint.
- `yarn format` — attendu : aucun fichier non conforme à Oxfmt.
- `yarn typecheck` — attendu : tous les workspaces compilent.
- `yarn test` — attendu : la suite complète passe.
