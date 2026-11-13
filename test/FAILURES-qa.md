# QA failure cases

Write these cases before implementation. Verify them through CLI and MCP processes.

- A format lists an unknown rule or repeats a rule.
- A format drops a pinned rule, including R14.
- A format omits a rule required by its kind.
- A rule ID changes, repeats, or disappears from R1 through R18.
- A rule has an empty check, title, origin, severity, or applies list.
- A plan omits a checklist entry or changes its check text.
- A plan claims PASS before a reviewer measures the result.
- A plan omits or changes the six cost ratchet instructions.
- CLI and MCP return different lists or rule details.
- An unknown rule lacks a helpful error or CLI exit code 1.
- The package omits the QA module or rule data.
- A caller changes shared rule data through a returned object.

Pin format kinds and complete rule lists in qa-expectations.json.
Inject three separate one-line faults: drop R14, rename R1, and empty R1's check.
Run E2E for each fault and require its expected failure. Restore each file in finally.
Run E2E again after restoration. Save results in test/artifacts/qa-mutations.json.
Real voice fit, video quality, and production costs need separate measured reviews.
