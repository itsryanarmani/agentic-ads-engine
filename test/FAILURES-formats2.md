# Issue 33: failure cases before implementation

Verify through CLI processes, MCP requests, and the existing HTTP E2E flow.
Do not add isolated unit tests.

- The catalog omits a new ID or contains duplicate IDs. Require exactly 15 formats.
- CLI show or plan rejects a new ID. Compare each result with its catalog descriptor.
- MCP list, get, or plan differs from the CLI. Check all three new IDs.
- Speech with captions lacks an audio gate. Require all four gates for each matching format.
- A format names an unknown gate. Check each name against an explicit known list.
- A hook names a missing format. Check every hook reference against the catalog.
- Street interviews omit the mic, fixed screen sides, or the 2010s phone look.
- Backrooms omit yellow corridors, two speakers, an era, or the scare variant rules.
- Horror comedy omits the door movement, sting, reaction, joke, or R25.
- New formats omit R21, R22, or R24 where required. Pin rule mappings and kinds.
- Costs confuse reused assets with fresh production. Pin logged totals and stage sums.
- Lessons claim unresolved lip sync, voice drift, or mic visibility passed review.
- Housing notes omit synthetic adults, disclosures, or bans on invented claims and numbers.
- Gate descriptions omit thresholds, final-file checks, owner review, or separate audio stems.
- Mutations survive: remove loudness_master, remove horror-comic R25, or add an unknown gate.

Run `node test/e2e.mjs` and `node test/mutate-formats.mjs`.
Keep repeatable results in `test/artifacts/e2e.json` and `test/artifacts/formats-mutations.json`.
Report actual counts and checks that could not run. Do not claim rendered media passed QA.
