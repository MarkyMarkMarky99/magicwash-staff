# Implementation

**Status:** Done

## Test Plan

- Write failing unit tests for `filter / where`
- Implement filter behavior to green
- Write failing unit tests for `sort / orderBy`
- Implement sort behavior to green
- Write failing unit tests for `pagination`
- Implement pagination behavior to green
- Write failing unit tests for `state / reset`
- Implement reset/state behavior to green
- Update service tests for integration with `QueryBuilder`

## Implementation Notes

- Added `QueryBuilder` with fluent methods and `reset()`
- Updated customer service to build repository queries through `QueryBuilder`
- Kept repository query shape unchanged
- Did not add new API filters

## Deviations From Approved Plan

- None.

## Verification

- `npm run typecheck` passed
- `npm test -- query-builder` passed
- customer service tests passed
