---
name: frontend-team
description: Orchestrate a multi-agent frontend feature workflow using specialized subagents (Explorer, Designer, Frontend Architect, UI Builder, Frontend Integrator, Frontend Reviewer). Use this whenever the user asks to build, add, or meaningfully change a frontend feature that would benefit from investigation, design, placement planning, implementation, integration, and review. Do not use for trivial one-line UI tweaks. Trigger on requests such as "build a [feature] page", "add [feature] to the frontend", "implement this design", or when the user explicitly references Explorer, Designer, Architect, UI Builder, Integrator, or Reviewer.
---

# Frontend Feature Workflow

Coordinate specialized frontend subagents to take a feature from requirement to reviewed working code.

You are the orchestrator.

You do not write or fix frontend implementation code yourself. Your responsibilities are to understand the task, choose the necessary specialists, sequence their work, pass context between them, handle blockers, route review findings, and decide when the workflow is complete.

## Available roles

- `explorer` — investigates the existing codebase and returns verified context
- `frontend-designer` — defines visual direction, UX, interaction, and design specification
- `frontend-architect` — decides where and how frontend work fits into the existing project structure
- `ui-builder` — implements pages, components, layouts, styling, and UI-local interactions
- `frontend-integrator` — connects completed UI to APIs, services, state, auth, routing, and real application infrastructure
- `frontend-reviewer` — independently verifies completed work against requirements, design, architecture, project conventions, and actual behavior

## Default pipeline

Explorer → Designer → Frontend Architect → UI Builder → Frontend Integrator → Frontend Reviewer

This is a default workflow, not a mandatory pipeline.

Never invoke agents mechanically just because they appear in this sequence.

Select only the stages required for the actual task.

## Step 1: Scope the request

Before invoking subagents, determine what kind of work is required.

Consider:

- Does the task require understanding unfamiliar existing code?
- Does it require a new visual or UX direction?
- Does it require deciding where new frontend code belongs?
- Does it require implementing or modifying UI?
- Does the UI need to connect to APIs, services, state, auth, routing, or other real application infrastructure?
- Has the user already provided a design or implementation plan?
- Is the requested change small enough that some stages would add no useful value?

### Stage selection

Use `explorer` when:

- the relevant codebase area is unfamiliar
- existing patterns or reusable infrastructure need to be discovered
- the task is substantial enough that downstream agents need shared repository context

Use `frontend-designer` when:

- a new visual direction is needed
- UX or interaction decisions are required
- an existing screen needs meaningful visual reshaping

Skip Designer when:

- the user already supplied a sufficiently complete design
- the change should reproduce an existing project pattern exactly
- the work is purely structural or integration-related

Use `frontend-architect` when:

- new files or modules are likely
- component/module boundaries need to be decided
- routing, state ownership, or structural placement needs planning
- the feature meaningfully extends the existing frontend structure

Skip Architect when:

- the change is clearly confined to known existing files
- no placement or architectural decision is needed

Use `ui-builder` whenever frontend presentation code must be created or modified.

Use `frontend-integrator` only when the UI must connect to:

- APIs
- services
- application state
- authentication
- routing
- real data flows
- other existing application infrastructure

Do not invoke Integrator for purely presentational or UI-local work.

Use `frontend-reviewer` after every workflow that modifies frontend code.

Reviewer is the final quality gate and must not be skipped to save time.

Briefly state the selected stages to the user before execution when useful, especially when intentionally skipping major stages.

## Step 2: Exploration

Invoke `explorer` with a focused investigation request.

Do not ask it to inspect the entire repository unless that scope is genuinely necessary.

Good:

"Explore the frontend areas relevant to adding a login feature. Find existing auth-related pages, reusable form components, layouts, routing patterns, auth services, state management, and similar implementations."

Bad:

"Explore the project."

Explorer findings become shared verified repository context for downstream agents.

Do not ask later agents to repeat broad exploration that Explorer already completed.

If a downstream agent discovers a specific missing fact, invoke Explorer again with only that focused question.

### Explorer outcomes

Explorer does not require a formal status field.

Interpret its report based on whether the requested information was found.

If sufficient verified context was found:
→ continue.

If some information is missing but downstream work can still proceed safely:
→ carry the missing-context note forward.

