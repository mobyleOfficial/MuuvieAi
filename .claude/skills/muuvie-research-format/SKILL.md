---
name: muuvie-research-format
description: Use when documenting research, design decisions, architecture analysis, or API specifications for the Muuvie ecosystem. Applies to all investigation docs, architecture reviews, and technical decisions in research/ folder.
---

# Muuvie Research Format

Standardized format for research documentation across Muuvie ecosystem. Ensures consistency, proper sourcing, and clear decision outcomes.

## Mandatory Structure

Every research doc must follow this structure in order:

### 1. Metadata (YAML block)
```yaml
---
date: 2026-05-14
author: Claude Haiku
status: draft  # draft, approved, archived
related:
  - other-research-doc
tags: [api, backend, architecture]
---
```

**Fields:**
- `date`: ISO 8601 (YYYY-MM-DD)
- `author`: Who researched/wrote this
- `status`: draft | approved | archived
- `related`: Links to related research docs (optional)
- `tags`: Searchable categories (optional)

### 2. Executive Summary (1-2 paragraphs)
- What this doc covers and why it matters
- Key recommendation or outcome
- One-sentence conclusion
- Must be skimmable in 30 seconds

Example: "This research evaluates API versioning strategies for MuuvieBackend. URI path versioning (`/api/v1/`) is recommended: industry-standard, discoverable, minimal frontend changes."

### 3. Problem Statement
- What triggered this research
- Current constraint or pain point
- Scope boundaries
- Why now

### 4. Options Evaluated
For each option, include EXACTLY:
- **Description** — What is this approach
- **Pros** — List with sources
- **Cons** — List with sources
- **Verdict** — Why chosen/rejected (one sentence)

Format:
```markdown
### Option 1: Approach Name
**Description**: Concise explanation.

**Pros**:
- Item 1 [Source: ...]
- Item 2 [Source: ...]

**Cons**:
- Item 1 [Source: ...]
- Item 2 [Source: ...]

**Verdict**: Why chosen/rejected.
```

### 5. Recommended Approach
- Clear statement of choice
- How to implement (concrete steps, code examples, timelines)
- Success criteria
- Known risks or limitations

### 6. Alternative Approaches (if not chosen)
- Why each viable option wasn't selected
- Trade-offs accepted by choosing recommended approach

### 7. Next Steps / Action Items
- Who should do what
- By when
- Dependencies
- Decision gate (if approval needed)

## Sourcing Requirements

**Rule**: Every factual claim must have source.

### What needs a source:
- Technical facts: "PostgreSQL supports X" → [Source: PostgreSQL docs v15]
- Measurements: "Adds 200ms latency" → [Source: benchmark_results.csv]
- Quotes or paraphrases: Always cite
- Standards/RFCs: "RFC 8594" → [Source: RFC 8594 text]
- Code observations: "Uses pattern X" → [Source: backend/file.kt, line 42]

### What doesn't need a source:
- Your analysis/interpretation (mark as "Analysis:")
- Logical deductions from sourced facts
- Decisions: "We chose X" (no source needed)

### Citation format:
```
This is a claim [Source: backend/README.md].
RFC 8594 defines sunset headers [Source: RFC 8594, Section 2].
Observed in current codebase [Source: observed in backend/routes.kt, lines 15-30].
```

**Acceptable sources:**
- Filenames: `[Source: backend/routing.kt]`
- Code lines: `[Source: backend/routing.kt, lines 15-30]`
- URLs: `[Source: https://postgresql.org/docs/]`
- Internal docs: `[Source: CLAUDE.md, Backend section]`
- Specs/RFCs: `[Source: RFC 7748, Section 4]`
- Tests/measurements: `[Source: benchmark_results.csv, row 3]`

## Filename Convention

Two valid layouts depending on document type:

### Ad-hoc research (default)

`research/YYYY-MM-DD-[topic].md`

Examples:
- `research/2026-05-14-api-versioning.md`
- `research/2026-04-20-database-encryption.md`
- `research/2026-03-15-mobile-release-process.md`

