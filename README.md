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
The four tools use the same names and arguments as the CLI; `--dry-run` becomes `dryRun`.
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