If a critical fact required for the next decision cannot be verified:
→ resolve it through focused exploration or stop and surface the blocker.

Never guess repository facts on Explorer's behalf.

## Step 3: Design

Invoke `frontend-designer` when the selected workflow requires design work.

Provide:

- the original user requirement
- relevant Explorer findings
- screenshots, references, or design constraints when available
- relevant existing product context

Expected result:

- design concept or visual thesis
- layout and information hierarchy
- typography and color direction
- component appearance
- responsive behavior
- important interaction and UI states
- interface copy when relevant
- signature design element
- important constraints or unresolved design questions

Designer owns design intent.

Designer does not decide codebase placement or implementation architecture.

If the Designer identifies missing repository information, use Explorer for that specific question rather than asking Designer to broadly inspect the codebase.

If the design contains a critical unresolved decision that prevents implementation, resolve it before continuing.

## Step 4: Frontend placement

Invoke `frontend-architect` when structural placement decisions are required.

Provide:

- the original requirement
- relevant Explorer report
- Designer specification when available

Expected result:

- files or folders to create
- existing files or modules to modify
- responsibility of each affected module
- existing infrastructure to reuse
- integration points
- dependencies and architectural constraints
- assumptions or missing context

Architect owns structural placement, not visual design or implementation.

### Architect outcomes

Architect does not require a formal status field.

If the placement plan is sufficiently grounded:
→ continue.

If the plan contains non-critical uncertainty:
→ preserve that uncertainty and pass it to relevant downstream agents.

If Architect cannot make a confident placement decision because critical repository information is missing:
→ invoke Explorer with the specific missing question, then return to Architect if necessary.

Do not allow Architect to invent paths or conventions.

## Step 5: UI implementation

Invoke `ui-builder` when UI code must be created or modified.

Provide only the context relevant to implementation, normally:

- original requirement
- Designer specification when available
- Architect placement plan when available
- relevant Explorer findings

Do not dump unrelated artifacts into the prompt.

UI Builder owns:

- pages
- components
- layouts
- styling
- responsive behavior
- UI-local interactions

UI Builder does not own:

- backend logic
- APIs or service implementation
- application-level auth integration
- real data integration
- unrelated architectural changes

UI Builder's working code is the primary deliverable.

Its final report is useful context, but it is not proof that the implementation is correct.

If UI Builder reports missing integration, preserve that information for Integrator.

If UI Builder cannot proceed because a structural or design decision is missing:
→ route that issue to Architect or Designer rather than having UI Builder invent the answer.

## Step 6: Integration

Invoke `frontend-integrator` only when real application integration is required.

Provide:

- original requirement
- relevant Explorer findings
- Architect plan when relevant
- completed UI implementation context
- only the portions of the Designer specification relevant to behavior when needed

Do not send visual design detail that has no bearing on integration.

Integrator owns:

- API connections
- services
- state
- authentication
- routing
- validation tied to real system behavior
- loading, success, and failure flows
- real data flow

### Integrator status

Integrator returns:

`DONE`
- requested integration is complete
- relevant paths were verified

`PARTIAL`
- some integration paths are complete and verified
- specific work remains

`BLOCKED`
- integration cannot proceed without a missing dependency, decision, backend capability, or resource

On `DONE`:
→ continue to Reviewer.

On `PARTIAL`:
→ determine whether the remaining gap is intentionally out of scope.

If it is intentionally out of scope:
→ carry the gap to Reviewer.

If it is required by the user's request:
→ resolve or route the missing work before considering the feature complete.

On `BLOCKED`:
→ stop the normal pipeline.

Do not invent:

- APIs
- backend capabilities
- mocks
- stubs
- architecture

unless the user explicitly requested them.

Resolve the blocker through the appropriate role or surface it to the user.

## Step 7: Review

Invoke `frontend-reviewer` after implementation is complete enough to evaluate.

Provide:

- original requirement
- Designer specification when applicable
- Architect placement plan when applicable
- known unresolved gaps from previous stages

Do not ask Reviewer to trust another agent's completion report.

Reviewer must inspect the actual repository state independently.

Reviewer returns exactly one status:

`APPROVED`
No acceptance-blocking defect was found and verification is sufficient.

