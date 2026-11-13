# QA failure cases

Write these cases before implementation. Verify them through CLI and MCP processes.

- A format lists an unknown rule or repeats a rule.
- A format drops a pinned rule, including R14.
- A format omits a rule required by its kind.
- A rule ID changes, repeats, or disappears from R1 through R26.
- A rule's title, check, or origin differs from the owner feedback table.
- The table verification misses a row or accepts fewer than 26 rows.
- R19 is missing from any format, or R23 is missing from a caption format.
- A story or character format omits R20 or R26.
- A dialogue format omits R21 or R22.
- R24 or R25 is assigned without an interview format or horror variant.
- The cost ratchet changes when its source stays the same.
- A rule has an empty check, title, origin, severity, or applies list.
- A plan omits a checklist entry or changes its check text.
- A plan claims PASS before a reviewer measures the result.
- A plan omits or changes the six cost ratchet instructions.
- CLI and MCP return different lists or rule details.
- An unknown rule lacks a helpful error or CLI exit code 1.
- The package omits the QA module or rule data.
- A caller changes shared rule data through a returned object.
- Voice instructions claim an automatic pass or failure instead of an owner check.
- Voice instructions omit the small sample or the failed pitch and embedding comparisons.
- SFX instructions omit onset precision, separate stems, excluded laughs, or beat times via `--cuts`.
- The release version differs from 0.3.0 or the MCP server version.

Pin format kinds and complete rule lists in qa-expectations.json.
Inject five separate one-line faults:

- Drop R14.
- Rename R1.
- Empty a check.
- Change check text.
- Soften severity.

Run E2E for each fault and require its expected failure. Restore each file in finally.
Run E2E again after restoration. Save results in test/artifacts/qa-mutations.json.
Real voice fit, video quality, and production costs need separate measured reviews.
