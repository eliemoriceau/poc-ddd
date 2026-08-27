---
runScope: 'epic-level'
runKey: 'epic-1'
workflowStatus: 'in-progress'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
workflowStatus: 'completed'
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-08-27'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/specs/spec-commande/SPEC.md'
  - '_bmad-output/specs/spec-commande/state-machines.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-commande-2026-08-26/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-commande-2026-08-26/architecture-commande-2026-08-26-explainer.md'
  - 'CONTEXT.md'
  - 'docs/architecture/application.md'
  - 'docs/research/adonis-transformers-inertia-generated-types.md'
  - 'apps/web/AGENTS.md'
  - 'apps/web/package.json'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/risk-governance.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/probability-impact.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/test-levels-framework.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/test-priorities-matrix.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/nfr-criteria.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/playwright-utils-mandate.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/overview.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/api-request.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/auth-session.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/recurse.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/playwright-cli.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/pact-mcp.md'
  - 'apps/web/tests/unit/commands/create_user.spec.ts'
  - 'apps/web/tests/unit/identity/email_address.spec.ts'
  - 'apps/web/tests/unit/identity/register_user.spec.ts'
  - 'apps/web/tests/unit/identity/user.spec.ts'
---

# Test Design Progress — Epic 1

## Scope

Epic-level test design for Epic 1, `Gérer le cycle complet d’une commande`, covering its six approved stories and FR1–FR10.

## Mode Decision

Epic-Level Mode selected because the approved epic and stories with acceptance criteria are available, together with architecture context. No complete PRD requires a system-level test design for this run.

## Prerequisites

- Epic and stories: `_bmad-output/planning-artifacts/epics.md`
- Functional specification: `_bmad-output/specs/spec-commande/SPEC.md`
- State machine: `_bmad-output/specs/spec-commande/state-machines.md`
- Architecture spine and explainer: `_bmad-output/planning-artifacts/architecture/architecture-commande-2026-08-26/`
- Application architecture and Adonis/Inertia research notes under `docs/`

## Context Load — Step 2

- Stack: AdonisJS backend, React/Inertia frontend, TypeScript, Japa unit tests, Playwright dependency present.
- Testing mode: API-first for the command use cases; no existing Playwright E2E/API suite was found.
- Existing coverage: identity/user unit tests only; no command, integration, E2E, Pact, or contract artifacts exist yet.
- Planned test-level direction: unit tests for domain invariants and state transitions; integration tests for Kysely/Postgres repositories and Cuisine boundary; API tests for Adonis action mappings; a small E2E smoke path only if a command UI is introduced.
- Playwright Utils: the project config enables the mandate, but `@seontechnologies/playwright-utils` is not currently a dependency. If Playwright API tests are added, the dependency and merged fixtures must be introduced first; no silent vanilla fallback.
- Browser exploration: skipped because no running application URL or existing command UI was available, and `playwright-cli` is not installed.
- Pact: no Pact package, broker artifacts, or provider contract files found. Do not add Pact to this epic; test the local Cuisine contract at the integration boundary unless a contract-testing requirement appears.
- NFR focus: data integrity, transactional/concurrency behavior, failure recovery around Cuisine, and maintainability of Action-to-HTTP mappings.
- Open clarification carried into risk analysis: architecture notes contain a persistence-order tension for `SendOrderToKitchen`; tests should enforce the approved story behavior (Cuisine success before local `SentToKitchen` persistence, retry after local persistence failure) until the architecture wording is reconciled.

## Testability Review — Step 3

### 🚨 Testability Concerns

1. **Cuisine failure injection is required — ACTIONABLE ASR.** The local Cuisine contract must be replaceable by a fake/double so tests can simulate success, timeout, failure, and repeated calls without a real kitchen system.
2. **Persistence-order behavior needs one authoritative rule — ACTIONABLE ASR.** The architecture wording conflicts on whether the aggregate is persisted before or after Cuisine succeeds. Keep the story rule as the executable expectation and reconcile the architecture before implementation.
3. **Concurrency control must be observable — ACTIONABLE ASR.** Repository tests need a deterministic way to create two competing `SendOrderToKitchen` attempts and assert one valid transition, no duplicate kitchen notification, and no invalid state.
4. **Action error mapping needs explicit response contracts — ACTIONABLE ASR.** The five Adonis entrypoints require stable Result-to-HTTP mappings; without declared error codes/statuses, API assertions would be guesswork.
5. **No command test harness exists — FYI.** The project has Japa unit tests but no command factories, repository fakes, integration database setup, API test setup, or Playwright merged fixtures.