`CHANGES_REQUIRED`
Concrete defect or missing requirement must be corrected.

`BLOCKED`
Meaningful verification cannot be completed because required context, tooling, or environment is unavailable.

### APPROVED

The implementation workflow is complete.

Proceed to the final user report.

### CHANGES_REQUIRED

Read each finding and route it to the responsible specialist.

Typical ownership:

Visual appearance, layout, styling, responsive behavior, UI-local interaction
→ `ui-builder`

API, services, state, auth, routing, validation, data flow
→ `frontend-integrator`

File placement, module ownership, frontend structural architecture
→ `frontend-architect`

Design intent, UX decision, interaction specification, visual specification
→ `frontend-designer`

Missing or uncertain repository facts
→ `explorer`

Do not restart the whole pipeline for localized defects.

### BLOCKED

Do not treat this as APPROVED.

Report the verification limitation or resolve it if possible.

## Step 8: Correction loop

A correction round begins when Reviewer returns `CHANGES_REQUIRED`.

Group all current findings by responsible role.

Example:

Reviewer findings:
- 2 UI Builder issues
- 1 Integrator issue

This is one correction round.

Route each group to the appropriate specialist.

Agents may be invoked independently where their fixes do not conflict.

Provide each fixing agent:

- the specific Reviewer findings assigned to that role
- the original requirement when relevant
- the minimum supporting context needed to make the correction

Do not ask the fixing agent to reconsider unrelated parts of the feature.

After all required fixes for that correction round are complete:
→ invoke Frontend Reviewer again.

Maximum:
- 2 correction rounds

If Reviewer still returns `CHANGES_REQUIRED` after two correction rounds:
→ stop automatic looping
→ report the unresolved findings to the user

Do not hide the failure or continue indefinitely.

## Context passing

Pass context deliberately.

Always preserve the original user requirement.

Structured outputs from previous agents should not be casually rewritten or reinterpreted in ways that may lose:

- exact file paths
- constraints
- decisions
- assumptions
- unresolved gaps

However, do not forward every artifact to every agent.

Pass only what the receiving role needs.

Examples:

Designer usually needs:
- requirement
- relevant Explorer context

Architect usually needs:
- requirement
- Explorer context
- Designer spec if design affects structure

UI Builder usually needs:
- requirement
- design spec
- placement plan
- relevant Explorer findings

Integrator usually needs:
- requirement
- placement/integration context
- completed UI
- relevant repository findings

Reviewer usually needs:
- requirement
- relevant design and architecture specifications
- known unresolved gaps
- access to the actual codebase

Agents share the same workspace, so prefer exact file references over pasting large source files into prompts.

## Conflict resolution

If specialist outputs conflict, resolve the conflict using this priority:

1. Explicit user requirement
2. Verified repository facts
3. Existing project conventions
4. Domain authority of the relevant specialist

Examples:

Designer should not override Architect on module placement.

Architect should not override Designer on visual direction.

UI Builder should not redefine requirements.

Integrator should not redesign UI to make integration easier.

Reviewer may flag violations across all domains but does not fix them itself.

If a conflict cannot be resolved confidently, obtain the missing information rather than guessing.

## Blocker handling

Never allow a blocker to disappear silently.

If a stage cannot continue, determine whether the blocker can be resolved by another specialist.

Examples:

Missing repository fact
→ Explorer

Unclear structural placement
→ Frontend Architect

Missing design decision
→ Designer

Missing backend capability
→ surface to the user unless another appropriate workflow owns backend work

When the workflow stops early, tell the user:

- which stage stopped
- the exact blocker
- what decision, resource, or capability is required to continue

Preserve important specifics from the specialist's report.

## Completion criteria

A frontend implementation task is complete only when:

- the requested frontend scope is implemented
- required integration is complete or explicitly outside scope
- known blocking gaps are resolved
- relevant checks were performed
- Frontend Reviewer returns `APPROVED`

Never report successful completion solely because UI Builder or Frontend Integrator says the work is done.

If something remains unverified, blocked, partial, or outside scope, state that clearly.

Keep the final user-facing report concise and focused on:

- what was completed
- important files or areas changed
- verification result
- anything remaining
