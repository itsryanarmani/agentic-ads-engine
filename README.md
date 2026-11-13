# agentic-ads-engine

Offline tools for ad drafts. Node 20 or later. Plain JavaScript ESM with JSDoc, no build step, and zero runtime dependencies.

## Quick start

Run from this checkout:

```sh
node bin/agentic-ads list-templates
node bin/agentic-ads list-hooks
node bin/agentic-ads lint --copy 'Browse available listings'
node bin/agentic-ads plan --site demo --goal discovery --dry-run
node test/e2e.mjs
```

The package is not published by this task. To install the local package:

```sh
npm install /path/to/agentic-ads-engine
npx agentic-ads plan
```

CLI output is JSON. Exit codes: `0` for a result, `1` for invalid input, and `2` for blocked copy.
`lint` requires `--copy`. It accepts `--category housing|none`; the default is `housing`.
`plan` accepts `--site`, `--goal`, `--template`, `--ratio`, `--copy`, and `--category`.
Use `--option=value` for values that start with `--`: `node bin/agentic-ads lint --copy=--Sale--`.
This form preserves `=` inside values. Boolean options accept `=true` or `=false`; plans still require dry-run.
Site names are lowercase slugs. Ratios are `4:5` and `9:16`.

Plans default to dry-run. `--apply` always fails because this slice has no spending or launch implementation.
Plans return required slots and policy findings. They do not render an image.
The five templates cover door reveals, first-person UGC, before/after views, news frames, and help with timing.
Their slots and story beats differ. The HTML stub uses a shared text layout.

## Library

```js
import {
  readScores, writeScores, selectFor, templateProvider, guardCost,
} from 'agentic-ads-engine';

await writeScores('./scores', 'demo', { help: 8 });
const scores = await readScores('./scores', 'demo');
const hook = selectFor({ id: 'demo', scores }, 'discovery');

const preview = templateProvider.run({
  template: 'door-open-teaser',
  ratio: '4:5',
  brand: { name: 'Demo', primary: '#2455cc' },
  slots: {
    headline: 'Take a closer look',
    detail: 'Review the available listing details',
    cta: 'Browse listings',
  },
});
console.log(hook.id, preview.mime); // help text/html
```

`selectFor(site, goal)` is pure. Supply `{ id, scores }`; it never reads the store itself.
Only low-risk hooks qualify. Scores rank matching hooks; catalog order resolves ties.
No match returns `null`. Scores are finite, nonnegative numbers keyed by known hook IDs.
The caller defines the score metric. This slice does not measure performance or establish sample confidence.
CLI and MCP plans use cold-start scores. Load saved scores through the library when selecting hooks.

The file store writes one JSON snapshot per site. Replacement is atomic; callers must use one writer.
A missing file returns `{}`. Invalid files fail. Store directories must be trusted local directories.

Providers implement `capabilities()`, `estimate(input)`, and `run(input)`.
The stub returns escaped HTML, dimensions, a content hash, zero cost, and an explicit warning.
It returns `image: null`. It has no browser, remote asset loading, image generation, or raster conversion.
Brand colors accept six-digit hex values. The brand name is plain text.
Use the template descriptor to find required slots before calling the provider.
Call `lint` on every final slot value before external use. The renderer does not grant policy approval.

`guardCost` accepts `costMinor`, `adSpentMinor`, `monthSpentMinor`, `perAdMinor`, `perMonthMinor`, and `apply`.
All amounts must be nonnegative safe integers in the same currency.
Positive cost requires `apply: true`. Equal-to-cap amounts are allowed; excess amounts are blocked.
The caller supplies totals for the current calendar month, including reserved and uncertain charges.
This pure guard does not persist reservations, handle concurrency, reset monthly totals, or authorize a paid provider.
A future paid adapter must check and reserve costs atomically before calling a provider.

## MCP

