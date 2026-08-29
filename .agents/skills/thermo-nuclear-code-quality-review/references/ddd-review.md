# DDD Review Reference

Use this reference only when the reviewed change contains business behavior,
domain objects, application use cases, repositories, domain events, or explicit
DDD boundaries.

## Review dimensions

### Ubiquitous language

- Do names match the project's glossary and the language used by domain experts?
- Are technical names, database names, or ambiguous primitives replacing a meaningful business concept?
- Does the diff introduce synonyms for an existing concept or silently change its meaning?

### Bounded contexts and ownership

- Are context boundaries visible in modules and dependencies?
- Does one context import another context's persistence model, internal entity, or implementation detail?
- Is shared code truly stable and generic, or is it a disguised feature-specific dependency?

### Aggregates and invariants

- Is the consistency boundary aligned with the business invariant?
- Can callers mutate child state or bypass the aggregate root?
- Are commands validated where the invariant is owned, rather than only in controllers, forms, or database adapters?
- Does one use case require a distributed aggregate transaction without an explicit consistency strategy?

### Entities and Value Objects

- Are identity, equality, lifecycle, and mutability explicit?
- Do primitives hide validation or domain meaning that should be represented once?
- Are Value Objects immutable and created through a boundary that rejects invalid values?
- Is an abstraction being introduced without a rule or invariant that justifies it?

### Application and domain layers

- Does the application layer orchestrate use cases while the domain layer owns business decisions?
- Are controllers, jobs, queries, or repositories deciding domain policy?
- Does the domain depend on Kysely, Postgres, HTTP, framework events, or transport-specific DTOs?
- Are read models kept separate from command objects when their needs differ?

### Repositories and persistence

- Is the repository interface expressed in domain terms rather than table/query terms?
- Is persistence mapping isolated from domain objects?
- Are transactions and atomic updates owned by the application boundary that coordinates them?
- Are missing records, concurrency conflicts, and uniqueness failures represented explicitly instead of hidden by fallbacks?

### Domain events and workflows

- Is an event a meaningful fact in the domain, or merely a technical callback?
- Are event handlers idempotent and appropriately decoupled from the transaction that raised the event?
- Does the event payload expose an internal persistence shape or an unstable implementation detail?
- Would a direct method call be clearer than introducing an event with no real temporal or ownership boundary?

## Severity guidance

Treat these as presumptive blockers when supported by the diff:

- An invariant can be bypassed through a public model or application path.
- A bounded-context boundary is crossed through persistence or internal implementation details.
- Domain decisions are scattered across controllers, repositories, and UI code.
- The diff introduces a domain abstraction that increases indirection while leaving the real rule implicit.
- A transaction can leave related domain state half-applied without an intentional eventual-consistency design.

Do not block merely because the code does not use a fashionable DDD pattern. The
review must connect the finding to a concrete business rule, boundary, invalid
state, coupling cost, or maintenance consequence.

## Preferred remedies

- Move the rule to the object or boundary that owns the invariant.
- Replace primitive-plus-flag combinations with a small explicit domain type.
- Separate application orchestration from domain decisions.
- Introduce a repository port only when it protects the domain from persistence details.
- Use a transaction or explicit consistency mechanism for related state changes.
- Remove ceremonial DDD layers that add no business meaning or boundary protection.
- Align names and module ownership with `CONTEXT.md` and the application architecture.