### ✅ Testability Assessment Summary

- Domain rules are testable in isolation: order creation, mandatory name, line merge, positive quantity/price, confirmation, cancellation, and state transitions.
- The integer-cent price value object allows deterministic boundary and serialization tests without floating-point behavior.
- Kysely repository boundaries and explicit Actions provide clear seams for integration and unit tests.
- Cuisine receives a reduced local contract without prices, which can be asserted directly at the adapter boundary.
- Transaction and idempotence requirements identify concrete integration scenarios rather than relying on UI-only tests.

## Risk Assessment Matrix — Step 3

| ID | Category | Risk | P | I | Score | Action | Mitigation / owner / timeline |
|---|---|---|---:|---:|---:|---|---|
| R-01 | DATA | Concurrent send can duplicate Cuisine notification or corrupt order state. | 3 | 3 | 9 | BLOCK | Add repository/concurrency integration tests and enforce atomic transition; owner: backend; before Story 1.5 implementation. |
| R-02 | BUS | Order can become `SentToKitchen` when Cuisine rejected or timed out. | 2 | 3 | 6 | MITIGATE | Fake Cuisine outcomes plus Action tests asserting no local transition on failure; owner: backend; Story 1.5. |
| R-03 | DATA | Local persistence failure after Cuisine success can cause an inconsistent retry path. | 2 | 3 | 6 | MITIGATE | Simulate write failure, assert retry is possible and idempotence is preserved; owner: backend; Story 1.5. |
| R-04 | BUS | Invalid line data or empty confirmation violates order invariants. | 2 | 3 | 6 | MITIGATE | Unit tests for quantity/price/name boundaries, line merge, and confirmation precondition; owner: domain; Stories 1.1–1.3. |
| R-05 | TECH | Action-to-HTTP mappings diverge between five entrypoints. | 2 | 2 | 4 | MONITOR | Define error-code/status mapping table and API tests per Action; owner: application; Story 1.6. |
| R-06 | TECH | Persistence model loses captured unit price or line identity. | 2 | 3 | 6 | MITIGATE | Repository round-trip tests and migration constraints; owner: persistence; Stories 1.1–1.2. |
| R-07 | SEC | Unauthenticated or incorrectly authorized mutation endpoints expose order operations. | 1 | 3 | 3 | DOCUMENT | Confirm auth policy when routes are defined; add negative API tests if authentication is in scope. |
| R-08 | PERF | Database contention or slow Cuisine call makes send unreliable. | 2 | 2 | 4 | MONITOR | Capture timing and failure evidence; define latency/timeout thresholds before performance validation. |

## NFR Planning Assessment — Step 3

| NFR category | Evidence / threshold found | Status | Planned evidence |
|---|---|---|---|
| Security | No command-specific authentication or authorization threshold in loaded artifacts. | UNKNOWN | Route/API negative tests and review of Adonis middleware once policy is defined. |
| Performance | No latency, throughput, or Cuisine timeout threshold specified. | UNKNOWN | Integration timing, contention test, and later load test only after thresholds are agreed. |
| Reliability | Retry, idempotence, atomicity, and failure recovery are specified functionally. | PARTIAL | Japa integration tests with injected failures; logs/trace evidence for retries and final state. |
| Scalability | No expected order volume or concurrency target specified. | UNKNOWN | Clarification item; later load/concurrency evidence. |
| Maintainability | Explicit Actions, repositories, Result mapping, and no required Inertia page are specified. | PARTIAL | Typecheck, lint, unit/integration/API coverage, and review of mapping duplication. |
| Compliance | No specific compliance requirement found. | NOT IN SCOPE | Reassess if payment/customer data requirements are introduced. |

### Highest-risk summary

R-01 is a score-9 blocker because duplicate kitchen notifications and corrupted state are data/business failures under concurrency. R-02, R-03, R-04, and R-06 require mitigation before release. The main testability prerequisites are a fakeable Cuisine boundary, deterministic repository failure injection, and a single persistence-order decision.

## Coverage Plan — Step 4

### Functional coverage matrix

