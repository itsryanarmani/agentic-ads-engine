# MCP failure cases

Record these cases before changing the E2E test.

- Without the initialize gate, `tools/list` or `tools/call` can succeed before initialization.
  Check both requests for error code `-32002`.
- Without the frame limit, a large frame can reach request validation.
  Send an ASCII frame longer than 65,536 bytes and check for `Frame too large`.
  Send the next request and check its result. A stale buffer or drop state can break recovery.
- Blocked copy can retain findings but lose `isError: true`.
  Check the flag and CLI parity for both `lint` and `plan` results.
- A server exit can leave a request unresolved. Cleanup can miss an earlier close event and hang.
  Keep one close promise from startup. Reject pending requests and clear their timers on failure.
  Report the exit code, signal, last stderr text, and pending method and tool name.
  A forced exit with code 3 must report the pending tool call and fail without a timeout.
- Do not add a check for the removed `dryRun === false` condition.

Run `node test/mutate-mcp.mjs` to inject each fault, restore the server, and save evidence.
Run `node test/e2e.mjs` to save the passing check count.
