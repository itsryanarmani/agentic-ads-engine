# CLI option failures

Record these cases before changing the parser. Check them through the executables.

- An attached value starts with `--` and the parser treats it as an option.
- Splitting at every `=` loses part of the copy.
- Empty attached copy passes without a blocked finding.
- Repeated options pass when either occurrence uses `=`.
- A missing value consumes the next option or gives no repair instruction.
- Removed `--dryRun` and `--costClass` aliases become accepted again.
- Attached options change results for normal values or bypass value validation.
- `--format=VALUE` fails to select the format planner.
- Boolean values are ignored instead of checked as `true` or `false`.
- CLI lint results differ from MCP results for the same copy and category.

Run `node test/e2e.mjs` for the check count and JSON evidence.
Run `node test/mutate-cli.mjs` to prove both parser faults fail the checks.
The faults drop attached values and allow repeated attached options.
The script restores the parser and records results in `test/artifacts/cli-mutations.json`.