Start `node bin/agentic-ads-mcp`, or use the installed `agentic-ads-mcp` executable.
Configure the client to use this command with stdio transport.
The server uses newline-delimited JSON-RPC and protocol version `2024-11-05`.
It supports `initialize`, `ping`, `tools/list`, and `tools/call`.
The original four tools use the same names and arguments as the CLI; `--dry-run` becomes `dryRun`.
Stdout contains protocol messages only. Frames are limited to 65,536 characters.
Tool results contain JSON text. Blocked copy sets `isError: true` and retains its findings.

## Honest limits

Lint detects selected English patterns. It cannot prove truth, consent, disclosure quality, or compliance.
It always returns a human review finding. A `review` status does not mean platform approval.
Housing is the conservative default. Targeting words, guarantees, superlatives, and below-market percentages are blocked.
News framing, staging, and urgency also require review. Conservative checks can produce false positives.
The package does not inspect actual audience settings or implement current platform policy in full.

Keep private data out of inputs. Contact-pattern checks are incomplete; they cannot reliably detect names, addresses, or secrets.
The CLI prints supplied copy in plans. No telemetry, account integration, credentials, or network calls are included.
No source assets or competitor copy are bundled. Research informs the formats and disclosure needs only.

The E2E script spawns both executables and a library integration process.
It records assertions in `test/artifacts/e2e.json`, which Git ignores and npm excludes.
Run `npm run ci:local` before any future push. Publishing and pushing are separate operator actions.

## Video formats

```sh
node bin/agentic-ads formats
node bin/agentic-ads formats --cost-class cheap --risk medium
node bin/agentic-ads formats show sitcom
node bin/agentic-ads plan --format sitcom --site demo
```

Twelve formats cover the eight catalog recipes, lo-fi UGC, sitcom, storytime, and talking objects.
MCP adds `list_formats({costClass?, risk?})`, `get_format({id})`, and `plan_format({format, site, goal?, dryRun?})`.
These tools return the same JSON as the commands above.
The library exports `listFormats`, `getFormat`, and `planFormat` from the package root and `agentic-ads-engine/formats`.
Filters combine with AND. Unknown formats fail. Format plans require a site slug and default to dry-run.
Plans return ordered stages, stage estimates, total estimates, policy notes, QA gates, and zero actual spend.
Apply remains unavailable. QA gates describe required checks; this planner does not run them.

Source paths refer to the supplied `directory/ads-research` archive, reviewed on 2026-11-12.
Provider `verified` records that source review date. It does not promise current prices or successful renders.
`unverified: true` marks proposed routes or unresolved quality. Local routes can name tools instead of models.
Costs exclude labour and compute. Stage notes state asset counts and reuse assumptions.
The sitcom run cost $2.466; four mouth checks still failed. Its selected speech model preserves that limitation.
Lo-fi costs reference reused assets: $0.881 for three videos6 ads and $0.165 for three videos5 voice edits.
Fresh generation estimates differ. The style catalog did not render its recommended local recipes.
No paid calls, current price checks, media QA, or platform approval occur here.

Run `node test/mutate-formats.mjs` to repeat the three deliberate faults and restore the files.
It records failures and the restored pass in `test/artifacts/formats-mutations.json`.

### Owner feedback checks

`agentic-ads qa-rules` lists R1 through R26. Use `agentic-ads qa-rules show R5`
to read one rule. MCP provides `list_qa_rules` and `get_qa_rule` with an `id` argument.

Each format declares `kinds` and `feedbackRules`. A format plan includes
`reviewChecklist` entries and the six instructions in `costRatchet`.
Every entry starts as `NOT CHECKED`. This status blocks shipping.
A reviewer must record PASS or FAIL with a measured value. Voice and sound fit need the owner's ear.

The JavaScript API exports `listRules()`, `getRule(id)`, and `checklistFor(format)`.
Pass a format descriptor from `getFormat(id)` to `checklistFor`.
Rules use `blocking` severity. `applies` names format kinds; `all` covers every format.
Story formats include stickman, POV, before-after, lo-fi, sitcom, and storytime.
Sitcom has dialogue. Talking-object has visible speech. All current formats have captions.

Run `node test/mutate-qa.mjs` to verify three deliberate faults and restore the files.
Results go to `test/artifacts/qa-mutations.json` and `test/artifacts/e2e.json`.
