---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-08-27'
---

# Test Design: Epic 1 - Gérer le cycle complet d’une commande

**Date:** 2026-08-27  
**Author:** Elie  
**Status:** Draft

## Executive Summary

**Scope:** Conception de tests au niveau Epic pour les six stories de la commande et FR1–FR10.

La stratégie est API-first : le domaine est couvert par des tests unitaires, les repositories et l’intégration Cuisine par des tests d’intégration, et les Actions Adonis par des tests API. Aucun E2E n’est requis tant qu’aucune interface de commande n’est spécifiée.

**Risk Summary:**

- Total risks identified: 8
- High-priority risks (≥6): 5
- Critical categories: DATA, BUS

**Coverage Summary:**

- P0 scenarios: 6 (~12–20 hours)
- P1 scenarios: 12 (~16–26 hours)
- P2/P3 scenarios: 1 (~3–8 hours)
- **Total effort:** ~31–54 hours (~1–2 weeks)

## Not in Scope

| Item | Reasoning | Mitigation |
|---|---|---|
| Interface de commande E2E | Aucune UI de commande n’est définie dans l’Epic. | Ajouter un smoke E2E P1 si une UI est introduite. |
| Pact / broker externe | Aucun artefact Pact, package ou provider n’existe dans le projet. | Tester le contrat local Cuisine avec un double d’intégration. |
| Charge et performance chiffrées | Aucun seuil de latence, volume ou concurrence n’est spécifié. | Clarifier les seuils avant d’ajouter une campagne k6. |
| Authentification spécifique à la commande | La politique d’accès n’est pas définie dans les stories. | Ajouter les tests négatifs dès que la politique de routes est arrêtée. |

## Risk Assessment

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---|---|---|---:|---:|---:|---|---|---|
| R-01 | DATA | Deux envois concurrents peuvent notifier deux fois Cuisine ou corrompre l’état. | 3 | 3 | 9 | Test d’intégration concurrent et transition atomique. | Backend | Story 1.5 |
| R-02 | BUS | Une commande peut passer à `SentToKitchen` après un rejet ou timeout Cuisine. | 2 | 3 | 6 | Simuler succès, rejet et timeout ; vérifier l’état final. | Backend | Story 1.5 |
| R-03 | DATA | Une panne d’écriture locale après succès Cuisine peut rendre le retry incohérent. | 2 | 3 | 6 | Injecter l’échec d’écriture et vérifier le retry sans doublon. | Backend | Story 1.5 |
| R-04 | BUS | Des lignes invalides ou une confirmation vide violent les invariants métier. | 2 | 3 | 6 | Tests unitaires des bornes et préconditions. | Domaine | Stories 1.1–1.3 |
| R-06 | DATA | Le modèle de persistance peut perdre le prix capturé ou l’identité d’une ligne. | 2 | 3 | 6 | Tests de round-trip repository et contraintes de migration. | Persistence | Stories 1.1–1.2 |

### Medium-Priority Risks (Score 3–4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---|---|---|---:|---:|---:|---|---|
| R-05 | TECH | Les cinq mappings Action-vers-HTTP peuvent diverger. | 2 | 2 | 4 | Table de mapping et tests API dédiés. | Application |
| R-08 | PERF | Contention DB ou appel Cuisine lent dégrade l’envoi. | 2 | 2 | 4 | Mesurer la contention ; définir un seuil avant les tests de charge. | Backend |
| R-07 | SEC | La politique d’authentification des mutations n’est pas encore documentée. | 1 | 3 | 3 | Documenter puis tester quand la politique est définie. | Application |

### Low-Priority Risks (Score 1–2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---|---|---|---:|---:|---:|---|
| — | — | Aucun risque classé 1–2. | — | — | — | Surveillance documentaire. |

## NFR Planning

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
|---|---|---|---|---|
| Security | Seuil et politique d’accès inconnus. | R-07 | Tests API d’accès et revue middleware. | Résultats API, configuration des routes. |
| Performance | Latence, volume et timeout Cuisine inconnus. | R-08 | Tests de contention ; k6 après clarification. | Rapport de timing et charge. |
| Reliability | Retry, idempotence, atomicité et récupération sont requis fonctionnellement. | R-01–R-03 | Tests d’intégration avec fautes injectées. | Rapport, logs structurés, états finaux. |
| Scalability | Aucun objectif de volume/concurrence. | R-01, R-08 | Clarification puis test de charge. | Seuils approuvés et résultats. |
| Maintainability | Actions explicites, Result mapping, séparation app/src. | R-05 | Typecheck, lint, couverture et revue de duplication. | Rapports CI. |
| Compliance | Aucun besoin identifié. | — | Hors périmètre actuel. | Réévaluation si le périmètre change. |

