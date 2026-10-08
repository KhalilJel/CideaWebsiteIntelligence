# Human review layer

Human review is the release boundary for Website Intelligence.

## Allowed decisions

- approve: the change is accepted for the next controlled step.
- reject: the proposed change is not accepted.
- iterate: the task must return to implementation with explicit feedback.

Approval is blocked unless the post-build validation pipeline has status passed.

## Safety

The review layer does not deploy production. It only records the human decision and determines the next state.

Cursor Agent therefore cannot create an autonomous production release through this layer.

## Intended loop

Cursor Agent → validation → human review

approve → continue

reject → stop

iterate → new CodingTask/implementation cycle