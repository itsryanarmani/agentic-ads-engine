# Failure cases recorded before implementation

- Package installation omits source, hook JSON, license, or executable files.
- CLI bins fail through npm links or use syntax unsupported by Node 20.
- Runtime imports require dependencies or a build step.
- Catalog lacks one of five templates, slots, brand inputs, or either aspect ratio.
- Unsafe slot values escape HTML or CSS boundaries.
- Required slots, unknown templates, unsupported ratios, or malformed brands pass validation.
- Output changes across identical renders or falsely claims to contain an image.
- Hook selection reads files, uses randomness, mutates input, or mixes site scores.
- Missing score files fail cold start; corrupt files silently reset scores.
- Invalid scores, unknown hooks, or path traversal reach the score store.
- Score writes leave partial JSON or overwrite concurrent changes without notice.
- Lint misses housing category, targeting, deceptive claims, or forbidden superlatives.
- Lint misses percent-below-market claims, urgency, staging, or news framing.
- Empty copy passes; safe copy returns no review finding.
- Copy or errors expose private input; policy results imply platform approval.
- Cost checks accept negative, fractional, infinite, missing, or excessive amounts.
- Cost checks ignore existing ad spend or monthly spend; boundaries are wrong.
- Plans spend by default, accept contradictory flags, or permit apply in this stub.
- CLI accepts unknown commands, options, duplicate options, or missing values.
- CLI and MCP return different action results or schemas permit unsupported inputs.
- MCP emits logs on stdout, loses fragmented frames, or replies to notifications.
- MCP crashes on malformed JSON, invalid requests, or unknown methods and tools.
- MCP omits initialization, tool descriptions, schemas, or structured errors.
- Child tests hang, leak processes, or report success without real assertions.
- Evidence includes private inputs or fails to record actual results.

The single E2E script covers public process behavior and library integration in a child process.
The score store creates temporary files exclusively and replaces snapshots atomically.
It is a single-writer store. Concurrent updates are outside this slice.
No paid provider, launch path, raster renderer, or network transport exists in this slice.