**Unknown thresholds:** sécurité, performance, scalabilité et timeout précis de Cuisine. Ils ne doivent pas être inventés.

## Entry Criteria

- [ ] Stories et règles métier validées.
- [ ] Décision d’architecture prise sur l’ordre exact de persistance de `SendOrderToKitchen`.
- [ ] Double Cuisine capable d’injecter succès, rejet et timeout.
- [ ] Factories de commande et de lignes disponibles.
- [ ] Base Postgres de test et nettoyage isolé disponibles.
- [ ] Mappings HTTP et codes d’erreur des Actions définis.

## Exit Criteria

- [ ] Tous les P0 passent.
- [ ] Au moins 95 % des P1 passent, avec échecs triés.
- [ ] Aucun risque ≥6 ouvert sans mitigation.
- [ ] Chaque critère d’acceptation est traçable vers un test.
- [ ] Le comportement concurrent et le retry post-échec d’écriture sont démontrés.

## Test Coverage Plan

**P0/P1/P2/P3 sont des priorités, pas des calendriers d’exécution.** Les tests sont placés au niveau le moins coûteux qui vérifie correctement le comportement.

### P0 (Critical)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---|---|---|---|---|
| T-11 | Envoi confirmé vers Cuisine sans prix. | Integration | R-02 | Vérifier item, nom, quantité uniquement. |
| T-12 | Refus des états non envoyables. | Unit + Integration | R-02 | Aucun appel Cuisine. |
| T-13 | Succès Cuisine puis persistance `SentToKitchen`. | Integration | R-01 | Une seule transition. |
| T-14 | Rejet/timeout Cuisine conserve `Confirmed`. | Integration | R-02 | Échec retryable. |
| T-15 | Échec de persistance locale puis retry sûr. | Integration | R-03 | Pas de notification dupliquée. |
| T-16 | Deux envois concurrents. | Integration | R-01 | Une transition et une notification. |

**Total P0:** 6 tests/scénarios, ~12–20 heures.

### P1 (High)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---|---|---|---|---|
| T-01 | Création d’une commande. | Unit | — | Identité, état initial, timestamps. |
| T-02 | Nom obligatoire. | Unit + API | R-04 | Validation adaptateur, sans règle de contenu. |
| T-03 | Ligne avec nom, quantité, prix en centimes. | Unit | R-04 | Pas de flottants. |
| T-04 | Bornes quantité/prix et identité. | Unit | R-04 | Valeurs non positives rejetées. |
| T-05 | Fusion des ajouts d’un même menu item. | Unit | — | Valeurs capturées préservées. |
| T-06 | Round-trip des lignes en base. | Integration | R-06 | Aucun champ perdu. |
| T-07 | Confirmation d’une commande non vide. | Unit | — | Transition valide. |
| T-08 | Confirmation vide refusée. | Unit | R-04 | État inchangé. |
| T-09 | Annulation depuis les états permis. | Unit | — | Lignes et contexte préservés. |
| T-10 | Annulation interdite et sans appel Cuisine. | Unit + Integration | — | État terminal inchangé. |
| T-17 | Mapping succès/erreurs des cinq Actions. | API | R-05 | Contrat HTTP explicite. |
| T-18 | Rejet payload invalide avant Action. | API | R-05 | Schémas VineJS distincts. |

**Total P1:** 12 tests/scénarios, ~16–26 heures.

### P2 (Medium)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---|---|---|---|---|
| T-19 | Transformers exposant le read model prévu sans détails internes. | API | R-05 | Ajouter seulement si les transformers sont utilisés par l’endpoint. |

**Total P2:** 1 scénario, ~3–6 heures.

### P3 (Low)

Aucun scénario P3 identifié.

## Execution Strategy

- **PR :** exécuter tous les tests fonctionnels unitaires, intégration et API si la suite reste sous 15 minutes. Philosophie : tout exécuter en PR sauf ce qui est réellement coûteux ou long.
- **Nightly :** répéter les scénarios de concurrence, d’échec/récupération et d’isolation Postgres.
- **Weekly / avant release :** tests de charge k6 et scénarios longue durée après définition des seuils.

## Resource Estimates

| Priority | Count | Effort |
|---|---:|---|
| P0 | 6 | ~12–20 heures |
| P1 | 12 | ~16–26 heures |
| P2 | 1 | ~3–6 heures |
| P3 | 0 | ~0–2 heures |
| **Total** | **19** | **~31–54 heures, ~1–2 semaines** |

### Prerequisites

- Factories pour commande, ligne et états.
- Fake Cuisine avec injection des résultats et comptage des appels.
- Harness Postgres/Kysely avec transactions et nettoyage isolé.
- Mapping explicite des erreurs métier vers HTTP.
- Si des tests API Playwright sont ajoutés : installer `@seontechnologies/playwright-utils` et créer les fixtures fusionnées avant d’écrire les specs.