| ID | Scenario | Requirement / risk | Level | Priority |
|---|---|---|---|---|
| T-01 | Creates an order with identity, name, initial state, and timestamps. | FR1, FR2 | Unit | P1 |
| T-02 | Rejects a missing/empty name at the Action boundary. | FR2, R-04 | Unit + API mapping | P1 |
| T-03 | Adds a line with captured name, quantity, and integer-cent unit price. | FR3, R-06 | Unit | P1 |
| T-04 | Rejects non-positive quantity or price and invalid line identity. | FR3, R-04 | Unit | P1 |
| T-05 | Merges repeated additions of the same menu item without losing captured values. | FR4 | Unit | P1 |
| T-06 | Persists and reloads order lines without losing name, quantity, or price cents. | FR3–FR4, R-06 | Integration | P1 |
| T-07 | Confirms an order containing at least one line. | FR5 | Unit | P1 |
| T-08 | Rejects confirmation of an order with no lines and leaves state unchanged. | FR5, R-04 | Unit | P1 |
| T-09 | Cancels an order from each allowed state and preserves lines/table/service data. | FR6 | Unit | P1 |
| T-10 | Rejects cancellation from terminal/forbidden states and performs no Cuisine call. | FR6 | Unit + integration | P1 |
| T-11 | Sends a confirmed order to Cuisine with item identity/name/quantity and no price. | FR7, FR8 | Integration | P0 |
| T-12 | Does not send an unconfirmed, empty, cancelled, or already-sent order. | FR7, R-02 | Unit + integration | P0 |
| T-13 | On Cuisine success, persists `SentToKitchen` exactly once. | FR7, R-01 | Integration | P0 |
| T-14 | On Cuisine rejection/timeout, keeps the order confirmed and exposes a retryable failure. | FR8, R-02 | Integration | P0 |
| T-15 | On local persistence failure after Cuisine success, permits safe retry without duplicate notification. | FR9, R-03 | Integration | P0 |
| T-16 | Two concurrent send attempts yield one valid transition and no duplicate Cuisine notification. | FR9, R-01 | Integration | P0 |
| T-17 | Each of the five Actions maps success and expected domain failures to its declared HTTP response. | FR10, R-05 | API | P1 |
| T-18 | API validation rejects malformed payloads before invoking the Action. | FR10 | API | P1 |
| T-19 | Response transformers expose only the intended read model and do not leak internal/domain details. | FR10 | API | P2 |

No E2E scenario is required for this epic because no command UI is specified. If one is added, create one P1 smoke journey covering create → add line → confirm, while retaining domain/API tests as the source of business coverage.

### NFR coverage and evidence

| Category | Planned validation | Tool / level | Evidence for later `nfr-assess` |
|---|---|---|---|
| Security | Auth policy and unauthenticated mutation behavior once defined. | API | Japa/Playwright API results and route middleware configuration. |
| Performance | Concurrency and repository timing; load only after thresholds are defined. | Integration, later k6 if needed | Timing report and contention results. |
| Reliability | Cuisine failure, timeout, local write failure, retry, idempotence. | Integration | Test report, structured logs, trace of final states. |
| Scalability | No target currently specified. | Clarification | Approved concurrency/volume thresholds, then load results. |
| Maintainability | Action mapping consistency, typecheck/lint, unit and integration coverage. | CI + tests | CI reports and coverage output; no `@seontechnologies/playwright-utils` until dependency/setup exists. |
| Compliance | No requirement identified. | None | Reassess on scope change. |

### Execution strategy

- **PR:** all unit tests, repository/Cuisine integration tests, and API mapping tests; target under 15 minutes.
- **Nightly:** repeated concurrency/failure-recovery scenarios and database-backed isolation checks.
- **Weekly or before release:** load/performance validation once thresholds exist; broader mutation/auth regression.

### Resource estimates

- P0: ~12–20 hours
- P1: ~16–26 hours
- P2: ~3–6 hours
- P3: ~0–2 hours
- Total: ~31–54 hours, approximately 1–2 weeks depending on test infrastructure and database setup.

### Quality gates

- P0 pass rate: 100%.
- P1 pass rate: at least 95%.
- R-01 blocker and all score 6–8 mitigations closed before release.
- Functional test coverage target: at least 80%, with explicit traceability to every acceptance criterion.
- Evidence source identified for every in-scope NFR; missing thresholds remain release concerns until clarified.
- Final NFR PASS/CONCERNS/FAIL is deferred to `nfr-assess` after implementation evidence exists.

## Final Output — Step 5

- Mode: epic-level, sequential single-worker generation.
- Output: `_bmad-output/test-artifacts/test-design-epic-1.md`.
- Validation: risk matrix, NFR plan, 19 atomic scenarios, execution strategy, estimates, gates, dependencies, and regression scope included. `git diff --check` to be run after generation.
- Open assumptions: persistence-order decision for `SendOrderToKitchen`; security, performance, scalability, and timeout thresholds remain UNKNOWN.
