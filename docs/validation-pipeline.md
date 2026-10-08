# Post-build validation pipeline

The Website Intelligence loop now has an explicit validation gate after Cursor Agent execution.

## Order

1. JEV executes the browser validation journey.
2. TypeSafe validates every JEV observation against the strict browser schemas.
3. PixelJury evaluates the resulting page visually.
4. The gate aggregates the results into passed, failed or not_ready.

## Failure rules

- Any JEV observation with failed or blocked status fails validation.
- Invalid JEV observation structure fails TypeSafe validation.
- A critical or high-severity PixelJury finding fails validation.
- Missing external tooling produces not_ready rather than pretending the build passed.

## Important boundary

This gate validates a built change. It does not deploy anything and does not approve a production release.

The intended flow is:

CodingTask → Cursor Agent → validation gate → human review → PR/production

The end-to-end orchestrator will connect these stages later.