## Quality Gate Criteria

- P0 pass rate : 100 %.
- P1 pass rate : ≥95 %.
- P2/P3 pass rate : ≥90 % à titre informatif.
- 100 % des mitigations des risques ≥6 terminées ou formellement acceptées.
- Couverture cible ≥80 % et traçabilité complète des critères d’acceptation.
- Aucun test SEC échoué si la sécurité entre dans le périmètre.
- Les décisions NFR finales sont reportées à `nfr-assess` lorsque les preuves d’implémentation existent.

## Mitigation Plans

### R-01: Concurrence et doublon Cuisine (Score: 9)

**Strategy:** rendre la transition atomique, injecter deux appels concurrents, vérifier le nombre d’appels Cuisine et l’état final.  
**Owner:** Backend  
**Timeline:** Story 1.5  
**Status:** Planned  
**Verification:** test d’intégration reproductible avec isolation de base.

### R-02: Transition après échec Cuisine (Score: 6)

**Strategy:** simuler rejet et timeout, vérifier l’absence de transition et la possibilité de retry.  
**Owner:** Backend  
**Timeline:** Story 1.5  
**Status:** Planned  
**Verification:** assertions sur appels Cuisine et état persisté.

### R-03: Échec de persistance après succès Cuisine (Score: 6)

**Strategy:** injecter une erreur d’écriture, relancer l’Action, vérifier l’idempotence et l’absence de doublon.  
**Owner:** Backend  
**Timeline:** Story 1.5  
**Status:** Planned  
**Verification:** test d’intégration avec fake repository ou panne contrôlée.

### R-04: Invariants de commande (Score: 6)

**Strategy:** couvrir nom obligatoire, quantité/prix positifs, lignes et confirmation non vide au niveau domaine.  
**Owner:** Domaine  
**Timeline:** Stories 1.1–1.3  
**Status:** Planned  
**Verification:** tests unitaires des transitions et valeurs limites.

### R-06: Perte de données en persistence (Score: 6)

**Strategy:** persister puis recharger plusieurs commandes/lignes et vérifier chaque champ capturé.  
**Owner:** Persistence  
**Timeline:** Stories 1.1–1.2  
**Status:** Planned  
**Verification:** tests repository et contraintes de migration.

## Assumptions and Dependencies

### Assumptions

1. Le prix est stocké comme entier en centimes et lu via un Value Object.
2. Cuisine reçoit le nom, l’identité et la quantité, mais jamais le prix.
3. Les tests de commande peuvent utiliser un double Cuisine déterministe.
4. La règle story-level — succès Cuisine avant persistance locale `SentToKitchen`, avec retry après échec local — prévaut tant que la formulation d’architecture n’est pas réconciliée.

### Dependencies

1. Décision finale sur l’ordre de persistance de `SendOrderToKitchen` avant Story 1.5.
2. Seuils d’authentification, timeout, latence et concurrence avant les tests NFR correspondants.
3. Infrastructure Postgres de test et factories avant les tests d’intégration.

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|---|---|---|
| Domaine commande | Agrégat, Value Objects, transitions | Tests unitaires des invariants et state machine. |
| Kysely/Postgres | Persistance orders/order_lines et concurrence | Round-trip, contraintes, transactions. |
| Cuisine local contract | Notification de préparation sans prix | Payload, succès, rejet, timeout, idempotence. |
| Adonis Actions | Entrypoints de mutation et mapping Result/HTTP | Validation VineJS et réponses par Action. |
| React/Inertia | Aucun écran requis par l’Epic | Aucun E2E, sauf ajout explicite d’une UI. |

## Appendix A: Knowledge Base References

- `risk-governance.md`
- `probability-impact.md`
- `test-levels-framework.md`
- `test-priorities-matrix.md`
- `nfr-criteria.md`
- `playwright-utils-mandate.md`
- `api-request.md`, `auth-session.md`, `recurse.md`

## Appendix B: Related Documents

- [Epic et stories](/Users/elie/Dev/poc-event-ddd/_bmad-output/planning-artifacts/epics.md)
- [SPEC commande](/Users/elie/Dev/poc-event-ddd/_bmad-output/specs/spec-commande/SPEC.md)
- [Architecture spine](/Users/elie/Dev/poc-event-ddd/_bmad-output/planning-artifacts/architecture/architecture-commande-2026-08-26/ARCHITECTURE-SPINE.md)
- [Architecture application](/Users/elie/Dev/poc-event-ddd/docs/architecture/application.md)

**Generated by:** BMad TEA Agent — `bmad-testarch-test-design`  
**Epic:** Gérer le cycle complet d’une commande
