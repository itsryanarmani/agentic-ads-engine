# Hook library failure cases

Write these cases before implementation. Verify through executable CLI and MCP flows.

- The catalog has fewer than 40 entries, duplicate IDs, missing fields, or invalid values.
- A hook names a format that does not exist.
- A housing-safe pattern contains unresolved slots or fails housing lint after filling.
- A housing-safe pattern claims eligibility, invents numbers, or presents a testimonial.
- A safety flag changes without review of the pinned expectation file.
- Housing selection returns an unsafe hook, including when emotion also filters results.
- Format and emotion filters use OR instead of AND, or silently accept invalid values.
- A valid filter combination has no matches and returns unrelated hooks.
- CLI and MCP return different lists, picks, details, or input errors.
- Selection ignores scores, loses stable ties, mutates the catalog, or breaks the two-argument API.
- Owner feedback hooks disappear or lose their intended opening beat.
- The mutation runner passes a broken catalog, fails for an unrelated cause, or leaves files changed.

Run node test/e2e.mjs. Save assertion names and counts in test/artifacts/e2e.json.
Run node test/mutate-hooks.mjs. Record three detected faults and the restored pass.
Review every safe pattern for claims beyond the lint's coverage. The lint cannot establish truth.