**Why date prefix:**
- Sorts chronologically in file system
- Shows age at a glance
- Easy to archive old decisions

### Pipeline-generated documents

When a document is produced by the feature-development pipeline (pm-spec → architect-review → implementer-tester → validator), it lives in a category-specific subdirectory under `research/`:

| Subdirectory | Produced by | Purpose |
|--------------|-------------|---------|
| `research/requests/<feature>.md` | maintainer | Initial feature request |
| `research/specs/<feature>.md` | `pm-spec` agent | Formal specification |
| `research/reviews/<feature>.md` | `architect-review` agent | Architecture review verdict |
| `research/reviews/<feature>-code-review.md` | `validator` agent | Post-implementation code review |
| `research/archive/<feature>.md` | manual | Completed / shelved features |
| `research/features/<slug>/spec.md`, `plan.md` | `ultimate-developer` (and hand-run projects like `feature-map`) | One folder per feature: design spec and implementation plan |
| `research/features/<slug>/research/<topic>.md` | `researcher` agent | One file per researched topic, linked from the plan's `## Research References` |

Filename inside the subdirectory is based on the feature slug (e.g. `<feature>.md` for specs, `<feature>-code-review.md` for code reviews — no date prefix; pipeline stages map to a single feature, so directory + slug already disambiguate). The metadata YAML block at the top still carries the `date` field.

Use the flat `research/YYYY-MM-DD-topic.md` layout for any research that is not a pipeline output.

## Code Examples

- Keep inline if <20 lines
- Use language of the actual system (Kotlin for backend, Dart for frontend)
- Include comments explaining WHY, not what
- Real examples > contrived examples

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Unsourced claims | Add [Source: ...] inline |
| Too much detail | Move to appendix, summarize in main |
| Missing trade-offs | Add explicit "why not other option" |
| No decision | End with clear "Recommendation:" |
| Vague timeline | Use specific dates, not "soon" |
| Wrong filename | Use `research/YYYY-MM-DD-topic.md` for ad-hoc, or `research/<subdir>/<feature>.md` for pipeline outputs |
| No metadata | Add YAML block at top |
| Buried recommendation | Put in Executive Summary or Verdict |
| Citing a Linear issue (`MOO-123`, a linear.app URL) as a source | The workspace is on Linear's free tier and issues get deleted, so the link rots. Inline the context it held, or cite code (`path:line`), PRs or commits instead |

## Quick Checklist

- [ ] Filename: `research/YYYY-MM-DD-[topic].md` (ad-hoc), `research/<subdir>/<feature>.md` (pipeline output) **or** `research/features/<slug>/` (per-feature folder)
- [ ] Metadata block with date, author, status
- [ ] Executive summary (< 2 paragraphs)
- [ ] All factual claims have sources
- [ ] Options section compares 2+ approaches
- [ ] Each option has pros/cons/verdict
- [ ] Recommended approach is clear
- [ ] Next steps are concrete and actionable
- [ ] No unsourced assumptions

## Example Structure (Blank Template)

```markdown
---
date: YYYY-MM-DD
author: [Your name]
status: draft
---

# [Research Title]

## Executive Summary

[1-2 sentences: what this covers, key finding, why it matters]

## Problem Statement

[Why this research was needed]

## Options Evaluated

### Option 1: [Name]
**Description**: [What is this]

**Pros**:
- [Item] [Source: ...]

**Cons**:
- [Item] [Source: ...]

**Verdict**: [Why chosen/rejected]

### Option 2: [Name]
[Same structure]

## Recommended Approach

[Clear statement of choice and why]

## Implementation

[How to actually do this]

## Next Steps

- [ ] Action 1 (by date)
- [ ] Action 2 (by date)
```

## When NOT to Use This

- Quick design notes: Use CLAUDE.md instead
- Decision made without analysis: Just document decision in code comments
- Spike/throwaway research: Not worth formatting formally
- Single-option decision: Still document, but simpler structure
