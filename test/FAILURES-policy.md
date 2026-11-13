# Policy lint failure cases

Written before implementation for issue #10. Verify through `node test/e2e.mjs`.

- Age rules can miss “aged 25-40” and “Age range 25-40”.
- They can miss “Adults age 25 thru 40” and “Ages twenty-five to forty”.
- They can miss “Must be under 40”.
- ZIP rules can miss “postcodes only” and “Only in zip 78701”.
- They can miss “Available to zip code 78701 residents only”.
- Area restrictions can lose their existing targeting findings.
- Amenity ages can produce false targeting findings, even when the status remains review.
- An amenity exception can hide a separate occupant restriction in the same sentence.
- Plain ZIP addresses and area descriptions can become false targeting findings.
- Existing corpus cases can regress when patterns change.
- One timing sample can fail because another process delays it.
- Checks can pass without detecting broken age or ZIP patterns.

## Label meaning

The `finding_required` label requires a targeting finding at either severity.
It does not require the output status `review`. The `blocked` label also requires a blocked status.
Honest copy must remain unblocked and contain no `targeting_*` finding.

These labels record conservative lint expectations. They do not establish legal eligibility.
Older-persons housing, including “55 plus community”, stays blocked pending human review of any applicable exception.
Shared-room sex preferences stay blocked because the copy does not establish an applicable exception.
Citizenship restrictions stay blocked because the copy does not establish a lawful basis for the restriction.
“Tenants over 18 must each submit an application” describes an application process, so it remains in the honest set.
Children’s play-area age ranges describe amenities. They must not produce targeting findings.

## Repeatable evidence

Run `node test/prove-policy-mutations.mjs` from the repository root.
It changes one age-pattern line, runs E2E, and requires failure on “aged 25-40”.
It restores the source, changes one ZIP-pattern line, and requires failure on “postcodes only”.
It restores the source again and requires the complete E2E suite to pass.
Logs and exact line changes appear in `test/artifacts/policy-mutations.json` and the adjacent mutation logs.
The final suite writes `test/artifacts/e2e.json`. These generated files stay outside version control.

All 86 original honest cases and 78 original flagged cases remain.
The expanded corpus has 95 honest cases and 95 flagged cases.
The timing check uses the fastest of three CLI runs, with a 500 ms limit.
This includes process startup. It does not prove speed on every host.
Node 20 runtime behavior and platform policy approval remain unverified.
