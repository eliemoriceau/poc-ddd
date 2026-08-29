---
name: thermo-nuclear-code-quality-review
description: Run an extremely strict maintainability and architecture review for abstraction quality, giant files, spaghetti-condition growth, and—when relevant—DDD model and boundary integrity.
---

# Thermo-Nuclear Code Quality Review

Perform a deep audit of the current branch's changes. Rethink the structure and
implementation, preserve behavior, and actively search for a "code judo" move:
a restructuring that deletes concepts, branches, indirection, or coupling rather
than merely moving complexity around.

Be direct and demanding. Do not approve code merely because it works. Prefer a
small number of high-conviction, actionable findings over cosmetic nits.

## Review standards

- Treat a file crossing 1,000 lines because of the change as a presumptive design problem. Ask for decomposition unless there is a compelling structural reason.
- Flag ad-hoc conditionals, one-off booleans, nullable modes, special cases, and feature checks scattered through unrelated flows.
- Prefer typed models, explicit contracts, state machines, policies, or dispatchers when they make branching disappear.
- Question unnecessary casts, `any`, `unknown`, optional parameters, generic magic, thin wrappers, and identity abstractions.
- Keep logic in its canonical layer and reuse existing helpers. Flag feature logic leaking into shared paths, infrastructure leaking into the domain, and duplicated utilities.
- Flag avoidable sequential orchestration and related updates that can leave state partially applied when a simpler parallel or atomic structure is evident.
- Distinguish real architectural regressions from stylistic preferences. Findings must explain the trigger, consequence, and concrete remedy.

## DDD review lens

When the change models business behavior or uses DDD terminology, read
[references/ddd-review.md](references/ddd-review.md) and apply that lens.

Do not invent DDD violations for presentation, simple CRUD, or infrastructure
code where the concepts are not relevant. A missing Aggregate, Domain Event, or
Value Object is not automatically a defect; treat it as a finding only when it
obscures a business invariant, damages a boundary, or increases coupling.

For repository-specific vocabulary and boundaries, read `CONTEXT.md` and
`docs/architecture/application.md` when they exist. Read
`docs/design-system` guidance only when the change touches the design system or
extracts UI from an Inertia page.

## Primary questions

- Is there a code-judo restructuring that makes the implementation dramatically simpler?
- Did the change increase the number of concepts a reader must hold in mind?
- Is each responsibility in the right module, package, layer, and ownership boundary?
- Did repeated conditionals reveal a missing domain model, policy, or state model?
- Are types and invariants explicit at the boundary where they matter?
- Does the implementation preserve atomicity and make invalid states difficult to represent?
- Did the change duplicate a canonical helper or create an abstraction that earns no clarity?

## Output expectations

Prioritize findings in this order:

1. Structural regressions and boundary violations
2. Missed opportunities for dramatic simplification
3. Spaghetti and branching growth
4. DDD model, invariant, and language problems when applicable
5. Type-contract and abstraction problems
6. File-size, decomposition, and legibility concerns

Each finding should identify the exact location, the problem, why it matters,
and an actionable structural remedy. Prefer blockers for clear regressions,
unjustified complexity, boundary leaks, or a plausible simplification that would
materially improve maintainability. An empty finding set is valid when the code
meets this bar.
