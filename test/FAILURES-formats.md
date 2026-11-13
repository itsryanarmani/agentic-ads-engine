# Format failure cases recorded before implementation

- The catalog contains fewer than 12 formats or duplicate IDs.
- A descriptor omits its name, description, first-second hook, duration, or aspect ratio.
- A stage or QA gate has an unknown ID; stages repeat or lose their order.
- A format has no QA gates, lessons, policy notes, or source references.
- Provider data omits a stage, verification date, uncertainty flag, or cost basis.
- Estimates invent measured costs, include negative values, or fail to sum to the total.
- Research recommendations appear as successful renders; failed mouth checks disappear.
- Sitcom loses speech framing, door action, reaction shots, or caption timing lessons.
- Lo-fi loses motion, voice pacing, orientation, eye, or black-corner checks.
- Filters ignore cost or risk, accept invalid values, or mutate the catalog.
- Unknown or missing format IDs return a fallback instead of a clear error.
- Missing or invalid site slugs pass; unknown arguments or invalid types pass.
- Planning changes input or later results, spends money, accesses the network, or accepts apply.
- Stage estimates imply provider quotes instead of documented planning assumptions.
- CLI routing breaks template plans or accepts mixed template and format options.
- CLI and MCP disagree for listing, filtering, showing, planning, or rejected formats.
- MCP schemas omit required inputs or allow apply; results exceed the transport capacity.
- Package contents omit either format module or JSON data; imports fail on Node 20 ESM.
- Tests claim success without spawning both executables or writing repeatable evidence.
- Deliberate missing-gate, duplicate-ID, and live-plan mutations pass E2E checks.

Verification uses the public CLI, MCP process, and a library integration child.
No provider runs in this slice. Historical prices and subjective audio quality remain unverified today.
